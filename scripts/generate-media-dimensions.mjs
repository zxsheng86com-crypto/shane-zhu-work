import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const dimensions = {};
for (const folder of ['dji-romo', 'dji-avinox', 'dji-power', 'dji-fly', 'dji-aura']) {
  for (const file of readdirSync(`public/media/${folder}`).filter(f => /^\d+\.(png|mp4)$/.test(f))) {
    const src = `/media/${folder}/${file}`;
    let width, height;
    if (file.endsWith('.png')) {
      const bytes = readFileSync(`public${src}`);
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      width = bytes.readUInt32BE(16);
      height = bytes.readUInt32BE(20);
    } else {
      const result = spawnSync(process.argv[2] || 'ffmpeg', ['-hide_banner', '-i', `public${src}`, '-t', '0', '-f', 'null', '-'], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr || String(result.error));
      const size = result.stderr.match(/Video:[^\n]*? (\d+)x(\d+)[, ]/);
      assert(size, `No dimensions for ${src}`);
      [, width, height] = size.map(Number);
    }
    dimensions[src] = { width, height };
  }
}
writeFileSync('app/media-dimensions.json', `${JSON.stringify(dimensions, null, 2)}\n`);
console.log(`Recorded ${Object.keys(dimensions).length} media sizes for pre-load layout`);
