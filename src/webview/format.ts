import type { SessionState } from '../shared/types';

export const STATES: { id: SessionState; label: string }[] = [
  { id: 'waiting', label: 'Waiting on you' },
  { id: 'busy', label: 'Working' },
  { id: 'idle', label: 'Idle' },
  { id: 'ended', label: 'Ended' },
];

export const stateLabel = (state: SessionState) => STATES.find((s) => s.id === state)?.label ?? state;

export function timeAgo(ts: number | undefined, now: number): string {
  if (!ts) return '';
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const DAY_MS = 86_400_000;

/** Relative within a week ("3h ago"), otherwise a date ("Oct 3", or "Oct 3, 2025" in another year). */
export function shortDate(ts: number, now: number): string {
  if (!ts) return '';
  if (now - ts < 7 * DAY_MS) return timeAgo(ts, now);
  const d = new Date(ts);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date(now).getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(undefined, opts);
}

export function folderName(cwd: string | undefined): string {
  if (!cwd) return '';
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? cwd;
}
