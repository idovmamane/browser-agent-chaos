#!/usr/bin/env node
// Cross-platform replacement for the old `rm -rf` clean script. Removes the
// root node_modules plus every dist/ and node_modules/ under apps/* and
// packages/*. fs.rmSync({recursive,force}) works on macOS, Linux, and Windows.
import { rmSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const roots = ['apps', 'packages'];
const topLevel = ['node_modules'];
const perWorkspace = ['dist', 'node_modules'];

for (const t of topLevel) {
  if (existsSync(t)) rmSync(t, { recursive: true, force: true });
}
for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const child of readdirSync(root)) {
    for (const sub of perWorkspace) {
      const p = path.join(root, child, sub);
      if (existsSync(p)) rmSync(p, { recursive: true, force: true });
    }
  }
}
console.log('clean: done');
