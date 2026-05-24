#!/usr/bin/env node
import { startServer } from './server.js';
import open from 'open';

const DEFAULT_PORT = 3131;

function parseFlags() {
  const args = process.argv.slice(2);
  const has = (name: string, alias?: string) =>
    args.includes(name) || (alias ? args.includes(alias) : false);
  const val = (name: string, alias?: string): string | undefined => {
    const idx = args.findIndex((a) => a === name || a === alias);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const port = Number(val('--port', '-p')) || Number(process.env.PORT) || DEFAULT_PORT;
  const noOpen = has('--no-open') || process.env.BAC_NO_OPEN === '1';
  const quiet = has('--quiet', '-q');
  // Anti-cheat mode. ON by default since v0.1: a non-trusted POST to
  // /act or /interact (i.e. anything that didn't come from a real browser
  // event) is rejected outright. Opt out with `--no-strict` or
  // BAC_STRICT=0 only when intentionally running scripts.
  const strict =
    !has('--no-strict') &&
    process.env.BAC_STRICT !== '0' &&
    process.env.BAC_STRICT !== 'false';
  const dev = has('--dev') || process.env.BAC_DEV === '1';
  const help = has('--help', '-h');
  return { port, noOpen, quiet, strict, dev, help };
}

/**
 * Try to bind the human server to `initialPort`, falling back to +1, +2, … if
 * something's already there. We only need to retry the human port — the agent
 * port is asked for as 0 and the OS picks a free one for us.
 */
async function tryStart(
  initialPort: number,
  opts: { strict: boolean; quiet: boolean; dev: boolean },
): Promise<{
  humanPort: number;
  agentPort: number;
  packSizes: { short: number; intermediary: number; long: number };
}> {
  let port = initialPort;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await startServer(port, {
        strict: opts.strict,
        quiet: opts.quiet,
        dev: opts.dev,
      });
      return {
        humanPort: result.humanPort,
        agentPort: result.agentPort,
        packSizes: result.packSizes,
      };
    } catch (err: any) {
      if (err?.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${port} is in use. Trying ${port + 1}...`);
        port += 1;
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Could not find a free port starting at ${initialPort}`);
}

function printHelp() {
  console.log(`Browser Agent Chaos — the evil website test suite for AI browser agents.

Usage:
  npx browser-agent-chaos [options]

The server boots on TWO ports:
  - a human port (default 3131, configurable) for the landing page, dashboard
    and score viewer;
  - an agent port (random ephemeral) for /start, /task/*, and every API the
    agent needs. The agent port changes on every restart so an agent can't
    hardcode it across sessions, and the dashboard is unreachable from it.

Options:
  -p, --port <n>     Human port (default 3131; tries +1 if busy). The agent
                     port is always random.
      --no-open      Don't open the browser
      --no-strict    Disable anti-cheat: accept POSTs to /act and /interact
                     with isTrusted=true from any source (useful when running
                     your own scripted client against the API). Default: strict
                     mode is ON — synthetic clicks are rejected.
      --dev          Reveal the challenge grid on the landing page (for play-
                     testing). Off by default so agents can't enumerate ids.
  -q, --quiet        Less console output
  -h, --help         Show this help

Environment variables:
  BAC_STRICT=0      shorthand for --no-strict
  BAC_DEV=1         shorthand for --dev
`);
}

function printBanner(
  humanUrl: string,
  agentUrl: string,
  packSizes: { short: number; intermediary: number; long: number },
) {
  const line = '─'.repeat(58);
  // Pad the per-pack count so the three lines align even when totals grow.
  const widest = Math.max(
    String(packSizes.short).length,
    String(packSizes.intermediary).length,
    String(packSizes.long).length,
  );
  const fmt = (n: number) =>
    `(${String(n).padStart(widest)} challenges)`;
  console.log('');
  console.log(`╭${line}╮`);
  console.log(`│  Browser Agent Chaos                                     │`);
  console.log(`│  The evil website test suite for AI browser agents.      │`);
  console.log(`╰${line}╯`);
  console.log('');
  console.log('  Agent — paste one of these into your agent:');
  console.log('');
  console.log(`    short        ${fmt(packSizes.short)}  →  start challenge: ${agentUrl}/start?pack=short`);
  console.log(`    intermediary ${fmt(packSizes.intermediary)}  →  start challenge: ${agentUrl}/start?pack=intermediary`);
  console.log(`    long         ${fmt(packSizes.long)}  →  start challenge: ${agentUrl}/start?pack=long`);
  console.log('');
  console.log('  Human — open in your browser:');
  console.log('');
  console.log(`    Landing:   ${humanUrl}`);
  console.log(`    Dashboard: ${humanUrl}/dashboard`);
  console.log('');
  console.log('  Agent port is random and changes every restart.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
}

async function main() {
  const { port, noOpen, quiet, strict, dev, help } = parseFlags();
  if (help) {
    printHelp();
    return;
  }
  const { humanPort, agentPort, packSizes } = await tryStart(port, {
    strict,
    quiet,
    dev,
  });
  const humanUrl = `http://localhost:${humanPort}`;
  const agentUrl = `http://localhost:${agentPort}`;
  if (!quiet) printBanner(humanUrl, agentUrl, packSizes);
  else
    console.log(
      `browser-agent-chaos · human=${humanUrl} · agent=${agentUrl}`,
    );
  if (!strict && !quiet) {
    console.log('  ⚠  --no-strict mode: synthetic clicks (isTrusted=false) are accepted.');
    console.log('');
  }
  if (dev && !quiet) {
    console.log('  🔧 --dev mode: challenge grid is visible on the landing page.');
    console.log('');
  }

  if (!noOpen) {
    // Open the human URL only — the agent URL is just an API surface.
    open(humanUrl).catch(() => {
      /* ignore */
    });
  }
}

main().catch((err) => {
  console.error('Failed to start Browser Agent Chaos:', err);
  process.exit(1);
});
