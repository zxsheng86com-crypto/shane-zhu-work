import assert from 'node:assert/strict';
import { accessToken } from '../access-session.ts';

const base = process.argv[2] || 'http://127.0.0.1:3002';
const password = process.env.PORTFOLIO_ACCESS_PASSWORD;
assert(password, 'Set PORTFOLIO_ACCESS_PASSWORD for the test server; never print it.');
const origin = new URL(base).origin;
const send = (path, init = {}) => fetch(new URL(path, base), { redirect: 'manual', ...init });
const page = await send('/work/dji-romo', { headers: { accept: 'text/html' } });
assert.equal(page.status, 307);
assert.equal(new URL(page.headers.get('location'), base).pathname, '/access');
assert.match(page.headers.get('cache-control'), /no-store/);
for (const path of ['/media/dji-romo/01.webp', '/work/dji-romo?_rsc=test']) {
  const response = await send(path, { headers: { rsc: '1', 'sec-fetch-site': 'same-origin' } });
  assert.equal(response.status, 403);
  assert.equal((await response.arrayBuffer()).byteLength, 0);
}
const loginPage = await send('/access?next=/work/dji-romo');
assert.equal(loginPage.status, 200);
const loginHtml = await loginPage.text();
assert(!loginHtml.includes(password));
assert.equal((loginHtml.match(/<input /g) || []).length, 1);
assert.match(loginHtml, /maxlength="9"/);
assert(!/<button|<h1|<label/.test(loginHtml));
assert.match(loginPage.headers.get('content-security-policy'), /script-src 'nonce-/);
assert.equal((await send('/fonts/AspektaVF.woff2', { method: 'HEAD' })).status, 200);
const post = (value, originHeader = origin) => send('/access?next=/work/dji-romo', {
  method: 'POST', headers: { origin: originHeader, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ password: value }),
});
assert.equal((await post('wrong-test-input')).status, 401);
assert.equal((await post(password, 'https://example.com')).status, 403);
const automatic = await send('/access?next=/work/dji-romo', {
  method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
  body: new URLSearchParams({ password }),
});
assert.equal(automatic.status, 204);
assert.equal(new URL(automatic.headers.get('location'), base).pathname, '/work/dji-romo');
assert(automatic.headers.get('set-cookie'));
const login = await post(password);
assert.equal(login.status, 303);
assert.equal(new URL(login.headers.get('location'), base).pathname, '/work/dji-romo');
const cookie = login.headers.get('set-cookie');
for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/']) assert(cookie.toLowerCase().includes(flag.toLowerCase()));
const auth = { cookie: cookie.split(';')[0], 'sec-fetch-site': 'same-origin' };
assert.equal((await send('/access', { method: 'HEAD', headers: auth })).status, 204);
const unlocked = await send('/work/dji-romo', { headers: { ...auth, accept: 'text/html' } });
assert.equal(unlocked.status, 200);
assert.match(unlocked.headers.get('cache-control'), /no-store/);
const html = await unlocked.text();
const bundle = html.match(/src="([^" ]*\/_next\/static\/[^" ]+\.js)"/)?.[1];
assert(bundle, 'Authenticated page must include its client bundle');
assert.equal((await send(bundle, { method: 'HEAD', headers: auth })).status, 200);
assert.equal((await send(bundle, { method: 'HEAD' })).status, 403);
assert.equal((await send('/media/dji-romo/01.webp', { method: 'HEAD', headers: auth })).status, 200);
const video = await send('/media/dji-romo/13.mp4', { headers: { ...auth, range: 'bytes=0-1023' } });
assert.equal(video.status, 206);
assert.match(video.headers.get('content-range'), /^bytes 0-1023\//);
await video.body.cancel();
const yesterday = accessToken(password, Date.now() - 86_400_000);
assert.equal((await send('/access', { method: 'HEAD', headers: { cookie: `__Host-portfolio-access=${yesterday}` } })).status, 401);
console.log('PASS protected pages/media/RSC, login, same-day reuse, expired session, cookie security and CSRF');
