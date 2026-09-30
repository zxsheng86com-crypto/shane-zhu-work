'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { networkAllowsPrefetch } from './media-queue';
import {
  markUrlWarmed,
  nextProjectSlug,
  projectChain,
  warmOpeningChain,
  warmOpeningPack,
} from './project-opening';

function whenIdle(run: () => void, timeout = 1600) {
  if (typeof window === 'undefined') return () => {};
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(() => run(), { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, Math.min(timeout, 1200));
  return () => window.clearTimeout(id);
}

function caseSlugFromHref(href: string) {
  const match = href.match(/^\/work\/([^/?#]+)/);
  const slug = match?.[1];
  if (!slug) return undefined;
  return slug;
}

function waitForOpeningReady(root: ParentNode) {
  return new Promise<void>((resolve) => {
    const media = root.querySelector<HTMLImageElement | HTMLVideoElement>(
      '.case-study .placeholder.has-media img, .case-study .placeholder.has-media video',
    );
    if (!media) {
      resolve();
      return;
    }

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    if (media instanceof HTMLVideoElement) {
      if (media.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        markUrlWarmed(media.currentSrc || media.src);
        done();
        return;
      }
      media.addEventListener('canplay', done, { once: true });
      media.addEventListener('error', done, { once: true });
    } else {
      if (media.complete && media.naturalWidth > 0) {
        markUrlWarmed(media.currentSrc || media.src);
        done();
        return;
      }
      media.addEventListener('load', done, { once: true });
      media.addEventListener('error', done, { once: true });
    }

    window.setTimeout(done, 12000);
  });
}

async function warmNextWhenQuiet(slug: string, prefetchRoute: (href: string) => void) {
  const next = nextProjectSlug(slug);
  if (!next || !networkAllowsPrefetch()) return;
  // Give the current case a moment to attach its own players before background fetch.
  await new Promise((r) => window.setTimeout(r, 1200));
  if (!networkAllowsPrefetch()) return;
  await warmOpeningPack(next, prefetchRoute);
}

/**
 * Site-wide entry prefetch (Home / Work / About).
 * Idle time is used on purpose: warm opening packs so case entry feels instant.
 * Traffic is accepted; only saveData / 2G still opt out (OS-level user intent).
 */
export function HomeProjectPrefetch({
  enabled = true,
  /** When true (e.g. About), keep walking the full chain while the page is idle. */
  chainWhileIdle = false,
}: {
  enabled?: boolean;
  chainWhileIdle?: boolean;
}) {
  const router = useRouter();
  const armed = useRef(false);

  useEffect(() => {
    if (!enabled) {
      armed.current = false;
      return;
    }
    if (armed.current || !networkAllowsPrefetch()) return;
    armed.current = true;

    const prefetchRoute = (href: string) => {
      router.prefetch(href);
    };

    const stopIdle = whenIdle(() => {
      if (chainWhileIdle) {
        void warmOpeningChain(prefetchRoute);
        return;
      }
      void warmOpeningPack(projectChain[0], prefetchRoute).then(() => {
        // After the likely-first case is ready, keep filling the rest in the background.
        void warmOpeningChain(prefetchRoute, projectChain[1]);
      });
    }, 2000);

    const links = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/work/"]')];
    const visibleQueue: string[] = [];
    const queued = new Set<string>();
    let pumping = false;

    const pumpVisible = async () => {
      if (pumping) return;
      pumping = true;
      while (visibleQueue.length && networkAllowsPrefetch()) {
        const slug = visibleQueue.shift();
        if (!slug) continue;
        await warmOpeningPack(slug, prefetchRoute);
      }
      pumping = false;
    };

    const enqueueVisible = (slug: string) => {
      if (queued.has(slug)) return;
      queued.add(slug);
      visibleQueue.push(slug);
      void pumpVisible();
    };

    const cleanups = links.map((link) => {
      let timer: number | undefined;
      const href = link.getAttribute('href') ?? '';
      const slug = caseSlugFromHref(href);
      if (!slug) return () => {};

      const bump = () => {
        router.prefetch(href);
        void warmOpeningPack(slug, prefetchRoute);
      };
      const enter = () => {
        timer = window.setTimeout(bump, 120);
      };
      const leave = () => {
        if (timer !== undefined) window.clearTimeout(timer);
      };

      link.addEventListener('pointerenter', enter);
      link.addEventListener('pointerleave', leave);
      link.addEventListener('focus', bump);
      // Touch / trackpad press: start before navigation commits.
      link.addEventListener('pointerdown', bump);

      let observer: IntersectionObserver | undefined;
      if (typeof IntersectionObserver !== 'undefined') {
        observer = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting) enqueueVisible(slug);
        }, { rootMargin: '80px 0px', threshold: 0.2 });
        observer.observe(link);
      }

      return () => {
        leave();
        link.removeEventListener('pointerenter', enter);
        link.removeEventListener('pointerleave', leave);
        link.removeEventListener('focus', bump);
        link.removeEventListener('pointerdown', bump);
        observer?.disconnect();
      };
    });

    return () => {
      stopIdle();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [enabled, router]);

  return null;
}

/** Case study: after this opener is smooth, warm the next project's opener. */
export function CaseProjectPrefetch({ slug }: { slug: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!networkAllowsPrefetch()) return;
    let cancelled = false;

    const run = async () => {
      router.prefetch(`/work/${slug}`);
      // Do NOT re-warm the current case's videos here — the page player owns them.
      // Only chain the *next* opener after this case's first media is ready.
      await waitForOpeningReady(document);
      if (cancelled) return;
      await warmNextWhenQuiet(slug, (href) => router.prefetch(href));
    };

    const stopIdle = whenIdle(() => {
      void run();
    }, 900);

    return () => {
      cancelled = true;
      stopIdle();
    };
  }, [router, slug]);

  return null;
}
