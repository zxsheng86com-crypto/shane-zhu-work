import assert from 'node:assert/strict';
import { request } from 'node:https';

// Run against a Vercel deployment; next dev does not apply vercel.json routes.
const base = process.argv[2];
assert(base, 'Usage: node scripts/check-media-protection.mjs https://your-deployment');
const image = '/media/dji-avinox/01.webp';
const origin = new URL(base).origin;

async function check(label, path, headers, expected, method = 'HEAD') {
  const response = await new Promise((resolve, reject) => {
    request(new URL(path, base), { method, headers }, resolve).on('error', reject).end();
  });
  response.destroy();
  assert.equal(response.statusCode, expected, `${label}: expected ${expected}, got ${response.statusCode}`);
  if (expected === 403) {
    assert.match(response.headers['cache-control'] ?? '', /no-store/);
    assert.doesNotMatch(response.headers['content-type'] ?? '', /image\/|video\//);
    assert.equal(response.headers['x-vercel-mitigated'], 'deny');
  }
  if (expected === 206) assert.match(response.headers['content-range'] ?? '', /^bytes 0-1023\//);
  console.log(`PASS ${label}`);
}

await check('Page remains public', '/work/dji-romo', {}, 200);
await check('Normal image load', image, { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'image', referer: `${origin}/work` }, 200);
await check('Video range requests remain supported', '/media/dji-romo/13.mp4', { 'sec-fetch-site': 'same-origin', 'sec-fetch-dest': 'video', range: 'bytes=0-1023', referer: `${origin}/work/dji-romo` }, 206, 'GET');
await check('Unattributed download after cache warmup', image, {}, 403);
await check('Direct image navigation', image, { 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'navigate', referer: `${origin}/work` }, 403);
await check('Cross-site collection', image, { 'sec-fetch-site': 'cross-site', referer: 'https://example.com/' }, 403);
await check('Unattributed background request', image, { 'sec-fetch-site': 'none' }, 403);
await check('Legacy browser with site referer', image, { referer: 'https://www.shanezhu.work/work' }, 200);
await check('Spoofed hostname suffix rejected', image, { referer: 'https://www.shanezhu.work.example.com/work' }, 403);
await check('Normal image still loads after denied requests', image, { 'sec-fetch-site': 'same-origin' }, 200);
await check('Old project redirect preserved', '/work/common-ground', {}, 308);
