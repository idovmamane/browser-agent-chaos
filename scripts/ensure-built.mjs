#!/usr/bin/env node
// Cross-platform replacement for `test -f apps/cli/dist/index.js || pnpm build`.
// Used by the root `prestart` and `predev` hooks so the user can `pnpm start`
// from a fresh clone without thinking about it. Pure Node, no shell, no deps.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const target = path.join('apps', 'cli', 'dist', 'index.js');
if (existsSync(target)) process.exit(0);

// pnpm on Windows is a .cmd shim, not a native binary. spawnSync with
// shell:false needs the full filename on win32.
const pm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const r = spawnSync(pm, ['build'], { stdio: 'inherit', shell: false });
process.exit(r.status ?? 1);
