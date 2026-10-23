import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { log } from '../log';
import { downloadVerified, isNewer, latestRelease, vsixAsset } from './releaseClient';

// While the extension is distributed through GitHub Releases rather than the Marketplace,
// it checks for new releases itself: about once a day, and on demand from the
// "Check for Updates" command. Once it's on the Marketplace, VS Code updates it and this
// check should be switched off (agentWorkspace.checkForUpdates).

const DAY_MS = 86_400_000;
const STARTUP_DELAY_MS = 30_000;
const LAST_CHECK_KEY = 'agentWorkspace.lastUpdateCheck';
const SKIPPED_KEY = 'agentWorkspace.skippedVersion';

export function registerUpdater(context: vscode.ExtensionContext): vscode.Disposable[] {
  const check = (manual: boolean) => checkForUpdates(context, manual).catch((err) => log.error('update check failed', err));
  const timer = setTimeout(() => {
    const enabled = vscode.workspace.getConfiguration('agentWorkspace').get<boolean>('checkForUpdates', true);
    const last = context.globalState.get<number>(LAST_CHECK_KEY, 0);
    if (enabled && context.extensionMode === vscode.ExtensionMode.Production && Date.now() - last > DAY_MS) void check(false);
  }, STARTUP_DELAY_MS);
  return [
    { dispose: () => clearTimeout(timer) },
    vscode.commands.registerCommand('agentWorkspace.checkForUpdates', () => check(true)),
  ];
}

async function checkForUpdates(context: vscode.ExtensionContext, manual: boolean): Promise<void> {
  const current: string = context.extension.packageJSON.version;
  let release;
  try {
    release = await latestRelease();
  } catch (err) {
    log.error('could not reach GitHub to check for updates', err);
    if (manual) void vscode.window.showErrorMessage(`Couldn't check for updates: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }
  await context.globalState.update(LAST_CHECK_KEY, Date.now());

  const latest = release.tag_name.replace(/^v/, '');
  log.info(`update check: installed ${current}, latest release ${latest}`);
  if (!isNewer(latest, current)) {
    if (manual) void vscode.window.showInformationMessage(`Agent Workspace Dashboard is up to date (${current}).`);
    return;
  }
  if (!manual && context.globalState.get<string>(SKIPPED_KEY) === latest) return;

  const asset = vsixAsset(release);
  const actions = asset ? ['Update', 'Release Notes'] : ['Release Notes'];
  if (!manual) actions.push('Skip This Version');
  const choice = await vscode.window.showInformationMessage(`Agent Workspace Dashboard ${latest} is available. You have ${current}.`, ...actions);

  if (choice === 'Release Notes') {
    await vscode.env.openExternal(vscode.Uri.parse(release.html_url));
  } else if (choice === 'Skip This Version') {
    await context.globalState.update(SKIPPED_KEY, latest);
  } else if (choice === 'Update' && asset) {
    const file = path.join(os.tmpdir(), asset.name);
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Updating Agent Workspace Dashboard to ${latest}…` },
      async () => {
        await downloadVerified(asset, file);
        await vscode.commands.executeCommand('workbench.extensions.installExtension', vscode.Uri.file(file));
      },
    );
    log.info(`updated to ${latest} from ${asset.browser_download_url}`);
    const reload = await vscode.window.showInformationMessage(
      `Agent Workspace Dashboard ${latest} is installed. Reload the window to start using it.`,
      'Reload Window',
    );
    if (reload) await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
}
