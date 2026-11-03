import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, accessDestination, accessExpires, accessToken, hasAccess, passwordMatches } from './access-session';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function accessPage(error = false, status = 200) {
  return new NextResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shane Zhu · 访问验证</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px;background:#000;color:#f7f7f7;font:16px/1.5 system-ui,sans-serif}main{width:min(100%,360px)}h1{font-size:28px;font-weight:500;margin:0 0 12px}p{color:#999;margin:0 0 32px}label{display:block;margin-bottom:10px}input,button{width:100%;font:inherit;border-radius:4px;padding:14px 16px}input{border:1px solid #444;background:#111;color:#fff}input:focus-visible,button:focus-visible{outline:2px solid #fff;outline-offset:3px}button{margin-top:16px;border:0;background:#f7f7f7;color:#111;cursor:pointer}.error{color:#f4a0a0;margin:12px 0 0}
</style></head><body><main><h1>Shane Zhu</h1><p>请输入访问密码，查看我的作品集。<br>当天验证后，无需重复输入。</p><form method="post"><label for="password">访问密码</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="1024" required autofocus>${error ? '<p class="error" role="alert">密码不正确，请重新输入。</p>' : ''}<button type="submit">进入作品集</button></form></main></body></html>`, {
    status,
    headers: {
      ...privateHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
      'Referrer-Policy': 'same-origin',
    },
  });
}

export async function proxy(request: NextRequest) {
  const publicUrl = new URL(request.url);
  publicUrl.host = request.headers.get('host') || publicUrl.host;
  const password = process.env.PORTFOLIO_ACCESS_PASSWORD;
  // Fail closed until the deployment has its runtime secret configured.
  if (!password) {
    return new NextResponse('访问验证尚未配置，请联系网站所有者。', { status: 503, headers: privateHeaders });
  }

  const authorized = hasAccess(request.cookies.get(ACCESS_COOKIE)?.value, password);
  if (request.nextUrl.pathname === '/access') {
    if (request.method === 'HEAD') return new NextResponse(null, { status: authorized ? 204 : 401, headers: privateHeaders });
    const destination = accessDestination(request.nextUrl.searchParams.get('next'));
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== publicUrl.origin) {
        return new NextResponse(null, { status: 403, headers: privateHeaders });
      }
      if (Number(request.headers.get('content-length') || 0) > 4096) {
        return new NextResponse(null, { status: 413, headers: privateHeaders });
      }
      if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
        return new NextResponse(null, { status: 415, headers: privateHeaders });
      }
      const reader = request.body?.getReader();
      if (!reader) return accessPage(true, 400);
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 4096) {
            await reader.cancel();
            return new NextResponse(null, { status: 413, headers: privateHeaders });
          }
          chunks.push(value);
        }
      } catch { return accessPage(true, 400); }
      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      if (!passwordMatches(form.get('password'), password)) return accessPage(true, 401);
      const now = Date.now();
      const response = NextResponse.redirect(new URL(destination, publicUrl), 303);
      response.headers.set('Cache-Control', 'private, no-store');
      response.cookies.set(ACCESS_COOKIE, accessToken(password, now), {
        httpOnly: true, secure: true, sameSite: 'lax', path: '/', expires: accessExpires(now),
      });
      return response;
    }
    if (request.method !== 'GET') return new NextResponse(null, { status: 405, headers: privateHeaders });
    return authorized ? NextResponse.redirect(new URL(destination, publicUrl), { status: 303, headers: privateHeaders }) : accessPage();
  }

  if (!authorized) {
    if (request.method === 'GET' && request.headers.get('accept')?.includes('text/html')) {
      const url = new URL('/access', publicUrl);
      url.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(url, { status: 307, headers: privateHeaders });
    }
    return new NextResponse(null, { status: 403, headers: privateHeaders });
  }

  const response = NextResponse.next();
  if (request.headers.get('accept')?.includes('text/html') || request.headers.has('rsc')) {
    response.headers.set('Cache-Control', 'private, no-store');
  }
  response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return response;
}

export const config = { matcher: '/:path*' };
