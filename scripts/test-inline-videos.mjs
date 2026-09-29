import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
const ffmpeg = process.argv[2];
assert(ffmpeg, 'Pass the ffmpeg executable path');
const folder = process.argv[3] || 'dji-romo';
assert(/^dji-[a-z-]+$/.test(folder));
for (const file of readdirSync(`public/media/${folder}/inline`).filter(file => file.endsWith('.mp4'))) {
  const slot = `${folder}/${file}`;
  const original = `public/media/${folder}/${file}`;
  const alternate = `public/media/${folder}/inline/${file}`;
  const hash = file => execFileSync(ffmpeg, ['-v', 'error', '-i', file, '-map', '0:v:0', '-f', 'hash', '-hash', 'sha256', '-'], { encoding: 'utf8' });
  assert.equal(hash(original), hash(alternate), `${slot}: decoded frame pixels must remain identical`);
  const bytes = readFileSync(alternate);
  assert.equal(bytes[bytes.indexOf('avcC') + 7], 52);
  assert(bytes.indexOf('moov') < bytes.indexOf('mdat'));
  console.log(`PASS ${slot}: identical decoded pixels, level 5.2 trial, fast start`);
}
