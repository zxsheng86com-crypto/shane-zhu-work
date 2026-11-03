import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const ACCESS_COOKIE = '__Host-portfolio-access';
const DAY = 86_400_000;
const CHINA_OFFSET = 8 * 60 * 60 * 1000;

export function accessDay(now = Date.now()) {
  return Math.floor((now + CHINA_OFFSET) / DAY);
}

export function accessExpires(now = Date.now()) {
  return new Date((accessDay(now) + 1) * DAY - CHINA_OFFSET);
}

export function accessToken(password: string, now = Date.now()) {
  const day = accessDay(now);
  return `${day}.${createHmac('sha256', password).update(`portfolio-access:${day}`).digest('hex')}`;
}

function equal(a: string, b: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(a), hash(b));
}

export function hasAccess(token: string | undefined, password: string, now = Date.now()) {
  return !!token && token.length < 100 && equal(token, accessToken(password, now));
}

export function passwordMatches(input: unknown, password: string) {
  return typeof input === 'string' && input.length <= 1024 && equal(input, password);
}

export function accessDestination(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const url = new URL(value, 'https://portfolio.invalid');
  return url.origin === 'https://portfolio.invalid' && url.pathname !== '/access' ? `${url.pathname}${url.search}` : '/';
}
