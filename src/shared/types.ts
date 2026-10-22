// Types shared by the extension host and the webview. Every agent system's source
// converts its own data into AgentSession, so the views never see source-specific shapes.

export type SessionState = 'waiting' | 'busy' | 'idle' | 'ended';

export interface AgentSession {
  /** Unique across sources: `${source}:${id}`. */
  key: string;
  /** Source id, e.g. 'claude-code'. */
  source: string;
  sourceLabel: string;
  /** The source's own session id. */
  id: string;
  title: string;
  cwd?: string;
  state: SessionState;
  /** The source's status word before mapping, shown when it isn't one we recognise. */
  rawStatus?: string;
  /** Where the session runs: 'VS Code', 'Terminal', 'Background'. */
  surface?: string;
  pid?: number;
  startedAt?: number;
  /** Last activity, epoch ms. */
  updatedAt: number;
  lastPrompt?: string;
}

/** 'brand': KR black and yellow. 'vscode': follow the editor's color theme. */
export type Appearance = 'brand' | 'vscode';

export interface DashboardState {
  type: 'state';
  sessions: AgentSession[];
  viewId: string;
  sources: string[];
  appearance: Appearance;
}

export type HostMessage = DashboardState;

export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'refresh' }
  | { type: 'setView'; viewId: string }
  | { type: 'open'; key: string }
  | { type: 'copyResume'; key: string }
  /** Errors and milestones from the webview, written to the extension's output log. */
  | { type: 'log'; level: 'info' | 'error'; message: string };
