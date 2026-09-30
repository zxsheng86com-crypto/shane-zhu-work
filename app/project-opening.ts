import { networkAllowsPrefetch } from './media-queue';
import { armScrollActivity, isPageScrolling, prefetchAbortSignal, waitForScrollIdle } from './scroll-activity';

export type OpeningPack = {
  slug: string;
  href: string;
  images: string[];
  videos: string[];
  posters: string[];
};

/** Browse order used for chained opening-pack warm. */
export const projectChain = [
  'common-ground',
  'dji-avinox',
  'dji-power',
  'dji-fly',
  'dji-aura-logo',
] as const;

export type ProjectSlug = (typeof projectChain)[number];

/** Only the above-the-fold opener: hero still + first motion clip (+ poster). */
export const openingPacks: Record<ProjectSlug, OpeningPack> = {
  'common-ground': {
    slug: 'common-ground',
    href: '/work/common-ground',
    images: ['/media/dji-romo/01.jpg?v=20260930-jpg'],
    videos: ['/media/dji-romo/02.mp4?v=20260923-r3'],
    posters: ['/media/dji-romo/posters/02.jpg'],
  },
  'dji-avinox': {
    slug: 'dji-avinox',
    href: '/work/dji-avinox',
    images: ['/media/dji-avinox/01.jpg?v=20260930-jpg'],
    videos: ['/media/dji-avinox/02.mp4?v=20260923-r1'],
    posters: ['/media/dji-avinox/posters/02.jpg'],
  },
  'dji-power': {
    slug: 'dji-power',
    href: '/work/dji-power',
    images: ['/media/dji-power/01.jpg?v=20260930-jpg'],
    videos: ['/media/dji-power/03.mp4?v=20260923-r1'],
    posters: ['/media/dji-power/posters/03.jpg'],
  },
  'dji-fly': {
    slug: 'dji-fly',
    href: '/work/dji-fly',
    images: ['/media/dji-fly/01.jpg?v=20260930-jpg'],
    videos: ['/media/dji-fly/07.mp4?v=20260923-r3'],
    posters: ['/media/dji-fly/posters/07.jpg'],
  },
  'dji-aura-logo': {
    slug: 'dji-aura-logo',
    href: '/work/dji-aura-logo',
    images: [],
    videos: ['/media/dji-aura/01.mp4?v=20260922-r2'],
    posters: ['/media/dji-aura/posters/01.jpg'],
  },
};

const warmed = new Set<string>();
const warming = new Map<string, Promise<void>>();
let prefetchGate: Promise<void> = Promise.resolve();

function mediaKey(url: string) {
  try {
    const parsed = url.startsWith('http') ? new URL(url) : new URL(url, 'https://example.local');
    return parsed.pathname;
  } catch {
    return url.split('?')[0].split('#')[0];
  }
}

function isProjectSlug(slug: string): slug is ProjectSlug {
  return slug in openingPacks;
}

export function nextProjectSlug(slug: string) {
  const index = projectChain.indexOf(slug as ProjectSlug);
  if (index < 0 || index >= projectChain.length - 1) return undefined;
  return projectChain[index + 1];
}

function warmImage(url: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

/** Fetch into HTTP cache only — never a hidden <video>. Abort on scroll. */
async function warmVideo(url: string) {
  try {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'force-cache',
      signal: prefetchAbortSignal(),
    });
    if (!response.ok) return;
    await response.arrayBuffer();
  } catch {
    // Abort / network — fine; player path still works.
  }
}

async function warmUrl(url: string, kind: 'image' | 'video' | 'poster') {
  const key = mediaKey(url);
  if (warmed.has(key)) return;
  if (!networkAllowsPrefetch()) return;

  armScrollActivity();
  if (isPageScrolling()) await waitForScrollIdle();
  if (!networkAllowsPrefetch()) return;

  const previous = prefetchGate;
  let release!: () => void;
  prefetchGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    if (isPageScrolling()) await waitForScrollIdle();
    if (!networkAllowsPrefetch()) return;
    const signal = prefetchAbortSignal();
    if (kind === 'video') await warmVideo(url);
    else await warmImage(url);
    if (!signal.aborted) warmed.add(key);
  } finally {
    release();
  }
}

/** Prefetch RSC/shell + opening media for one project. Safe to call repeatedly. */
export function warmOpeningPack(slug: string, prefetchRoute?: (href: string) => void) {
  if (!isProjectSlug(slug)) return Promise.resolve();
  if (!networkAllowsPrefetch()) return Promise.resolve();
  const existing = warming.get(slug);
  if (existing) return existing;

  const pack = openingPacks[slug];
  const task = (async () => {
    prefetchRoute?.(pack.href);
    // Justified-style: warm light stand-ins first (poster / still), not full MP4 bodies.
    for (const poster of pack.posters) await warmUrl(poster, 'poster');
    for (const image of pack.images) await warmUrl(image, 'image');
    // Skip full video byte warm — the case player owns buffering with visible priority.
  })().finally(() => {
    warming.delete(slug);
  });

  warming.set(slug, task);
  return task;
}

/** Idle background: walk the project chain and warm every opening pack in order. */
export async function warmOpeningChain(prefetchRoute?: (href: string) => void, fromSlug?: string) {
  const start = fromSlug ? projectChain.indexOf(fromSlug as ProjectSlug) : 0;
  const offset = start < 0 ? 0 : start;
  for (const slug of projectChain.slice(offset)) {
    if (!networkAllowsPrefetch()) return;
    if (isPageScrolling()) await waitForScrollIdle();
    await warmOpeningPack(slug, prefetchRoute);
  }
}

export function openingPackWarmed(slug: string) {
  if (!isProjectSlug(slug)) return false;
  const pack = openingPacks[slug];
  const urls = [...pack.images, ...pack.posters];
  return urls.length > 0 && urls.every((url) => warmed.has(mediaKey(url)));
}

export function markUrlWarmed(url: string) {
  if (!url) return;
  warmed.add(mediaKey(url));
}
