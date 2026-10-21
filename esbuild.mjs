// One build script for both bundles: the extension host (Node) and the webview (browser).
//   node esbuild.mjs               development build with sourcemaps
//   node esbuild.mjs --watch       rebuild on change
//   node esbuild.mjs --production  clean, minified build + dependency-leak check
import * as esbuild from 'esbuild';
import { rmSync } from 'node:fs';
import { builtinModules } from 'node:module';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  minify: production,
  sourcemap: !production,
  metafile: true,
  legalComments: 'none',
  logLevel: 'info',
};

const host = {
  ...common,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['vscode'],
};

const webview = {
  ...common,
  entryPoints: ['src/webview/main.tsx'],
  outfile: 'dist/webview.js',
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': JSON.stringify(production ? 'production' : 'development') },
};

const builtins = new Set(builtinModules);
const isNodeBuiltin = (p) => p.startsWith('node:') || builtins.has(p) || builtins.has(p.split('/')[0]);

// The packaged extension ships no node_modules, so any import left unbundled would fail at runtime.
// The host may only import `vscode` and Node built-ins; the webview may import nothing at all.
function checkLeaks(label, metafile, isAllowed) {
  const leaks = [];
  for (const [file, output] of Object.entries(metafile.outputs)) {
    for (const imp of output.imports) {
      if (imp.external && !isAllowed(imp.path)) leaks.push(`${file} -> ${imp.path}`);
    }
  }
  if (leaks.length) {
    console.error(`\n✖ ${label}: unbundled imports would be missing at runtime:\n  ${leaks.join('\n  ')}`);
    return false;
  }
  console.log(`✔ ${label}: no dependency leaks`);
  return true;
}

if (watch) {
  const contexts = await Promise.all([esbuild.context(host), esbuild.context(webview)]);
  await Promise.all(contexts.map((ctx) => ctx.watch()));
} else {
  if (production) rmSync('dist', { recursive: true, force: true });
  const [hostResult, webviewResult] = await Promise.all([esbuild.build(host), esbuild.build(webview)]);
  const ok = [
    checkLeaks('extension host', hostResult.metafile, (p) => p === 'vscode' || isNodeBuiltin(p)),
    checkLeaks('webview', webviewResult.metafile, () => false),
  ].every(Boolean);
  if (!ok) process.exit(1);
}
