import { useEffect, useState } from 'react';
import type { AgentSession, DashboardState, HostMessage } from '../../shared/types';
import { VIEWS, findView } from '../viewRegistry';
import { KrGlyph } from './KrGlyph';
import { log, post } from '../vscodeApi';

const TICK_MS = 15_000;

export function ViewManager() {
  const [state, setState] = useState<DashboardState>();
  const [viewId, setViewId] = useState<string>();
  const [now, setNow] = useState(Date.now());

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

  const appearance = state?.appearance ?? 'brand';
  useEffect(() => {
    document.body.dataset.appearance = appearance;
  }, [appearance]);

  const view = findView(viewId);
  const selectView = (id: string) => {
    setViewId(id);
    post({ type: 'setView', viewId: id });
  };
  const actions = {
    onOpen: (s: AgentSession) => post({ type: 'open', key: s.key }),
    onCopyResume: (s: AgentSession) => post({ type: 'copyResume', key: s.key }),
  };

  const sessions = state?.sessions ?? [];
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
        <div className="summary">
          {state ? (
            <>
              <span className="pill state-waiting">{count('waiting')} waiting</span>
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
        ) : sessions.length === 0 ? (
          <p className="placeholder">No {state.sources.join(' or ')} sessions are running or ended recently.</p>
        ) : (
          <View sessions={sessions} now={now} {...actions} />
        )}
      </main>
    </div>
  );
}
