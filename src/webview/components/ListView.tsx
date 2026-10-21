import { folderName, stateLabel, timeAgo } from '../format';
import type { ViewProps } from '../viewRegistry';

export function ListView({ sessions, now, onOpen, onCopyResume }: ViewProps) {
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
            <td className="state-cell">
              <span className="dot" />
              {stateLabel(s.state)}
            </td>
            <td className="title-cell" title={s.lastPrompt}>
              {s.title}
            </td>
            <td title={s.cwd}>{folderName(s.cwd)}</td>
            <td>{s.surface ?? s.sourceLabel}</td>
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
