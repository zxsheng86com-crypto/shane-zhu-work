import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { ACCESS_COOKIE, accessDestination, accessExpires, accessToken, hasAccess, passwordMatches } from './access-session';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function accessPage(error = false, status = 200) {
  const nonce = randomBytes(16).toString('base64');
  return new NextResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shane Zhu · 访问验证</title><style>
@font-face{font-family:Aspekta;src:url('/fonts/AspektaVF.woff2') format('woff2-variations');font-weight:50 1000;font-display:swap}
*{box-sizing:border-box}body{margin:0;min-height:100svh;background:#000;color:#828282;font:400 24px/1 Aspekta,Arial,sans-serif;-webkit-font-smoothing:antialiased;color-scheme:dark}
main{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(calc(100% - 48px),280px)}form{position:relative}
input{display:block;width:100%;height:48px;padding:0 0 14px;border:0;border-bottom:1px solid rgba(255,255,255,.12);outline:0;border-radius:0;background:transparent;color:#828282;caret-color:#828282;font:inherit;font-variant-numeric:tabular-nums;letter-spacing:.24em;text-align:center;transition:border-color .16s ease;appearance:none}
input:focus{border-bottom-color:#7d7d7d}
form.is-busy{opacity:.64}.is-error{animation:shake .4s ease-out}.sr-only{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.loader{display:none;position:relative;overflow:hidden;width:min(160px,28vw);height:1px;margin:auto;background:rgba(255,255,255,.12)}.loader i{position:absolute;inset:0;background:#7d7d7d;transform:scaleX(.25);transform-origin:left;animation:loading 1s ease-in-out infinite}
.is-unlocked form{display:none}.is-unlocked .loader{display:block}
@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}
@keyframes loading{0%{transform:translateX(-30%) scaleX(.25)}100%{transform:translateX(100%) scaleX(.25)}}
@media(prefers-reduced-motion:reduce){.is-error,.loader i{animation:none}input{transition:none}.is-error input{opacity:.5}.loader i{transform:scaleX(.25)}}
</style></head><body><main><form method="post" novalidate aria-label="作品集访问验证"${error ? ' class="is-error"' : ''}><input id="password" name="password" type="text" aria-label="六位访问密码" inputmode="numeric" pattern="[0-9]{6}" autocomplete="off" maxlength="6" required autofocus></form><div class="loader" role="progressbar" aria-label="正在加载作品集"><i></i></div><span class="sr-only" role="status" aria-live="polite"></span></main><script nonce="${nonce}">
const form=document.querySelector('form'),input=document.querySelector('input'),status=document.querySelector('[role=status]');
let busy=false;
function reject(message){busy=false;input.readOnly=false;form.classList.remove('is-busy','is-error');void form.offsetWidth;form.classList.add('is-error');status.textContent=message;input.value='';input.focus()}
async function verify(){if(busy||input.value.length!==6)return;busy=true;input.readOnly=true;form.classList.add('is-busy');form.setAttribute('aria-busy','true');status.textContent='';try{const response=await fetch(location.pathname+location.search,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams({password:input.value}),cache:'no-store'});if(response.status===204){input.value='';document.body.classList.add('is-unlocked');location.assign(response.headers.get('Location')||'/');return}reject(response.status===401?'密码错误，请重新输入。':'暂时无法验证，请重试。')}catch{reject('连接失败，请重新输入。')}finally{form.removeAttribute('aria-busy')}}
input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,6);form.classList.remove('is-error');void verify()});
form.addEventListener('submit',event=>{event.preventDefault();void verify()});
form.addEventListener('animationend',()=>form.classList.remove('is-error'));
</script></body></html>`, {
    status,
    headers: {
      ...privateHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`,
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

  if (request.nextUrl.pathname === '/fonts/AspektaVF.woff2') return NextResponse.next();

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
      const json = request.headers.get('accept')?.includes('application/json');
      if (!passwordMatches(form.get('password'), password)) {
        return json ? new NextResponse(null, { status: 401, headers: privateHeaders }) : accessPage(true, 401);
      }
      const now = Date.now();
      const response = json
        ? new NextResponse(null, { status: 204, headers: { ...privateHeaders, Location: new URL(destination, publicUrl).toString() } })
        : NextResponse.redirect(new URL(destination, publicUrl), 303);
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
