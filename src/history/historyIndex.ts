import * as fsp from 'fs/promises';
import * as path from 'path';
import type { HistoryHit, HistoryIndexStatus } from '../shared/types';

// Search index over every Claude Code transcript on the machine, including subagent
// transcripts. It stores only what search needs: titles, folder, and the prompts the user
// typed (not Claude's replies or tool output, which are most of a transcript's bytes).
//
// Transcripts are append-only, so each one is read once and afterwards only from the last
// complete line onward. The index is saved to disk so a restart doesn't rescan.
// No `vscode` imports: this file is unit-tested and benchmarked under plain Node.

export interface PromptEntry {
  text: string;
  ts: number;
}

export interface TranscriptEntry {
  path: string;
  size: number;
  mtime: number;
  /** Bytes consumed so far; always at a line boundary. */
  offset: number;
  sessionId: string;
  /** Set for subagent transcripts. */
  agentId?: string;
  cwd?: string;
  aiTitle?: string;
  customTitle?: string;
  agentName?: string;
  /** Subagent metadata from agent-<id>.meta.json. */
  description?: string;
  agentType?: string;
  depth?: number;
  prompts: PromptEntry[];
}

interface Persisted {
  version: number;
  entries: TranscriptEntry[];
}

const INDEX_VERSION = 1;
const CHUNK = 8 << 20;
const MAX_PROMPT_CHARS = 4000;
const SNIPPET_RADIUS = 90;

// Blocks Claude Code and the IDE inject into the user's message; not something the user typed.
const INJECTED_TAG = /<((?:system|ide|local-command|command|bash|browser|task|user-prompt)[\w-]*)\b[^>]*>[\s\S]*?<\/\1>/g;

const enc = (s: string) => Buffer.from(s, 'utf8');
const TITLE_MARKERS: [Buffer, keyof TranscriptEntry][] = [
  [enc('{"type":"ai-title"'), 'aiTitle'],
  [enc('{"type":"custom-title"'), 'customTitle'],
  [enc('{"type":"agent-name"'), 'agentName'],
];
const USER_TYPE = enc('"type":"user"');
const TOOL_RESULT = enc('"tool_use_id"');

export class HistoryIndex {
  private entries = new Map<string, TranscriptEntry>();
  private haystacks = new Map<string, { size: number; text: string; prompts: string[] }>();
  private running?: Promise<void>;
  private loaded = false;
  private dirty = false;
  status: HistoryIndexStatus = { indexed: 0, total: 0, done: false };

  constructor(
    private readonly projectsDir: string,
    /** Where the index is cached between runs; undefined disables caching (tests). */
    private readonly cacheFile: string | undefined,
    private readonly onProgress: (status: HistoryIndexStatus) => void = () => {},
  ) {}

  /** Bring the index up to date with the transcripts on disk. Concurrent calls share one run. */
  refresh(): Promise<void> {
    this.running ??= this.run().finally(() => (this.running = undefined));
    return this.running;
  }

  private async run(): Promise<void> {
    if (!this.loaded) await this.load();
    const files = await this.listTranscripts();
    const seen = new Set(files.map((f) => f.path));
    for (const p of this.entries.keys()) {
      if (!seen.has(p)) {
        this.entries.delete(p);
        this.dirty = true;
      }
    }

    // Most recent first, so recent sessions become searchable soonest on a first scan.
    const stale = files
      .filter((f) => {
        const e = this.entries.get(f.path);
        return !e || e.size !== f.size || e.mtime !== f.mtime;
      })
      .sort((a, b) => b.mtime - a.mtime);

    this.status = { indexed: files.length - stale.length, total: files.length, done: stale.length === 0 };
    this.onProgress(this.status);

    for (const f of stale) {
      try {
        await this.indexFile(f);
      } catch {
        // unreadable or vanished mid-read: try again next refresh
      }
      this.status = { ...this.status, indexed: this.status.indexed + 1 };
      this.onProgress(this.status);
    }
    this.status = { ...this.status, indexed: this.status.total, done: true };
    this.onProgress(this.status);
    if (this.dirty) await this.save();
  }

