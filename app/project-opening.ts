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

/** How many media slots the entry progress gate must finish (stills + posters). */
export const CASE_ENTRY_SLOTS = 1;

type CaseCatalog = {
  slug: ProjectSlug;
  href: string;
  folder: string;
  videoSlots: ReadonlySet<number>;
  version: string;
  maxSlot: number;
};

const catalogs: Record<ProjectSlug, CaseCatalog> = {
  'common-ground': {
    slug: 'common-ground',
    href: '/work/common-ground',
    folder: 'dji-romo',
    videoSlots: new Set([2, 6, 7, 8, 9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22, 23, 28, 31]),
    version: '20261008-media',
    maxSlot: 31,
  },
  'dji-avinox': {
    slug: 'dji-avinox',
    href: '/work/dji-avinox',
    folder: 'dji-avinox',
    videoSlots: new Set([2, 4, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 22, 23, 24, 25, 29, 31]),
    version: '20261008-media',
    maxSlot: 32,
  },
  'dji-power': {
    slug: 'dji-power',
    href: '/work/dji-power',
    folder: 'dji-power',
    videoSlots: new Set([3, 14, 16]),
    version: '20261008-media',
    maxSlot: 18,
  },
  'dji-fly': {
    slug: 'dji-fly',
    href: '/work/dji-fly',
    folder: 'dji-fly',
    videoSlots: new Set([7, 8, 9, 10, 11, 12, 13, 14, 15, 19]),
    version: '20261008-media',
    maxSlot: 24,
  },
  'dji-aura-logo': {
    slug: 'dji-aura-logo',
    href: '/work/dji-aura-logo',
    folder: 'dji-aura',
    videoSlots: new Set([1, 4, 8]),
    version: '20261008-media',
    maxSlot: 12,
  },
};

function pad2(slot: number) {
  return String(slot).padStart(2, '0');
}

function mediaUrl(folder: string, slot: number, ext: 'webp' | 'mp4', version: string) {
  return `/media/${folder}/${pad2(slot)}.${ext}?v=${version}`;
}

function posterUrl(folder: string, slot: number, version: string) {
  return `/media/${folder}/posters/${pad2(slot)}.jpg?v=${version}`;
}

export type CaseMediaItem = {
  slot: number;
  kind: 'image' | 'video';
  url: string;
  poster?: string;
};

function itemForSlot(catalog: CaseCatalog, slot: number): CaseMediaItem | null {
  if (slot < 1 || slot > catalog.maxSlot) return null;
  const version = catalog.slug === 'dji-avinox' && slot === 8
    ? '20261008-avinox-08'
    : catalog.slug === 'dji-fly' && [7, 8, 10].includes(slot)
      ? `20261008-fly-${pad2(slot)}`
      : catalog.version;
  if (catalog.videoSlots.has(slot)) {
    return {
      slot,
      kind: 'video',
      url: mediaUrl(catalog.folder, slot, 'mp4', version),
      poster: posterUrl(catalog.folder, slot, version),
    };
  }
  return {
    slot,
    kind: 'image',
    url: mediaUrl(catalog.folder, slot, 'webp', version),
  };
}

function packFromCatalog(catalog: CaseCatalog): OpeningPack {
  const images: string[] = [];
  const videos: string[] = [];
  const posters: string[] = [];
  for (let slot = 1; slot <= CASE_ENTRY_SLOTS; slot += 1) {
    const item = itemForSlot(catalog, slot);
    if (!item) continue;
    if (item.kind === 'video') {
      videos.push(item.url);
      if (item.poster) posters.push(item.poster);
    } else {
      images.push(item.url);
    }
  }
  return {
    slug: catalog.slug,
    href: catalog.href,
    images,
    videos,
    posters,
  };
}

export const openingPacks: Record<ProjectSlug, OpeningPack> = {
  'common-ground': packFromCatalog(catalogs['common-ground']),
  'dji-avinox': packFromCatalog(catalogs['dji-avinox']),
  'dji-power': packFromCatalog(catalogs['dji-power']),
  'dji-fly': packFromCatalog(catalogs['dji-fly']),
  'dji-aura-logo': packFromCatalog(catalogs['dji-aura-logo']),
};

const warmed = new Set<string>();
const warmingImages = new Map<string, Promise<void>>();
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
  return slug in catalogs;
}

export function nextProjectSlug(slug: string) {
  const index = projectChain.indexOf(slug as ProjectSlug);
  if (index < 0 || index >= projectChain.length - 1) return undefined;
  return projectChain[index + 1];
}

function warmImage(url: string) {
  const key = mediaKey(url);
  if (warmed.has(key)) return Promise.resolve();
  const existing = warmingImages.get(key);
  if (existing) return existing;

  const task = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      warmed.add(key);
      resolve();
    };
    image.onerror = () => resolve();
    image.src = url;
  });
  warmingImages.set(key, task);
  void task.finally(() => warmingImages.delete(key));
  return task;
}

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
    /* abort / network */
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

export function warmOpeningPack(slug: string, prefetchRoute?: (href: string) => void) {
  if (!isProjectSlug(slug)) return Promise.resolve();
  if (!networkAllowsPrefetch()) return Promise.resolve();
  const existing = warming.get(slug);
  if (existing) return existing;

  const pack = openingPacks[slug];
  const task = (async () => {
    prefetchRoute?.(pack.href);
    for (const poster of pack.posters) await warmUrl(poster, 'poster');
    for (const image of pack.images) await warmUrl(entryImageUrl(image), 'image');
  })().finally(() => {
    warming.delete(slug);
  });

  warming.set(slug, task);
  return task;
}

export function openingPackWarmed(slug: string) {
  if (!isProjectSlug(slug)) return false;
  const pack = openingPacks[slug];
  const urls = [...pack.images.map(entryImageUrl), ...pack.posters];
  return urls.length > 0 && urls.every((url) => warmed.has(mediaKey(url)));
}

export function markUrlWarmed(url: string) {
  if (!url) return;
  warmed.add(mediaKey(url));
}

function stripQuery(url: string) {
  return url.split('?')[0];
}

function entryImageUrl(desktopUrl: string) {
  if (typeof window === 'undefined') return desktopUrl;
  if (!window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches) return desktopUrl;
  const path = stripQuery(desktopUrl);
  if (!path.endsWith('.webp')) return desktopUrl;
  const mobilePath = path.replace(/\/([^/]+)$/, '/mobile/$1');
  if (mobilePath === path) return desktopUrl;
  return desktopUrl.replace(path, mobilePath);
}

export function shouldEagerBindCaseSlot(slot: number) {
  // Client players decide the real window; this is a desktop-oriented hint.
  return slot >= 1 && slot <= 6;
}

/** First-screen stills only — avoid priority-loading 8× multi‑MB JPGs on phones. */
export function shouldPriorityCaseSlot(slot: number) {
  return slot >= 1 && slot <= 2;
}
