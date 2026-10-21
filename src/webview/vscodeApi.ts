import type { WebviewMessage } from '../shared/types';

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

// acquireVsCodeApi may only be called once per webview.
const api = acquireVsCodeApi();

export function post(message: WebviewMessage): void {
  api.postMessage(message);
}
