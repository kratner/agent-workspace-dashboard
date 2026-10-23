import * as vscode from 'vscode';
import { log } from '../log';
import type { HistoryHit, HistoryIndexStatus } from '../shared/types';
import { HistoryIndex } from './historyIndex';

const STATUS_THROTTLE_MS = 300;

/** VS Code glue around HistoryIndex: refresh on demand, throttled progress, paged queries. */
export class HistoryService implements vscode.Disposable {
  private readonly index: HistoryIndex;
  private readonly emitter = new vscode.EventEmitter<HistoryIndexStatus>();
  readonly onStatus = this.emitter.event;
  private lastEmit = 0;
  private pending?: NodeJS.Timeout;
  private refreshing?: Promise<void>;

  constructor(projectsDir: string, cacheFile: string) {
    this.index = new HistoryIndex(projectsDir, cacheFile, (s) => this.emitStatus(s));
  }

  /**
   * Search past sessions. The index refreshes in the background on every query (cheap once
   * built); results reflect whatever is indexed so far, and onStatus says when more arrive.
   */
  query(query: string, includeSubagents: boolean, exclude: Set<string>, offset: number, limit: number) {
    this.ensureFresh();
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits: HistoryHit[] = this.index.search(terms, { includeSubagents, exclude });
    return { total: hits.length, hits: hits.slice(offset, offset + limit), status: this.index.status };
  }

  private ensureFresh(): void {
    if (this.refreshing) return;
    const started = Date.now();
    this.refreshing = this.index
      .refresh()
      .then(() => log.info(`history index up to date: ${this.index.size} transcripts, ${Date.now() - started} ms`))
      .catch((err) => log.error('history index refresh failed', err))
      .finally(() => (this.refreshing = undefined));
  }

  private emitStatus(status: HistoryIndexStatus): void {
    clearTimeout(this.pending);
    this.pending = undefined;
    const now = Date.now();
    if (status.done || now - this.lastEmit >= STATUS_THROTTLE_MS) {
      this.lastEmit = now;
      this.emitter.fire(status);
    } else {
      this.pending = setTimeout(() => {
        this.lastEmit = Date.now();
        this.emitter.fire(this.index.status);
      }, STATUS_THROTTLE_MS);
    }
  }

  dispose(): void {
    clearTimeout(this.pending);
    this.emitter.dispose();
  }
}
