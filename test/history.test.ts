import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { HistoryIndex, excerpt, promptText } from '../src/history/historyIndex';
import { clampThreshold, initialVisible, needsExpand } from '../src/webview/historyPaging';

// Fixtures are synthetic transcripts in the on-disk layout Claude Code uses:
//   projects/<folder>/<session>.jsonl
//   projects/<folder>/<session>/subagents/agent-<id>.jsonl + agent-<id>.meta.json

function tmpProjects(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'awd-history-'));
}

const user = (text: string | object[], extra: object = {}) =>
  JSON.stringify({ parentUuid: null, isSidechain: false, type: 'user', message: { role: 'user', content: text }, timestamp: '2026-10-01T12:00:00Z', cwd: '/work/api', sessionId: 's', ...extra });
const toolResult = (text: string) =>
  JSON.stringify({ parentUuid: 'x', isSidechain: false, type: 'user', message: { role: 'user', content: [{ tool_use_id: 't1', type: 'tool_result', content: text }] }, timestamp: '2026-10-01T12:00:01Z' });
const assistant = (text: string) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } });
const aiTitle = (t: string) => JSON.stringify({ type: 'ai-title', aiTitle: t, sessionId: 's' });
const customTitle = (t: string) => JSON.stringify({ type: 'custom-title', customTitle: t, sessionId: 's' });

function writeSession(root: string, id: string, lines: string[], mtime?: Date): string {
  const dir = path.join(root, 'work-api');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `${id}.jsonl`);
  fs.writeFileSync(p, lines.join('\n') + '\n');
  if (mtime) fs.utimesSync(p, mtime, mtime);
  return p;
}

function writeSubagent(root: string, parent: string, agentId: string, lines: string[], meta?: object): string {
  const dir = path.join(root, 'work-api', parent, 'subagents');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, `agent-${agentId}.jsonl`);
  fs.writeFileSync(p, lines.join('\n') + '\n');
  if (meta) fs.writeFileSync(path.join(dir, `agent-${agentId}.meta.json`), JSON.stringify(meta));
  return p;
}

const terms = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

test('promptText keeps typed text and strips IDE/system injections', () => {
  assert.equal(promptText('fix the parser'), 'fix the parser');
  assert.equal(
    promptText([
      { type: 'text', text: '<ide_selection>The user selected lines 1 to 9</ide_selection>' },
      { type: 'text', text: 'why is this slow?' },
      { type: 'image', source: {} },
    ]),
    'why is this slow?',
  );
  assert.equal(promptText('<system-reminder>ignore</system-reminder>\nship it'), 'ship it');
  assert.equal(promptText('[Request interrupted by user]'), '');
  assert.equal(promptText('render <div>hello</div> please'), 'render <div>hello</div> please', 'user HTML is kept');
});

test('indexes typed prompts only, with titles; skips tool output, meta and assistant text', async () => {
  const root = tmpProjects();
  writeSession(root, 'aaa', [
    aiTitle('Old title'),
    user('migrate the orders table'),
    assistant('I will run the migration now'),
    toolResult('migration output: 400 rows'),
    user('reminder text', { isMeta: true }),
    aiTitle('Database migration'),
  ]);
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  const [hit] = idx.search(terms('orders'), { includeSubagents: true });
  assert.equal(hit.sessionId, 'aaa');
  assert.equal(hit.title, 'Database migration', 'latest ai-title wins');
  assert.equal(hit.cwd, '/work/api');
  assert.match(hit.promptSnippet ?? '', /orders/);
  assert.equal(idx.search(terms('400 rows'), { includeSubagents: true }).length, 0, 'tool output is not indexed');
  assert.equal(idx.search(terms('run the migration now'), { includeSubagents: true }).length, 0, 'assistant text is not indexed');
  assert.equal(idx.search(terms('reminder'), { includeSubagents: true }).length, 0, 'meta records are not indexed');
});

test('custom title beats ai title; every term must match somewhere in the session', async () => {
  const root = tmpProjects();
  writeSession(root, 'bbb', [aiTitle('Auto'), customTitle('Auth refactor'), user('split token refresh'), user('add tests for the middleware')]);
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  const hits = idx.search(terms('token middleware'), { includeSubagents: true });
  assert.equal(hits.length, 1, 'terms may come from different prompts of one session');
  assert.equal(hits[0].title, 'Auth refactor');
  assert.equal(idx.search(terms('token kubernetes'), { includeSubagents: true }).length, 0);
});

test('reads only appended lines, and never a half-written one', async () => {
  const root = tmpProjects();
  const p = writeSession(root, 'ccc', [user('first prompt')]);
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  fs.appendFileSync(p, user('second prompt about caching').slice(0, 40)); // partial line, no newline
  await idx.refresh();
  assert.equal(idx.search(terms('caching'), { includeSubagents: true }).length, 0, 'partial line not consumed');
  fs.appendFileSync(p, user('second prompt about caching').slice(40) + '\n');
  await idx.refresh();
  assert.equal(idx.search(terms('caching'), { includeSubagents: true }).length, 1, 'completed line is indexed');
  assert.equal(idx.search(terms('first'), { includeSubagents: true }).length, 1, 'earlier prompts kept');
});

