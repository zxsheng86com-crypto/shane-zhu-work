import { readFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawn } from 'node:child_process';

// Justified serves width-limited media to phones. Keep originals untouched.
const sources = Object.keys(JSON.parse(readFileSync('app/media-dimensions.json', 'utf8'))).filter(src => src.endsWith('.mp4') && (!process.argv[3] || src.startsWith(`/media/${process.argv[3]}/`)));
async function worker() {
  while (sources.length) {
    const src = sources.shift();
    const target = `public${src.replace(/\/([^/]+)$/, '/mobile/$1')}`;
    mkdirSync(dirname(target), { recursive: true });
    await new Promise((resolve, reject) => {
      const job = spawn(process.argv[2] || 'ffmpeg', ['-y', '-loglevel', 'error', '-i', `public${src}`, '-an', '-vf', 'scale=min(1600\\,iw):-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', `${target}.partial.mp4`], { stdio: ['ignore', 'ignore', 'pipe'] });
      let error = '';
      job.stderr.on('data', chunk => { error += chunk; });
      job.on('error', reject);
      job.on('close', code => code === 0 ? resolve() : reject(new Error(error)));
    });
    renameSync(`${target}.partial.mp4`, target);
    console.log(target);
  }
}
await Promise.all([worker(), worker()]);
