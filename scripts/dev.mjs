#!/usr/bin/env node
// Cross-platform `BAC_DEV=1 node apps/cli/dist/index.js`. The inline env-var
// assignment doesn't work in cmd.exe, so we spawn the CLI with BAC_DEV set in
// the child's environment. Pure Node, no cross-env dependency.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const target = path.join('apps', 'cli', 'dist', 'index.js');
const r = spawnSync(process.execPath, [target, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, BAC_DEV: '1' },
});
process.exit(r.status ?? 1);
