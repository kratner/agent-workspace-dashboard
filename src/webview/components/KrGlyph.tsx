// The KR mark from the brand kit (github.com/kratner/kr-brand, src/brand.mjs). Drawn in
// currentColor so the stylesheet decides its color per appearance.
const GLYPH_PATH =
  'M22 75 H136 L198 169 V75 H330 C402 75 429 108 429 170 C429 228 404 258 356 265 ' +
  'L441 388 H345 L277 289 V388 H198 V283 L126 388 H21 L141 231 Z ' +
  'M278 145 H322 A25.5 25.5 0 0 1 322 196 H278 Z';

export function KrGlyph() {
  return (
    <svg className="kr-glyph" viewBox="21 75 420 313" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" d={GLYPH_PATH} />
    </svg>
  );
}
