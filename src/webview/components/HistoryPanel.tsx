import { useEffect, useRef, useState } from 'react';
import type { HistoryHit, HistoryIndexStatus, HostMessage } from '../../shared/types';
import { PAGE_SIZE, initialVisible, needsExpand } from '../historyPaging';
import { post } from '../vscodeApi';
import { HistoryRow } from './HistoryRow';

interface Props {
  query: string;
  terms: string[];
  includeSubagents: boolean;
  onIncludeSubagents(value: boolean): void;
  threshold: number;
  now: number;
}

const DEBOUNCE_MS = 200;
let nextRequestId = 1;

/** Past sessions matching the search, from the host's history index. */
export function HistoryPanel({ query, terms, includeSubagents, onIncludeSubagents, threshold, now }: Props) {
  const [hits, setHits] = useState<HistoryHit[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<HistoryIndexStatus>();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generation, setGeneration] = useState(0);
  const latest = useRef(0);
  const wasDone = useRef<boolean>();
  const sentinel = useRef<HTMLDivElement>(null);

  const request = (offset: number, limit: number) => {
    const requestId = nextRequestId++;
    latest.current = requestId;
    setLoading(true);
    post({ type: 'historySearch', requestId, query, includeSubagents, offset, limit });
  };

  // New query, filter or index generation: start over with the first page (up to the threshold).
  useEffect(() => {
    setExpanded(false);
    const t = setTimeout(() => request(0, threshold), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, includeSubagents, threshold, generation]);

  useEffect(() => {
    const track = (s: HistoryIndexStatus) => {
      // Indexing just finished: everything is searchable now, so run the query again.
      if (s.done && wasDone.current === false) setGeneration((g) => g + 1);
      wasDone.current = s.done;
      setStatus(s);
    };
    const onMessage = (event: MessageEvent<HostMessage>) => {
      const m = event.data;
      if (m?.type === 'historyResults' && m.requestId === latest.current) {
        setHits((prev) => (m.offset === 0 ? m.hits : [...prev.slice(0, m.offset), ...m.hits]));
        setTotal(m.total);
        setLoading(false);
        track(m.status);
      } else if (m?.type === 'historyStatus') {
        track(m.status);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Extended list: load the next page when the end of the list scrolls into view.
  const hasMore = expanded && hits.length < total;
  useEffect(() => {
    if (!hasMore || !sentinel.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !loading) request(hits.length, PAGE_SIZE);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, hits.length, loading]);

  const visible = expanded ? hits : hits.slice(0, initialVisible(total, threshold));
  const indexing = status && !status.done;
  const summary =
    total === 0
      ? indexing
        ? 'Searching…'
        : 'No past sessions match.'
      : needsExpand(total, threshold, expanded)
        ? `Showing ${visible.length} of ${total} matches, most recent first`
        : `${total} past session${total === 1 ? '' : 's'} match`;

  return (
    <section className="history" aria-label="Past sessions">
      <header className="history-head">
        <h2>From history</h2>
        <span className="history-summary" aria-live="polite">
          {summary}
        </span>
        <label className="history-filter">
          <input type="checkbox" checked={includeSubagents} onChange={(e) => onIncludeSubagents(e.target.checked)} />
          Include subagents
        </label>
      </header>

      {indexing ? (
        <p className="history-indexing">
          Indexing history… {status.indexed} of {status.total} transcripts. Results update when it finishes.
        </p>
      ) : null}

      <div className="history-list">
        {visible.map((hit) => (
          <HistoryRow
            key={hit.sessionId}
            hit={hit}
            terms={terms}
            now={now}
            onOpen={(h) => post({ type: 'openHistory', ref: h })}
            onCopyResume={(h) => post({ type: 'copyHistoryResume', ref: h })}
          />
        ))}
      </div>

      {needsExpand(total, threshold, expanded) ? (
        <button className="history-expand" onClick={() => setExpanded(true)}>
          Show all {total} results
        </button>
      ) : null}
      {hasMore ? (
        <div ref={sentinel} className="history-loading">
          {loading ? 'Loading more…' : (
            <button className="link-button inline" onClick={() => request(hits.length, PAGE_SIZE)}>
              Load more
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
