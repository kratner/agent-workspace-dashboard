import * as vscode from 'vscode';
import { log } from './log';
import type { Appearance, HostMessage, WebviewMessage } from './shared/types';
import type { SessionStore } from './sessionStore';

export const VIEW_TYPE = 'agentWorkspace.dashboard';
const ACTIVE_VIEW_KEY = 'agentWorkspace.activeView';
const DEFAULT_VIEW = 'kanban';

/** The single dashboard tab. The webview owns the list of views; the host only stores which one is active. */
export class DashboardPanel implements vscode.Disposable {
  private static current?: DashboardPanel;
  private readonly disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext, store: SessionStore): void {
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal();
      return;
    }
    const panel = vscode.window.createWebviewPanel(VIEW_TYPE, 'Agent Workspace', vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')],
    });
    DashboardPanel.current = new DashboardPanel(panel, context, store);
  }

  /** Re-attach to a tab VS Code restored after a restart. */
  static revive(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, store: SessionStore): void {
    panel.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist')] };
    DashboardPanel.current?.dispose();
    DashboardPanel.current = new DashboardPanel(panel, context, store);
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    private readonly context: vscode.ExtensionContext,
    private readonly store: SessionStore,
  ) {
    panel.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icon.png');
    // Listen before setting the HTML, so the webview's first message can't arrive unheard.
    this.disposables.push(
      panel.webview.onDidReceiveMessage((m: WebviewMessage) =>
        this.handle(m).catch((err) => log.error(`handling "${m?.type}" from the webview failed`, err)),
      ),
      store.onDidChange(() => this.post()),
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('agentWorkspace.appearance')) this.post();
      }),
      panel.onDidDispose(() => this.dispose()),
    );
    panel.webview.html = this.html();
    log.info(`dashboard webview created (extension at ${context.extensionUri.fsPath})`);
  }

  private async handle(message: WebviewMessage): Promise<void> {
    if (message.type !== 'log') log.info(`webview -> ${message.type}`);
    switch (message.type) {
      case 'log':
        log[message.level](`[webview] ${message.message}`);
        break;
      case 'ready':
        this.post();
        void this.store.refresh();
        break;
      case 'refresh':
        await this.store.refresh();
        break;
      case 'setView':
        await this.context.workspaceState.update(ACTIVE_VIEW_KEY, message.viewId);
        break;
      case 'open': {
        const found = this.store.find(message.key);
        if (found) await found.source.open(found.session);
        break;
      }
      case 'copyResume': {
        const found = this.store.find(message.key);
        const command = found?.source.resumeCommand?.(found.session);
        if (command) {
          await vscode.env.clipboard.writeText(command);
          vscode.window.setStatusBarMessage('$(check) Resume command copied', 3000);
        }
        break;
      }
    }
  }

  private post(): void {
    // A hidden tab's webview is unloaded (no retainContextWhenHidden). It sends 'ready' when it
    // comes back, and gets the current state then.
    if (!this.panel.visible) return;
    const message: HostMessage = {
      type: 'state',
      sessions: this.store.current,
      viewId: this.context.workspaceState.get<string>(ACTIVE_VIEW_KEY, DEFAULT_VIEW),
      sources: this.store.sources.map((s) => s.label),
      appearance: vscode.workspace.getConfiguration('agentWorkspace').get<Appearance>('appearance', 'brand'),
    };
    this.panel.webview.postMessage(message).then(undefined, (err) => log.error('posting state to the webview failed', err));
  }

  private html(): string {
    const webview = this.panel.webview;
    const asset = (file: string) => webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', file));
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${asset('webview.css')}">
  <title>Agent Workspace</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${asset('webview.js')}"></script>
</body>
</html>`;
  }

  dispose(): void {
    if (DashboardPanel.current === this) DashboardPanel.current = undefined;
    for (const d of this.disposables.splice(0)) d.dispose();
    this.panel.dispose();
  }
}
