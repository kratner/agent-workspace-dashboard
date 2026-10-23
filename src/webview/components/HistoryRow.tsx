import { useState } from 'react';
import type { HistoryHit } from '../../shared/types';
import { folderName, shortDate } from '../format';
import { Highlight } from './Highlight';

interface Props {
  hit: HistoryHit;
  terms: string[];
  now: number;
  onOpen(hit: HistoryHit): void;
  onCopyResume(hit: HistoryHit): void;
}

const where = (depth: number) => (depth > 1 ? 'subagent of a subagent' : 'subagent');

/** One past session. Matches inside subagents show under it, never as their own row. */
export function HistoryRow({ hit, terms, now, onOpen, onCopyResume }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [first, ...more] = hit.subagents;
  const subs = showAll ? hit.subagents : first ? [first] : [];

  return (
    <article
      className="hist-row"
      role="button"
      tabIndex={0}
      title={hit.cwd}
      onClick={() => onOpen(hit)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(hit);
        }
      }}
    >
      <div className="hist-head">
        <span className="hist-title">
          <Highlight text={hit.title} terms={terms} />
        </span>
        <span className="hist-meta">
          <span>
            <Highlight text={folderName(hit.cwd)} terms={terms} />
          </span>
          <span>{shortDate(hit.lastActivity, now)}</span>
          <button
            className="link-button"
            title="Copy a terminal command that resumes this session"
            onClick={(e) => {
              e.stopPropagation();
              onCopyResume(hit);
            }}
          >
            Copy resume
          </button>
        </span>
      </div>

      {hit.promptSnippet ? (
        <div className="hist-snippet">
          <Highlight text={hit.promptSnippet} terms={terms} />
        </div>
      ) : null}

      {subs.map((s) => (
        <div className="hist-sub" key={s.agentId}>
          <div className="hist-sub-label">
            <span className="hist-sub-arrow" aria-hidden="true">
              ↳
            </span>
            Found in {where(s.depth)}: <strong>{s.label}</strong>
            {s.agentType && s.agentType !== s.label ? <span className="hist-sub-type"> ({s.agentType})</span> : null}
          </div>
          {s.snippet ? (
            <div className="hist-snippet">
              <Highlight text={s.snippet} terms={terms} />
            </div>
          ) : null}
        </div>
      ))}

      {more.length > 0 ? (
        <button
          className="link-button hist-more"
          aria-expanded={showAll}
          onClick={(e) => {
            e.stopPropagation();
            setShowAll((v) => !v);
          }}
        >
          {showAll ? 'Show fewer subagents' : `+${more.length} more subagent${more.length === 1 ? '' : 's'}`}
        </button>
      ) : null}
    </article>
  );
}
