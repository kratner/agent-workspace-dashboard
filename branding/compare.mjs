// Checks a vector reproduction against the raster it was traced from.
//   npm run brand:compare -- <reference.png> <mark.svg> [diff.png]
// Prints how much of the foreground overlaps (IoU) and the rows that differ most, and
// optionally writes a diff image: red = only in the reference, cyan = only in the SVG.
// Foreground = saturated yellow, which is what the GitHub avatar uses; adjust isForeground
// for a mark in another color.
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const [refPath, svgPath, diffPath] = process.argv.slice(2);
if (!refPath || !svgPath) {
  console.error('usage: npm run brand:compare -- <reference.png> <mark.svg> [diff.png]');
  process.exit(1);
}

const ref = PNG.sync.read(readFileSync(refPath));
const { width: W, height: H } = ref;
const svg = new Resvg(readFileSync(svgPath, 'utf8'), { fitTo: { mode: 'width', value: W } }).render().asPng();
const mine = PNG.sync.read(Buffer.from(svg));

const isForeground = (d, i) => d[i + 3] > 128 && d[i] > 180 && d[i + 1] > 170 && d[i + 2] < 120;

const diff = new PNG({ width: W, height: H });
let both = 0;
let onlyRef = 0;
let onlyMine = 0;
const rowErrors = new Map();
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const a = isForeground(ref.data, i);
    const b = isForeground(mine.data, i);
    let rgb = [0, 0, 0];
    if (a && b) {
      both++;
      rgb = [90, 90, 40];
    } else if (a || b) {
      if (a) onlyRef++;
      else onlyMine++;
      rgb = a ? [255, 40, 40] : [40, 220, 255];
      rowErrors.set(y, (rowErrors.get(y) ?? 0) + 1);
    }
    diff.data.set([...rgb, 255], i);
  }
}

const iou = (both / (both + onlyRef + onlyMine)) * 100;
console.log(`foreground IoU ${iou.toFixed(2)}%  only in reference ${onlyRef}px  only in SVG ${onlyMine}px`);
const worst = [...rowErrors].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`rows that differ most: ${worst.map(([y, n]) => `y${y} (${n})`).join(', ') || 'none'}`);
if (diffPath) {
  writeFileSync(diffPath, PNG.sync.write(diff));
  console.log(`diff image: ${diffPath}`);
}
