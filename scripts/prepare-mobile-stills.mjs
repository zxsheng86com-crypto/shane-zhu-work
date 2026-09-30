import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Mobile stills: long-edge ≤1280, JPEG q72, baseline.
 * Usage: node scripts/prepare-mobile-stills.mjs [folder]
 */
const folder = process.argv[2];
const roots = folder ? [folder] : ['dji-romo', 'dji-avinox', 'dji-power', 'dji-fly', 'dji-aura'];

for (const project of roots) {
  const dir = join('public/media', project);
  if (!existsSync(dir)) continue;
  const { readdirSync } = await import('node:fs');
  for (const name of readdirSync(dir).filter((f) => /^\d{2}\.jpg$/.test(f))) {
    const src = join(dir, name);
    const out = join(dir, 'mobile', name);
    mkdirSync(dirname(out), { recursive: true });
    const py = `
from PIL import Image
img = Image.open(${JSON.stringify(src)}).convert('RGB')
w, h = img.size
scale = min(1.0, 1280 / max(w, h))
if scale < 1:
  img = img.resize((max(2, int(w*scale)//2*2), max(2, int(h*scale)//2*2)), Image.Resampling.LANCZOS)
img.save(${JSON.stringify(out)}, 'JPEG', quality=72, optimize=True, progressive=False)
print(${JSON.stringify(out)})
`;
    const result = spawnSync('python3', ['-c', py], { encoding: 'utf8' });
    if (result.status !== 0) {
      console.error(result.stderr || result.error);
      process.exit(1);
    }
    process.stdout.write(result.stdout);
  }
}
