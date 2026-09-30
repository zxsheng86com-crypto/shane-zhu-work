import { existsSync, readFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

// Justified serves width-limited media to phones. Keep originals untouched.
// Usage: node scripts/prepare-mobile-media.mjs [ffmpeg] [folder] [--force]
const force = process.argv.includes('--force');
const args = process.argv.slice(2).filter(a => a !== '--force');
const ffmpeg = args[0] || 'ffmpeg';
const folder = args[1];
const sources = Object.keys(JSON.parse(readFileSync('app/media-dimensions.json', 'utf8'))).filter(src => src.endsWith('.mp4') && (!folder || src.startsWith(`/media/${folder}/`)));
async function worker() {
  while (sources.length) {
    const src = sources.shift();
    const target = `public${src.replace(/\/([^/]+)$/, '/mobile/$1')}`;
    if (!force && existsSync(target) && statSync(target).size > 0) {
      console.log(`skip ${target}`);
      continue;
    }
    mkdirSync(dirname(target), { recursive: true });
    await new Promise((resolve, reject) => {
      const job = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-i', `public${src}`, '-an', '-vf', 'scale=min(1280\\,iw):-2,fps=30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', `${target}.partial.mp4`], { stdio: ['ignore', 'ignore', 'pipe'] });
      let error = '';
      job.stderr.on('data', chunk => { error += chunk; });
      job.on('error', reject);
      job.on('close', code => code === 0 ? resolve() : reject(new Error(error || `ffmpeg exit ${code}`)));
    });
    renameSync(`${target}.partial.mp4`, target);
    console.log(target);
  }
}
await Promise.all([worker(), worker()]);
