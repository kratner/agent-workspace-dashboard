import { folderName, stateLabel, timeAgo } from '../format';
import type { ViewProps } from '../viewRegistry';
import { Highlight } from './Highlight';

export function ListView({ sessions, now, terms, onOpen, onCopyResume }: ViewProps) {
  return (
    <table className="list">
      <thead>
        <tr>
          <th>State</th>
          <th>Session</th>
          <th>Folder</th>
          <th>Where</th>
          <th>Last activity</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {sessions.map((s) => (
          <tr key={s.key} className={`state-${s.state}`} tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s)}>
            <td>
              <span className="state-cell" title={s.waitingFor ? `Waiting for: ${s.waitingFor}` : undefined}>
                <span className="dot" />
                {stateLabel(s.state)}
                {s.state === 'waiting' && s.waitingFor ? <span className="state-reason">· {s.waitingFor}</span> : null}
              </span>
            </td>
            <td className="title-cell" title={s.lastPrompt}>
              <Highlight text={s.title} terms={terms} />
              {/* The list has no prompt column; while searching, show the prompt if that's where it matched. */}
              {s.lastPrompt && terms.some((t) => s.lastPrompt!.toLowerCase().includes(t)) ? (
                <span className="row-prompt">
                  <Highlight text={s.lastPrompt} terms={terms} />
                </span>
              ) : null}
            </td>
            <td title={s.cwd}>
              <Highlight text={folderName(s.cwd)} terms={terms} />
            </td>
            <td>
              <Highlight text={s.surface ?? s.sourceLabel} terms={terms} />
            </td>
            <td>{timeAgo(s.updatedAt, now)}</td>
            <td>
              {s.state === 'ended' ? (
                <button
                  className="link-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopyResume(s);
                  }}
                >
                  Copy resume
                </button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
