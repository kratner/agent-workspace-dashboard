import { useEffect, useMemo, useRef, useState } from 'react';
import type { AgentSession, DashboardState, HostMessage } from '../../shared/types';
import { filterSessions, searchTerms } from '../search';
import { VIEWS, findView } from '../viewRegistry';
import { KrGlyph } from './KrGlyph';
import { getUiState, log, post, setUiState } from '../vscodeApi';

const TICK_MS = 15_000;

export function ViewManager() {
  const [state, setState] = useState<DashboardState>();
  const [viewId, setViewId] = useState<string>();
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState(() => getUiState().query ?? '');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let first = true;
    const onMessage = (event: MessageEvent<HostMessage>) => {
      if (event.data?.type !== 'state') return;
      if (first) {
        first = false;
        log('info', `first state received: ${event.data.sessions.length} sessions`);
      }
      setState(event.data);
      setNow(Date.now());
      // The saved view only applies on first load; after that the user's choice in this tab wins.
      setViewId((current) => current ?? event.data.viewId);
    };
    window.addEventListener('message', onMessage);
    log('info', 'webview script running; sending ready');
    post({ type: 'ready' });
    const tick = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearInterval(tick);
    };
  }, []);

  // "/" or Ctrl/Cmd+F jumps to search; the webview has no find widget of its own to collide with.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const find = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f';
      if (find || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const appearance = state?.appearance ?? 'brand';
  useEffect(() => {
    document.body.dataset.appearance = appearance;
  }, [appearance]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setUiState({ query: value });
  };

  const view = findView(viewId);
  const selectView = (id: string) => {
    setViewId(id);
    post({ type: 'setView', viewId: id });
  };
  const actions = {
    onOpen: (s: AgentSession) => post({ type: 'open', key: s.key }),
    onCopyResume: (s: AgentSession) => post({ type: 'copyResume', key: s.key }),
  };

  const allSessions = state?.sessions ?? [];
  const terms = useMemo(() => searchTerms(query), [query]);
  const sessions = useMemo(() => filterSessions(allSessions, terms), [allSessions, terms]);
  const searching = terms.length > 0;
  const count = (st: AgentSession['state']) => sessions.filter((s) => s.state === st).length;
  const View = view.component;

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand">
          <KrGlyph />
          <h1>Agent Workspace</h1>
        </div>
        <div className="tabs" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              role="tab"
              aria-selected={v.id === view.id}
              className={v.id === view.id ? 'tab active' : 'tab'}
              onClick={() => selectView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder="Search sessions  ( / )"
            aria-label="Search sessions"
            spellCheck={false}
            onChange={(e) => updateQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                updateQuery('');
                e.currentTarget.blur();
              }
            }}
          />
          {searching && state ? (
            <span className="search-count" aria-live="polite">
              {sessions.length} of {allSessions.length}
            </span>
          ) : null}
        </div>
        <div className="summary">
          {state ? (
            <>
              <span className={count('waiting') ? 'pill state-waiting nonzero' : 'pill state-waiting'}>{count('waiting')} waiting</span>
              <span className="pill state-busy">{count('busy')} working</span>
              <span className="pill state-idle">{count('idle')} idle</span>
            </>
          ) : null}
          <button className="icon-button" title="Refresh" aria-label="Refresh" onClick={() => post({ type: 'refresh' })}>
            ↻
          </button>
        </div>
      </header>
      <main className="content">
        {!state ? (
          <p className="placeholder">Loading sessions…</p>
        ) : allSessions.length === 0 ? (
          <p className="placeholder">No {state.sources.join(' or ')} sessions are running or ended recently.</p>
        ) : searching && sessions.length === 0 ? (
          <p className="placeholder">
            No sessions match “{query.trim()}”.{' '}
            <button className="link-button inline" onClick={() => updateQuery('')}>
              Clear search
            </button>
          </p>
        ) : (
          <View sessions={sessions} now={now} terms={terms} {...actions} />
        )}
      </main>
    </div>
  );
}
