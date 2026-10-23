import { highlightParts } from '../search';

/** Renders `text` with the search terms marked. */
export function Highlight({ text, terms }: { text: string | undefined; terms: string[] }) {
  if (!text) return null;
  return (
    <>
      {highlightParts(text, terms).map((part, i) => (part.match ? <mark key={i}>{part.text}</mark> : part.text))}
    </>
  );
}
