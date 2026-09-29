import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const dimensions = JSON.parse(readFileSync('app/media-dimensions.json', 'utf8'));
for (const src of Object.keys(dimensions).filter(src => src.endsWith('.mp4'))) {
  const poster = resolve('public' + src.replace(/\/([^/]+)\.mp4$/, '/posters/$1.jpg'));
  mkdirSync(dirname(poster), { recursive: true });
  execFileSync(process.argv[2], ['-y', '-loglevel', 'error', '-i', resolve('public' + src), '-frames:v', '1', '-vf', 'scale=min(960\\,iw):-2', '-q:v', '2', poster]);
}
console.log('Video first-frame posters generated.');
