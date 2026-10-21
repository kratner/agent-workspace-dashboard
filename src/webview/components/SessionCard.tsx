import type { KeyboardEvent } from 'react';
import type { AgentSession } from '../../shared/types';
import { folderName, timeAgo } from '../format';

interface Props {
  session: AgentSession;
  now: number;
  onOpen(session: AgentSession): void;
  onCopyResume(session: AgentSession): void;
}

export function SessionCard({ session, now, onOpen, onCopyResume }: Props) {
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
      <div className="card-title">{session.title}</div>
      {session.lastPrompt ? <div className="card-prompt">{session.lastPrompt}</div> : null}
      <div className="card-meta">
        <span className="folder">{folderName(session.cwd)}</span>
        {session.surface ? <span className="badge">{session.surface}</span> : null}
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
