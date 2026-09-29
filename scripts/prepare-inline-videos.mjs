import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const [ffmpeg, ...folders] = process.argv.slice(2);
assert(ffmpeg && folders.length, 'Pass ffmpeg path and project folder names');
for (const folder of folders) {
  assert(/^dji-[a-z-]+$/.test(folder));
  const root = `public/media/${folder}`;
  for (const file of readdirSync(root).filter(file => /^\d{2}\.mp4$/.test(file))) {
    const source = `${root}/${file}`;
    const bytes = readFileSync(source);
    const offset = bytes.indexOf('avcC');
    if (offset < 0 || bytes[offset + 7] <= 52) continue;
    mkdirSync(`${root}/inline`, { recursive: true });
    const target = `${root}/inline/${file}`;
    assert(!existsSync(target), `Already exists; verify before replacing: ${target}`);
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-n', '-i', source, '-map', '0', '-c', 'copy', '-bsf:v', 'h264_metadata=level=5.2', '-movflags', '+faststart', target]);
    console.log(`Prepared ${target}; original unchanged`);
  }
}