test('a transcript rewritten shorter is re-read from the start; a deleted one disappears', async () => {
  const root = tmpProjects();
  const p = writeSession(root, 'ddd', [user('alpha one'), user('alpha two'), user('alpha three')]);
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  fs.writeFileSync(p, user('beta') + '\n');
  await idx.refresh();
  assert.equal(idx.search(terms('alpha'), { includeSubagents: true }).length, 0);
  assert.equal(idx.search(terms('beta'), { includeSubagents: true }).length, 1);
  fs.rmSync(p);
  await idx.refresh();
  assert.equal(idx.size, 0);
});

test('a subagent match rolls up to its parent, labelled from its meta file', async () => {
  const root = tmpProjects();
  writeSession(root, 'eee', [aiTitle('Release prep'), user('get the release ready')]);
  writeSubagent(root, 'eee', 'a1', [user('scan the changelog for breaking changes', { isSidechain: true })], {
    description: 'Check the changelog',
    agentType: 'Explore',
    spawnDepth: 1,
  });
  writeSubagent(root, 'eee', 'a2', [user('list breaking changes in the api', { isSidechain: true })], { agentType: 'general-purpose', spawnDepth: 2 });
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();

  const [hit] = idx.search(terms('breaking'), { includeSubagents: true });
  assert.equal(hit.sessionId, 'eee');
  assert.equal(hit.title, 'Release prep', 'shows the parent session');
  assert.equal(hit.promptSnippet, undefined, 'the parent itself did not match');
  assert.equal(hit.subagents.length, 2);
  const labels = hit.subagents.map((s) => s.label).sort();
  assert.deepEqual(labels, ['Check the changelog', 'general-purpose'], 'description, else agent type');
  assert.ok(hit.subagents.some((s) => s.depth === 2), 'nesting depth carried through');
  assert.match(hit.subagents[0].snippet ?? '', /breaking/);

  assert.equal(idx.search(terms('breaking'), { includeSubagents: false }).length, 0, 'filter: top-level only');
});

test('parent and subagent both matching show both', async () => {
  const root = tmpProjects();
  writeSession(root, 'fff', [user('benchmark the parser')]);
  writeSubagent(root, 'fff', 'b1', [user('profile the parser hot path', { isSidechain: true })], { description: 'Profile parser' });
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  const [hit] = idx.search(terms('parser'), { includeSubagents: true });
  assert.match(hit.promptSnippet ?? '', /benchmark the parser/);
  assert.equal(hit.subagents[0].label, 'Profile parser');
});

test('results are newest first, and excluded sessions are left out', async () => {
  const root = tmpProjects();
  writeSession(root, 'old', [user('deploy notes')], new Date('2026-01-01'));
  writeSession(root, 'new', [user('deploy checklist')], new Date('2026-09-01'));
  writeSession(root, 'mid', [user('deploy script')], new Date('2026-05-01'));
  const idx = new HistoryIndex(root, undefined);
  await idx.refresh();
  assert.deepEqual(idx.search(terms('deploy'), { includeSubagents: true }).map((h) => h.sessionId), ['new', 'mid', 'old']);
  assert.deepEqual(
    idx.search(terms('deploy'), { includeSubagents: true, exclude: new Set(['new']) }).map((h) => h.sessionId),
    ['mid', 'old'],
    'sessions already on the dashboard are excluded',
  );
});

test('the on-disk cache restores the index without rescanning', async () => {
  const root = tmpProjects();
  const cache = path.join(tmpProjects(), 'index.json');
  writeSession(root, 'ggg', [user('cache me if you can')]);
  const first = new HistoryIndex(root, cache);
  await first.refresh();
  assert.ok(fs.existsSync(cache));

  const progress: number[] = [];
  const second = new HistoryIndex(root, cache, (s) => progress.push(s.total - s.indexed));
  await second.refresh();
  assert.equal(progress[0], 0, 'nothing left to index on start');
  assert.equal(second.search(terms('cache'), { includeSubagents: true }).length, 1);
});

test('excerpt centres on the first match', () => {
  const long = `${'a '.repeat(200)}needle ${'b '.repeat(200)}`;
  const e = excerpt(long, ['needle']);
  assert.ok(e.startsWith('…') && e.endsWith('…'));
  assert.match(e, /needle/);
  assert.ok(e.length < 200);
});

test('paging: all results up to the threshold, a short list of 25 above it', () => {
  assert.equal(initialVisible(150, 150), 150);
  assert.equal(initialVisible(151, 150), 25);
  assert.equal(initialVisible(12, 150), 12);
  assert.equal(needsExpand(340, 150, false), true);
  assert.equal(needsExpand(340, 150, true), false);
  assert.equal(needsExpand(150, 150, false), false);
  assert.equal(clampThreshold(50), 100);
  assert.equal(clampThreshold(500), 200);
  assert.equal(clampThreshold(undefined), 150);
});