  private async indexFile(f: ListedFile): Promise<void> {
    let e = this.entries.get(f.path);
    if (!e || f.size < e.offset) {
      // New, or rewritten shorter than what we read: start over.
      e = { path: f.path, size: 0, mtime: 0, offset: 0, sessionId: f.sessionId, agentId: f.agentId, prompts: [] };
      this.entries.set(f.path, e);
    }
    if (f.metaPath) await readMeta(f.metaPath, e);
    await readAppended(e, f.size);
    e.size = f.size;
    e.mtime = f.mtime;
    this.haystacks.delete(f.path);
    this.dirty = true;
  }

  private async listTranscripts(): Promise<ListedFile[]> {
    const out: ListedFile[] = [];
    let folders;
    try {
      folders = await fsp.readdir(this.projectsDir, { withFileTypes: true });
    } catch {
      return out;
    }
    for (const folder of folders) {
      if (!folder.isDirectory()) continue;
      const dir = path.join(this.projectsDir, folder.name);
      let items;
      try {
        items = await fsp.readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const item of items) {
        if (item.isFile() && item.name.endsWith('.jsonl')) {
          const stat = await statOrUndefined(path.join(dir, item.name));
          if (stat) out.push({ path: path.join(dir, item.name), size: stat.size, mtime: stat.mtimeMs, sessionId: item.name.slice(0, -6) });
        } else if (item.isDirectory()) {
          // <session id>/subagents/agent-<agent id>.jsonl (+ .meta.json)
          const subDir = path.join(dir, item.name, 'subagents');
          let subs: string[];
          try {
            subs = await fsp.readdir(subDir);
          } catch {
            continue;
          }
          for (const name of subs) {
            const m = /^agent-(.+)\.jsonl$/.exec(name);
            if (!m) continue;
            const p = path.join(subDir, name);
            const stat = await statOrUndefined(p);
            if (!stat) continue;
            const metaPath = path.join(subDir, `agent-${m[1]}.meta.json`);
            out.push({ path: p, size: stat.size, mtime: stat.mtimeMs, sessionId: item.name, agentId: m[1], metaPath: subs.includes(`agent-${m[1]}.meta.json`) ? metaPath : undefined });
          }
        }
      }
    }
    return out;
  }

  private async load(): Promise<void> {
    this.loaded = true;
    if (!this.cacheFile) return;
    try {
      const data = JSON.parse(await fsp.readFile(this.cacheFile, 'utf8')) as Persisted;
      if (data.version === INDEX_VERSION) for (const e of data.entries) this.entries.set(e.path, e);
    } catch {
      // no cache yet, or unreadable: rebuild
    }
  }

