/**
 * Post-build: rewrite "/media/..." URLs inside the static export (out/)
 * to point at the CDN origin when CDN_MEDIA_BASE is set.
 *
 * - No env var → no-op (local dev and default builds are untouched).
 * - Handles plain quotes and the escaped quotes inside RSC payloads.
 *
 * Usage: CDN_MEDIA_BASE=https://media.example.com node scripts/apply-cdn-base.mjs
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';

const base = (process.env.CDN_MEDIA_BASE || '').replace(/\/+$/, '');
if (!base) {
  console.log('[cdn] CDN_MEDIA_BASE not set — keeping /media/ URLs as-is.');
  process.exit(0);
}

const OUT = new URL('../out/', import.meta.url).pathname;
const TEXT_EXT = new Set(['.html', '.js', '.css', '.json', '.txt', '.map']);
// URL contexts in which /media/ appears: "..." '...' \"...\" (/media/...)
const PATTERNS = [
  [/(\")\/media\//g, `$1${base}/media/`],
  [/(')\/media\//g, `$1${base}/media/`],
  [/\\(")\/media\//g, `\\$1${base}/media/`],
  [/(\()\/media\//g, `$1${base}/media/`],
];

let files = 0;
let hits = 0;

async function walk(dir) {
  for (const entry of await readdir(dir)) {
    const p = join(dir, entry);
    if ((await stat(p)).isDirectory()) {
      await walk(p);
      continue;
    }
    if (!TEXT_EXT.has(extname(entry))) continue;
    const src = await readFile(p, 'utf8');
    if (!src.includes('/media/')) continue;
    let out = src;
    for (const [re, to] of PATTERNS) out = out.replace(re, to);
    if (out !== src) {
      await writeFile(p, out);
      files += 1;
      hits += (src.match(/\/media\//g) || []).length;
    }
  }
}

await walk(OUT);
console.log(`[cdn] rewrote /media/ → ${base}/media/ in ${files} files (${hits} references).`);
