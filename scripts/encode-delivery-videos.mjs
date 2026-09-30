import { existsSync, mkdirSync, renameSync, copyFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

/**
 * Delivery encodes (Safari-safe web):
 *   Web:    long-edge ≤2560, keep source fps (capped 60), H.264 High + faststart
 *   Mobile: long-edge ≤1280, H.264 High + faststart
 *
 * Masters stay in media-masters/ and are used as encode source (no generational loss).
 * Usage:
 *   node scripts/encode-delivery-videos.mjs [ffmpeg]
 *   [--web-only|--mobile-only] [--folder dji-avinox] [--force]
 */

const force = process.argv.includes('--force');
const webOnly = process.argv.includes('--web-only');
const mobileOnly = process.argv.includes('--mobile-only');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--') && process.argv[process.argv.indexOf(a) - 1] !== '--folder');
const ffmpeg = args[0] || process.env.FFMPEG || `${process.env.HOME}/.local/bin/ffmpeg`;
const folderIdx = process.argv.indexOf('--folder');
const folderFilter = folderIdx >= 0 ? process.argv[folderIdx + 1] : null;

const PROJECTS = ['dji-romo', 'dji-avinox', 'dji-power', 'dji-fly', 'dji-aura'];
const MASTER_ROOT = 'media-masters';
const PUBLIC_ROOT = 'public/media';

function listDeskVideos(project) {
  const dir = join(PUBLIC_ROOT, project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /^\d{2}\.mp4$/.test(name))
    .sort()
    .map((name) => ({
      project,
      name,
      publicPath: join(dir, name),
      masterPath: join(MASTER_ROOT, project, name),
      mobilePath: join(PUBLIC_ROOT, project, 'mobile', name),
    }));
}

function ensureMaster(item) {
  mkdirSync(dirname(item.masterPath), { recursive: true });
  if (!existsSync(item.masterPath)) {
    copyFileSync(item.publicPath, item.masterPath);
    console.log(`master ← ${item.publicPath}`);
  }
}

function runFfmpeg(ffmpegArgs) {
  return new Promise((resolve, reject) => {
    const job = spawn(ffmpeg, ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '';
    job.stderr.on('data', (chunk) => {
      error += chunk;
    });
    job.on('error', reject);
    job.on('close', (code) => (code === 0 ? resolve() : reject(new Error(error.trim() || `ffmpeg exit ${code}`))));
  });
}

async function encodeWeb(item) {
  const partial = `${item.publicPath}.partial.mp4`;
  await runFfmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', item.masterPath,
    '-an',
    '-vf', 'scale=2560:2560:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-profile:v', 'high',
    '-level', '4.2',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    partial,
  ]);
  renameSync(partial, item.publicPath);
}

async function encodeMobile(item) {
  mkdirSync(dirname(item.mobilePath), { recursive: true });
  const partial = `${item.mobilePath}.partial.mp4`;
  await runFfmpeg([
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', item.masterPath,
    '-an',
    '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=30',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-x264-params', 'aq-mode=3:aq-strength=0.8',
    '-movflags', '+faststart',
    partial,
  ]);
  renameSync(partial, item.mobilePath);
}

const items = PROJECTS
  .filter((p) => !folderFilter || p === folderFilter)
  .flatMap(listDeskVideos);

if (!items.length) {
  console.error('No desk videos found.');
  process.exit(1);
}

if (!existsSync(ffmpeg)) {
  console.error(`ffmpeg not found: ${ffmpeg}`);
  process.exit(1);
}

console.log(`ffmpeg: ${ffmpeg}`);
console.log(`clips: ${items.length} | web=${!mobileOnly} mobile=${!webOnly} force=${force}`);

for (const item of items) ensureMaster(item);

const queue = [...items];
async function worker(id) {
  while (queue.length) {
    const item = queue.shift();
    if (!item) return;
    const label = `${item.project}/${item.name}`;
    try {
      if (!mobileOnly) {
        process.stdout.write(`[${id}] web  ${label} ... `);
        await encodeWeb(item);
        console.log(`${(statSync(item.publicPath).size / 1e6).toFixed(2)}MB`);
      }
      if (!webOnly) {
        process.stdout.write(`[${id}] mob  ${label} ... `);
        await encodeMobile(item);
        console.log(`${(statSync(item.mobilePath).size / 1e6).toFixed(2)}MB`);
      }
    } catch (error) {
      console.error(`\nFAIL ${label}:`, error.message || error);
      throw error;
    }
  }
}

await Promise.all([worker('A'), worker('B')]);
console.log('done');
