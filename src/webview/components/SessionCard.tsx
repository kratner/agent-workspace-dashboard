import type { KeyboardEvent } from 'react';
import type { AgentSession } from '../../shared/types';
import { folderName, timeAgo } from '../format';
import { Highlight } from './Highlight';

interface Props {
  session: AgentSession;
  now: number;
  terms: string[];
  onOpen(session: AgentSession): void;
  onCopyResume(session: AgentSession): void;
}

export function SessionCard({ session, now, terms, onOpen, onCopyResume }: Props) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(session);
    }
  };
  return (
    <article
      className={`card state-${session.state}`}
      role="button"
      tabIndex={0}
      title={session.cwd}
      onClick={() => onOpen(session)}
      onKeyDown={onKeyDown}
    >
      <div className="card-title">
        <Highlight text={session.title} terms={terms} />
      </div>
      {session.lastPrompt ? (
        <div className="card-prompt">
          <Highlight text={session.lastPrompt} terms={terms} />
        </div>
      ) : null}
      <div className="card-meta">
        <span className="folder">
          <Highlight text={folderName(session.cwd)} terms={terms} />
        </span>
        {session.surface ? (
          <span className="badge">
            <Highlight text={session.surface} terms={terms} />
          </span>
        ) : null}
        <span className="time">{timeAgo(session.updatedAt, now)}</span>
        {session.state === 'ended' ? (
          <button
            className="link-button"
            title="Copy a terminal command that resumes this session"
            onClick={(e) => {
              e.stopPropagation();
              onCopyResume(session);
            }}
          >
            Copy resume
          </button>
        ) : null}
      </div>
    </article>
  );
}
