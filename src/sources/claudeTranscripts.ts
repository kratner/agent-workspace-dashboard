import * as fsp from 'fs/promises';
import * as path from 'path';
import { StringDecoder } from 'string_decoder';

// Claude Code keeps one transcript per session at <config>/projects/<folder-slug>/<sessionId>.jsonl.
// We only need a few small records from it (titles, the last prompt, the folder), so each
// file is read once and afterwards only the bytes appended since the last read.

export interface TranscriptFile {
  sessionId: string;
  path: string;
  mtime: number;
  size: number;
}

export interface TranscriptDetails {
  cwd?: string;
  aiTitle?: string;
  customTitle?: string;
  agentName?: string;
  lastPrompt?: string;
}

interface ParseState extends TranscriptDetails {
  offset: number;
  decoder: StringDecoder;
  remainder: string;
}

const CHUNK = 1 << 20;
const RECORD_TYPE = /^\{"type":"([a-z-]+)"/;
const CWD_FIELD = /"cwd":"((?:[^"\\]|\\.)*)"/;

export class TranscriptIndex {
  private readonly parsed = new Map<string, ParseState>();

  constructor(private readonly projectsDir: string) {}

  /** All top-level transcripts by session id (subagent transcripts live in subfolders and are skipped). */
  async scan(): Promise<Map<string, TranscriptFile>> {
    const files = new Map<string, TranscriptFile>();
    let dirs;
    try {
      dirs = await fsp.readdir(this.projectsDir, { withFileTypes: true });
    } catch {
      return files;
    }
    await Promise.all(
      dirs
        .filter((d) => d.isDirectory())
        .map(async (d) => {
          const dir = path.join(this.projectsDir, d.name);
          let entries: string[];
          try {
            entries = await fsp.readdir(dir);
          } catch {
            return;
          }
          await Promise.all(
            entries
              .filter((e) => e.endsWith('.jsonl'))
              .map(async (e) => {
                const file = path.join(dir, e);
                try {
                  const st = await fsp.stat(file);
                  const sessionId = e.slice(0, -'.jsonl'.length);
                  const prev = files.get(sessionId);
                  if (!prev || st.mtimeMs > prev.mtime) {
                    files.set(sessionId, { sessionId, path: file, mtime: st.mtimeMs, size: st.size });
                  }
                } catch {
                  // deleted between readdir and stat
                }
              }),
          );
        }),
    );
    return files;
  }

  async details(file: TranscriptFile): Promise<TranscriptDetails> {
    let state = this.parsed.get(file.path);
    if (!state || file.size < state.offset) {
      state = { offset: 0, decoder: new StringDecoder('utf8'), remainder: '' };
      this.parsed.set(file.path, state);
    }
    if (file.size > state.offset) {
      const handle = await fsp.open(file.path, 'r');
      try {
        const buf = Buffer.alloc(Math.min(CHUNK, file.size - state.offset));
        while (state.offset < file.size) {
          const { bytesRead } = await handle.read(buf, 0, Math.min(buf.length, file.size - state.offset), state.offset);
          if (bytesRead === 0) break;
          state.offset += bytesRead;
          const lines = (state.remainder + state.decoder.write(buf.subarray(0, bytesRead))).split('\n');
          state.remainder = lines.pop() ?? '';
          for (const line of lines) consume(state, line);
        }
      } finally {
        await handle.close();
      }
    }
    const { cwd, aiTitle, customTitle, agentName, lastPrompt } = state;
    return { cwd, aiTitle, customTitle, agentName, lastPrompt };
  }

  /** Drop cached parse state for transcripts no longer of interest. */
  retain(paths: Set<string>): void {
    for (const p of this.parsed.keys()) if (!paths.has(p)) this.parsed.delete(p);
  }
}

function consume(state: ParseState, line: string): void {
  const type = RECORD_TYPE.exec(line)?.[1];
  if (type === 'ai-title' || type === 'custom-title' || type === 'agent-name' || type === 'last-prompt') {
    try {
      const r = JSON.parse(line);
      if (type === 'ai-title' && r.aiTitle) state.aiTitle = r.aiTitle;
      if (type === 'custom-title' && r.customTitle) state.customTitle = r.customTitle;
      if (type === 'agent-name' && r.agentName) state.agentName = r.agentName;
      if (type === 'last-prompt' && r.lastPrompt) state.lastPrompt = r.lastPrompt;
    } catch {
      // partial or malformed line
    }
    return;
  }
  if (!state.cwd) {
    const m = CWD_FIELD.exec(line);
    if (m) {
      try {
        state.cwd = JSON.parse(`"${m[1]}"`);
      } catch {
        // ignore
      }
    }
  }
}
