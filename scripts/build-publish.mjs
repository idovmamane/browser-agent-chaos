#!/usr/bin/env node
/**
 * Produce a single self-contained publish bundle under `dist/`:
 *   dist/cli.mjs    — esbuild bundle of the CLI (workspace packages inlined,
 *                     npm deps left external for npm install to resolve)
 *   dist/web/       — vite build output (the SPA the server serves)
 *
 * Run after `pnpm build`. The resulting layout is what gets shipped to npm
 * via the `files` field in package.json, so `npx browser-agent-chaos` works
 * with no monorepo machinery on the consumer side.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync, writeFileSync, readFileSync, chmodSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distRoot = path.join(root, 'dist');
const cliEntry = path.join(root, 'apps/cli/dist/index.js');
const webDist = path.join(root, 'apps/web/dist');

if (!existsSync(cliEntry)) {
  console.error('error: apps/cli/dist/index.js missing — run `pnpm build` first');
  process.exit(1);
}
if (!existsSync(webDist)) {
  console.error('error: apps/web/dist missing — run `pnpm build` first');
  process.exit(1);
}

rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });

// Bundle CLI
const esbuildArgs = [
  cliEntry,
  '--bundle',
  '--platform=node',
  '--target=node18',
  '--format=esm',
  `--outfile=${path.join(distRoot, 'cli.mjs')}`,
  '--external:fastify',
  '--external:@fastify/static',
  '--external:nanoid',
  '--external:open',
  '--external:bytenode',
];
const r = spawnSync(path.join(root, 'node_modules/.bin/esbuild'), esbuildArgs, {
  stdio: 'inherit',
});
if (r.status !== 0) process.exit(r.status ?? 1);

// Prepend shebang
const cliOut = path.join(distRoot, 'cli.mjs');
const src = readFileSync(cliOut, 'utf8').replace(/^#!.*\n/, '');
writeFileSync(cliOut, '#!/usr/bin/env node\n' + src);
chmodSync(cliOut, 0o755);

// Copy web dist next to it (the SPA the server serves)
cpSync(webDist, path.join(distRoot, 'web'), { recursive: true });

// Strip Pages-only artifacts from the npm bundle:
//   - 404.html: only useful for GitHub Pages SPA fallback
//   - static-dataset.json: only consumed by the static-demo build
for (const name of ['404.html', 'static-dataset.json']) {
  const p = path.join(distRoot, 'web', name);
  if (existsSync(p)) unlinkSync(p);
}

console.log('publish bundle ready:');
spawnSync('ls', ['-la', distRoot], { stdio: 'inherit' });
spawnSync('du', ['-sh', distRoot], { stdio: 'inherit' });
