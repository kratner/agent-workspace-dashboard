import type { AgentSession } from '../shared/types';
import { stateLabel } from './format';

// Search is plain substring matching, case-insensitive. A query is split on whitespace and a
// session matches when every term appears somewhere in its searchable text, so
// "api waiting" finds the waiting session in the api folder.

export function searchTerms(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

function searchableText(s: AgentSession): string {
  return [s.title, s.lastPrompt, s.cwd, s.surface, s.sourceLabel, stateLabel(s.state), s.state, s.rawStatus]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

export function filterSessions(sessions: AgentSession[], terms: string[]): AgentSession[] {
  if (terms.length === 0) return sessions;
  return sessions.filter((s) => {
    const text = searchableText(s);
    return terms.every((t) => text.includes(t));
  });
}

/** Splits `text` into alternating plain / matched parts for highlighting. */
export function highlightParts(text: string, terms: string[]): { text: string; match: boolean }[] {
  if (!text || terms.length === 0) return [{ text, match: false }];
  const escaped = [...terms].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: terms.includes(part.toLowerCase()) }));
}
