// Renders every SVG in branding/icon to PNGs in branding/preview, plus a
// contact sheet (preview/sheet.png) showing each mark at 128/32/16 px on dark and light
// backgrounds, which is how they'll actually be seen.
//   npm run brand
import { Resvg } from '@resvg/resvg-js';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const out = join(root, 'preview');
mkdirSync(out, { recursive: true });

// The concept that ships as the extension's Marketplace / Extensions-view icon (package.json "icon").
const EXTENSION_ICON = 'icon/f-board-indigo.svg';

const render = (svg, width) => new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
const dataUri = (png) => `data:image/png;base64,${png.toString('base64')}`;

const groups = ['icon'].map((dir) => ({
  dir,
  marks: readdirSync(join(root, dir))
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => ({ name: basename(f, '.svg'), svg: readFileSync(join(root, dir, f), 'utf8') })),
}));

const sizes = [128, 32, 16];
const cell = 300;
const rowHeight = 190;
const backgrounds = [
  { label: 'dark', fill: '#1E1E1E', text: '#CCCCCC' },
  { label: 'light', fill: '#F3F3F3', text: '#333333' },
];
const rows = groups.flatMap((g) => backgrounds.map((bg) => ({ ...bg, group: g })));
const cols = Math.max(...groups.map((g) => g.marks.length));
const width = cols * cell;
const height = rows.length * rowHeight;

let body = '';
rows.forEach((row, r) => {
  const y = r * rowHeight;
  body += `<rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${row.fill}"/>`;
  row.group.marks.forEach((mark, c) => {
    const x = c * cell + 20;
    let ix = x;
    for (const size of sizes) {
      const png = render(mark.svg, size * 2);
      if (row.label === 'dark' && size === 128) {
        writeFileSync(join(out, `${row.group.dir}-${mark.name}-128.png`), render(mark.svg, 128));
        writeFileSync(join(out, `${row.group.dir}-${mark.name}-512.png`), render(mark.svg, 512));
      }
      body += `<image x="${ix}" y="${y + 20 + (128 - size)}" width="${size}" height="${size}" href="${dataUri(png)}"/>`;
      ix += size + 16;
    }
    body += `<text x="${x}" y="${y + 172}" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" fill="${row.text}">${row.group.dir}/${mark.name} · ${row.label}</text>`;
  });
});

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
writeFileSync(join(out, 'sheet.png'), new Resvg(sheet, { font: { loadSystemFonts: true } }).render().asPng());
const media = join(root, '..', 'media');
mkdirSync(media, { recursive: true });
writeFileSync(join(media, 'icon.png'), render(readFileSync(join(root, EXTENSION_ICON), 'utf8'), 256));
console.log(`Extension icon: media/icon.png from ${EXTENSION_ICON}`);
console.log(`Rendered ${groups.reduce((n, g) => n + g.marks.length, 0)} marks to ${out}`);
