import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Strip server-only answer keys from challenge source files before bundling.
 *
 * Two surfaces leak the answer:
 *   - v1 `actionSpec: { ... }`  — the correct/wrong list.
 *   - v2 `check: { ... }`       — the stage's success criteria.
 *   - v2 `successMessage: "..."` (server-only success copy).
 *
 * We brace-balance each occurrence inside files under packages/challenges/src.
 */
function stripServerOnly(): Plugin {
  // String-literal keys we always remove (the value is an object/string we
  // strip wholesale).
  const STRING_KEYS = ['actionSpec:', 'check:', 'successMessage:'];
  // Arrow-function keys whose VALUE is `(args) => { ... }`. We must brace-
  // balance through the entire function body — including nested objects.
  const FN_KEYS = ['stageFactory:'];
  return {
    name: 'bac-strip-server-only',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/packages/challenges/src/')) return null;
      const all = [...STRING_KEYS, ...FN_KEYS];
      if (!all.some((k) => code.includes(k))) return null;

      function stripObjectOrStringBlock(src: string, key: string): string {
        const out: string[] = [];
        let i = 0;
        while (i < src.length) {
          const start = src.indexOf(key, i);
          if (start === -1) {
            out.push(src.slice(i));
            break;
          }
          let prev = start - 1;
          while (prev >= 0 && /\s/.test(src[prev])) prev--;
          if (prev >= 0 && src[prev] !== '{' && src[prev] !== ',') {
            out.push(src.slice(i, start + key.length));
            i = start + key.length;
            continue;
          }
          let j = start + key.length;
          while (j < src.length && /\s/.test(src[j])) j++;
          const opener = src[j];
          if (opener !== '{' && opener !== "'" && opener !== '"' && opener !== '`') {
            out.push(src.slice(i, start + key.length));
            i = start + key.length;
            continue;
          }
          let k = j;
          if (opener === '{') {
            let depth = 0;
            for (; k < src.length; k++) {
              const ch = src[k];
              if (ch === '{') depth++;
              else if (ch === '}') {
                depth--;
                if (depth === 0) {
                  k++;
                  break;
                }
              }
            }
          } else {
            const q = opener;
            k = j + 1;
            while (k < src.length) {
              if (src[k] === '\\') { k += 2; continue; }
              if (src[k] === q) { k++; break; }
              k++;
            }
          }
          let after = k;
          while (after < src.length && /[,\s]/.test(src[after])) after++;
          out.push(src.slice(i, start));
          i = after;
        }
        return out.join('');
      }

      // Replace `stageFactory: (args) => { ...body... },` with
      // `stageFactory: undefined,` — preserves the surrounding object grammar
      // while removing the body. We brace-balance through string and template
      // literals so the body's `${…}` and quoted strings don't trip us up.
      function stripArrowFnBlock(src: string, key: string): string {
        const out: string[] = [];
        let i = 0;
        while (i < src.length) {
          const start = src.indexOf(key, i);
          if (start === -1) { out.push(src.slice(i)); break; }
          let prev = start - 1;
          while (prev >= 0 && /\s/.test(src[prev])) prev--;
          if (prev >= 0 && src[prev] !== '{' && src[prev] !== ',') {
            out.push(src.slice(i, start + key.length));
            i = start + key.length;
            continue;
          }
          let j = start + key.length;
          while (j < src.length && /\s/.test(src[j])) j++;
          // Skip `(args)` or single identifier.
          if (src[j] === '(') {
            let depth = 0;
            for (; j < src.length; j++) {
              if (src[j] === '(') depth++;
              else if (src[j] === ')') {
                depth--;
                if (depth === 0) { j++; break; }
              }
            }
          } else {
            while (j < src.length && /[\w$]/.test(src[j])) j++;
          }
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] !== '=' || src[j + 1] !== '>') {
            out.push(src.slice(i, start + key.length));
            i = start + key.length;
            continue;
          }
          j += 2;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] !== '{') {
            out.push(src.slice(i, start + key.length));
            i = start + key.length;
            continue;
          }
          // Brace-balance, but skip strings (single/double/template) and
          // line/block comments.
          let depth = 0;
          let k = j;
          while (k < src.length) {
            const ch = src[k];
            if (ch === '{') { depth++; k++; continue; }
            if (ch === '}') {
              depth--; k++;
              if (depth === 0) break;
              continue;
            }
            if (ch === '/' && src[k + 1] === '/') {
              while (k < src.length && src[k] !== '\n') k++;
              continue;
            }
            if (ch === '/' && src[k + 1] === '*') {
              k += 2;
              while (k < src.length && !(src[k] === '*' && src[k + 1] === '/')) k++;
              k += 2;
              continue;
            }
            if (ch === '"' || ch === "'") {
              const q = ch;
              k++;
              while (k < src.length) {
                if (src[k] === '\\') { k += 2; continue; }
                if (src[k] === q) { k++; break; }
                k++;
              }
              continue;
            }
            if (ch === '`') {
              // template literal — must also handle ${ ... } expressions
              k++;
              while (k < src.length) {
                if (src[k] === '\\') { k += 2; continue; }
                if (src[k] === '`') { k++; break; }
                if (src[k] === '$' && src[k + 1] === '{') {
                  k += 2;
                  let edepth = 1;
                  while (k < src.length && edepth > 0) {
                    if (src[k] === '{') edepth++;
                    else if (src[k] === '}') edepth--;
                    if (edepth > 0) k++;
                  }
                  k++;
                  continue;
                }
                k++;
              }
              continue;
            }
            k++;
          }
          // Replace `stageFactory: (s) => { ... }` with `stageFactory: undefined`,
          // preserving the trailing comma/whitespace as-is so the grammar is
          // never broken.
          out.push(src.slice(i, start));
          out.push('stageFactory: undefined');
          i = k;
        }
        return out.join('');
      }

      let stripped = code;
      for (const k of STRING_KEYS) stripped = stripObjectOrStringBlock(stripped, k);
      for (const k of FN_KEYS) stripped = stripArrowFnBlock(stripped, k);
      return { code: stripped, map: null };
    },
  };
}

export default defineConfig(({ mode }) => ({
  // Pages build: `vite build --mode static-demo`.
  // Local/server build keeps the default base '/'.
  base: mode === 'static-demo' ? '/browser-agent-chaos/' : '/',
  define: {
    __STATIC_DEMO__: JSON.stringify(mode === 'static-demo'),
  },
  plugins: [stripServerOnly(), react()],
  resolve: {
    alias: {
      '@browser-agent-chaos/core': path.resolve(__dirname, '../../packages/core/src'),
      // The `stripActionSpec` Vite plugin (above) strips actionSpec from every
      // module in this package before bundling — so importing the root entry
      // here is safe. We keep this alias pointed at the source tree (not
      // /dist) so Vite tree-shaking and HMR work in dev.
      '@browser-agent-chaos/challenges': path.resolve(
        __dirname,
        '../../packages/challenges/src',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3131',
    },
  },
  build: {
    outDir: mode === 'static-demo' ? 'dist-static' : 'dist',
    emptyOutDir: true,
  },
}));
