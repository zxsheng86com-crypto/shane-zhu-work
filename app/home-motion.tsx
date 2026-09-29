'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const warmedVideos = new Map<string, HTMLVideoElement>();

function warmVideo(src?: string) {
  if (!src || warmedVideos.has(src)) return;
  if (warmedVideos.size >= 2) {
    const oldest = warmedVideos.entries().next().value as [string, HTMLVideoElement] | undefined;
    if (oldest) {
      oldest[1].removeAttribute('src');
      oldest[1].load();
      warmedVideos.delete(oldest[0]);
    }
  }
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'auto';
  video.src = src;
  video.load();
  warmedVideos.set(src, video);
}

export function HomeMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const items = [...container.querySelectorAll<HTMLElement>('[data-home-reveal]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.classList.add('motion-ready');

    requestAnimationFrame(() => container.classList.add('motion-loaded'));
    if (reduced) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const links = [...container.querySelectorAll<HTMLAnchorElement>('a.project-card[href^="/work/"]')];
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const canWarmVideo = matchMedia('(hover: hover) and (pointer: fine)').matches && !connection?.saveData && !connection?.effectiveType?.includes('2g');
    const warm = (link: HTMLAnchorElement) => {
      router.prefetch(link.getAttribute('href') ?? '');
      if (canWarmVideo) warmVideo(link.dataset.prefetchMedia);
    };
    const idleTask = () => {
      links.forEach((link) => router.prefetch(link.getAttribute('href') ?? ''));
      if (canWarmVideo) warmVideo(links[0]?.dataset.prefetchMedia);
    };
    const idleId = window.requestIdleCallback?.(idleTask, { timeout: 1800 }) ?? window.setTimeout(idleTask, 1200);
    const cleanups = links.map((link) => {
      let intentTimer: ReturnType<typeof setTimeout> | undefined;
      const enter = () => { intentTimer = setTimeout(() => warm(link), 150); };
      const leave = () => { if (intentTimer) clearTimeout(intentTimer); };
      const focus = () => warm(link);
      link.addEventListener('pointerenter', enter);
      link.addEventListener('pointerleave', leave);
      link.addEventListener('focus', focus);
      return () => {
        if (intentTimer) clearTimeout(intentTimer);
        link.removeEventListener('pointerenter', enter);
        link.removeEventListener('pointerleave', leave);
        link.removeEventListener('focus', focus);
      };
    });
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [router]);

  return <div className="home-motion" ref={root}>{children}</div>;
}
