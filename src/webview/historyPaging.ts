// How many history results to show, per the roadmap: everything up to the threshold;
// above it, a short list first, then the rest in pages once the user asks for all.

export const SHORT_LIST = 25;
export const PAGE_SIZE = 100;
export const DEFAULT_THRESHOLD = 150;

export function clampThreshold(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_THRESHOLD;
  return Math.min(200, Math.max(100, Math.round(value)));
}

/** Results to show before the user expands. */
export function initialVisible(total: number, threshold: number): number {
  return total > threshold ? Math.min(SHORT_LIST, total) : total;
}

/** Whether to offer "Show all N results". */
export function needsExpand(total: number, threshold: number, expanded: boolean): boolean {
  return !expanded && total > threshold;
}
