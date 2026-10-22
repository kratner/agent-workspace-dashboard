import type { WebviewMessage } from '../shared/types';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

// acquireVsCodeApi may only be called once per webview.
const api = acquireVsCodeApi();

export function post(message: WebviewMessage): void {
  api.postMessage(message);
}

export function log(level: 'info' | 'error', message: string): void {
  post({ type: 'log', level, message });
}

// Anything that breaks in the webview shows up in the "Agent Workspace" output log.
window.addEventListener('error', (e) => log('error', `${e.message} (${e.filename}:${e.lineno})`));
window.addEventListener('unhandledrejection', (e) => log('error', `Unhandled rejection: ${String(e.reason)}`));