  private async save(): Promise<void> {
    if (!this.cacheFile) return;
    const data: Persisted = { version: INDEX_VERSION, entries: [...this.entries.values()] };
    await fsp.mkdir(path.dirname(this.cacheFile), { recursive: true });
    const tmp = `${this.cacheFile}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(data));
    await fsp.rename(tmp, this.cacheFile);
    this.dirty = false;
  }

  // ---- search ------------------------------------------------------------------------

  /**
   * Sessions whose own text, or one of whose subagents' text, contains every term.
   * Subagent matches roll up to their parent session. Newest first.
   */
  search(terms: string[], opts: { includeSubagents: boolean; exclude?: Set<string> }): HistoryHit[] {
    if (terms.length === 0) return [];
    const groups = new Map<string, { parent?: TranscriptEntry; subs: TranscriptEntry[] }>();
    for (const e of this.entries.values()) {
      if (opts.exclude?.has(e.sessionId)) continue;
      let g = groups.get(e.sessionId);
      if (!g) groups.set(e.sessionId, (g = { subs: [] }));
      if (e.agentId) g.subs.push(e);
      else g.parent = e;
    }

    const hits: HistoryHit[] = [];
    for (const [sessionId, g] of groups) {
      const parentMatch = g.parent ? this.matches(g.parent, terms) : false;
      const subMatches = opts.includeSubagents ? g.subs.filter((s) => this.matches(s, terms)) : [];
      if (!parentMatch && subMatches.length === 0) continue;
      const lastActivity = Math.max(g.parent?.mtime ?? 0, ...g.subs.map((s) => s.mtime));
      hits.push({
        sessionId,
        title: g.parent ? sessionTitle(g.parent) : sessionId.slice(0, 8),
        cwd: g.parent?.cwd ?? g.subs[0]?.cwd,
        lastActivity,
        promptSnippet: parentMatch && g.parent ? this.snippet(g.parent, terms) : undefined,
        subagents: subMatches
          .sort((a, b) => b.mtime - a.mtime)
          .map((s) => ({
            agentId: s.agentId!,
            label: s.description || s.agentType || truncate(s.prompts[0]?.text, 60) || 'subagent',
            agentType: s.agentType,
            depth: s.depth ?? 1,
            snippet: this.snippet(s, terms),
          })),
      });
    }
    return hits.sort((a, b) => b.lastActivity - a.lastActivity);
  }

  private haystack(e: TranscriptEntry) {
    let h = this.haystacks.get(e.path);
    if (!h || h.size !== e.size) {
      const prompts = e.prompts.map((p) => p.text.toLowerCase());
      const text = [e.customTitle, e.agentName, e.aiTitle, e.description, e.agentType, e.cwd, ...prompts].filter(Boolean).join('\n').toLowerCase();
      h = { size: e.size, text, prompts };
      this.haystacks.set(e.path, h);
    }
    return h;
  }

  private matches(e: TranscriptEntry, terms: string[]): boolean {
    const { text } = this.haystack(e);
    return terms.every((t) => text.includes(t));
  }

  /** An excerpt of the prompt containing the most terms (latest wins a tie). */
  private snippet(e: TranscriptEntry, terms: string[]): string | undefined {
    const { prompts } = this.haystack(e);
    let best = -1;
    let bestScore = 0;
    prompts.forEach((p, i) => {
      const score = terms.filter((t) => p.includes(t)).length;
      if (score > 0 && score >= bestScore) {
        best = i;
        bestScore = score;
      }
    });
    return best < 0 ? undefined : excerpt(e.prompts[best].text, terms);
  }

  /** For tests and diagnostics. */
  get size(): number {
    return this.entries.size;
  }
}

interface ListedFile {
  path: string;
  size: number;
  mtime: number;
  sessionId: string;
  agentId?: string;
  metaPath?: string;
}

async function statOrUndefined(p: string) {
  try {
    return await fsp.stat(p);
  } catch {
    return undefined;
  }
}

async function readMeta(metaPath: string, e: TranscriptEntry): Promise<void> {
  try {
    const m = JSON.parse(await fsp.readFile(metaPath, 'utf8'));
    if (typeof m.description === 'string') e.description = m.description;
    if (typeof m.agentType === 'string') e.agentType = m.agentType;
    if (typeof m.spawnDepth === 'number') e.depth = m.spawnDepth;
  } catch {
    // undocumented file: absent or changed format just means no label
  }
}

/** Reads complete lines from e.offset to `size`, updating the entry. */
async function readAppended(e: TranscriptEntry, size: number): Promise<void> {
  if (size <= e.offset) return;
  const handle = await fsp.open(e.path, 'r');
  try {
    const buf = Buffer.allocUnsafe(CHUNK);
    let pos = e.offset;
    let carry: Buffer | undefined;
    while (pos < size) {
      const { bytesRead } = await handle.read(buf, 0, Math.min(CHUNK, size - pos), pos);
      if (bytesRead === 0) break;
      pos += bytesRead;
      const data = carry ? Buffer.concat([carry, buf.subarray(0, bytesRead)]) : buf.subarray(0, bytesRead);
      const lastNewline = data.lastIndexOf(10);
      if (lastNewline < 0) {
        carry = Buffer.from(data);
        continue;
      }
      scanLines(data, lastNewline, e);
      carry = lastNewline + 1 < data.length ? Buffer.from(data.subarray(lastNewline + 1)) : undefined;
      e.offset = pos - (carry?.length ?? 0);
      // Let the extension host breathe between chunks of a large transcript.
      await new Promise((r) => setImmediate(r));
    }
  } finally {
    await handle.close();
  }
}

function scanLines(data: Buffer, end: number, e: TranscriptEntry): void {
  let start = 0;
  while (start < end) {
    let nl = data.indexOf(10, start);
    if (nl < 0 || nl > end) nl = end;
    if (nl > start) scanLine(data, start, nl, e);
    start = nl + 1;
  }
}

function startsWith(data: Buffer, start: number, end: number, marker: Buffer): boolean {
  return end - start >= marker.length && data.compare(marker, 0, marker.length, start, start + marker.length) === 0;
}

function within(data: Buffer, start: number, end: number, limit: number, needle: Buffer): boolean {
  const i = data.indexOf(needle, start);
  return i >= 0 && i < Math.min(end, start + limit);
}

function scanLine(data: Buffer, start: number, end: number, e: TranscriptEntry): void {
  for (const [marker, field] of TITLE_MARKERS) {
    if (startsWith(data, start, end, marker)) {
      const o = parse(data, start, end);
      const v = o?.aiTitle ?? o?.customTitle ?? o?.agentName;
      if (typeof v === 'string' && v) (e as unknown as Record<string, unknown>)[field] = v;
      return;
    }
  }
  // Cheap byte checks first: only lines that look like a typed user message get parsed.
  if (!within(data, start, end, 600, USER_TYPE) || within(data, start, end, 1200, TOOL_RESULT)) return;
  const o = parse(data, start, end);
  if (!o || o.type !== 'user' || o.isMeta || o.isCompactSummary) return;
  if (!e.agentId && o.isSidechain) return; // old transcripts kept subagent turns inline
  if (!e.cwd && typeof o.cwd === 'string') e.cwd = o.cwd;
  const text = promptText(o.message?.content);
  if (!text) return;
  const ts = Date.parse(o.timestamp) || 0;
  e.prompts.push({ text: text.length > MAX_PROMPT_CHARS ? text.slice(0, MAX_PROMPT_CHARS) : text, ts });
}

function parse(data: Buffer, start: number, end: number): any {
  try {
    return JSON.parse(data.toString('utf8', start, end));
  } catch {
    return undefined;
  }
}

/** What the user typed: text parts only, with IDE/system injections removed. */
export function promptText(content: unknown): string {
  const parts: string[] =
    typeof content === 'string'
      ? [content]
      : Array.isArray(content)
        ? content.filter((p) => p?.type === 'text' && typeof p.text === 'string').map((p) => p.text)
        : [];
  return parts
    .map((t) => t.replace(INJECTED_TAG, '').trim())
    .filter((t) => t && !t.startsWith('[Request interrupted'))
    .join('\n')
    .trim();
}

export function sessionTitle(e: TranscriptEntry): string {
  return e.customTitle || e.agentName || e.aiTitle || truncate(e.prompts[0]?.text, 80) || e.sessionId.slice(0, 8);
}

function truncate(text: string | undefined, max: number): string | undefined {
  if (!text) return undefined;
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max - 1)}…` : one;
}

export function excerpt(text: string, terms: string[]): string {
  const one = text.replace(/\s+/g, ' ').trim();
  const lower = one.toLowerCase();
  const first = Math.min(...terms.map((t) => lower.indexOf(t)).filter((i) => i >= 0));
  if (!Number.isFinite(first)) return truncate(one, SNIPPET_RADIUS * 2) ?? '';
  const from = Math.max(0, first - SNIPPET_RADIUS);
  const to = Math.min(one.length, first + SNIPPET_RADIUS);
  return `${from > 0 ? '…' : ''}${one.slice(from, to).trim()}${to < one.length ? '…' : ''}`;
}
