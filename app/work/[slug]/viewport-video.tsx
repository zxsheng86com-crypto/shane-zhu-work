'use client';

import { useEffect, useRef, useState } from 'react';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/** Cap concurrent full video downloads — mobile is stricter. Desktop still loads originals. */
const preloadWaiters: Array<() => void> = [];
let preloadActive = 0;

function maxConcurrentPreloads() {
  if (typeof window === 'undefined') return 2;
  if (window.matchMedia('(max-width: 800px)').matches) return 1;
  return 2;
}

function acquirePreloadSlot() {
  return new Promise<void>((resolve) => {
    const attempt = () => {
      if (preloadActive < maxConcurrentPreloads()) {
        preloadActive += 1;
        resolve();
        return;
      }
      preloadWaiters.push(attempt);
    };
    attempt();
  });
}

function releasePreloadSlot() {
  preloadActive = Math.max(0, preloadActive - 1);
  const next = preloadWaiters.shift();
  next?.();
}

function stripQuery(path: string) {
  return path.split('?')[0];
}

function withQuery(path: string, from: string) {
  const q = from.includes('?') ? from.slice(from.indexOf('?')) : '';
  return `${path}${q}`;
}

export function ViewportVideo({
  src,
  width,
  height,
  mobile = false,
  poster,
}: {
  src: string;
  width?: number;
  height?: number;
  /** When true and a mobile file exists, phones use /mobile/ variant. Desktop always uses `src` (full quality). */
  mobile?: boolean;
  poster?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const holdingPreload = useRef(false);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);

  const [activeSrc, setActiveSrc] = useState(src);

  // Pick mobile vs desktop source without <source media> (404 mobile does not fall back reliably).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => {
      setActiveSrc(mobile && mq.matches ? mobileSrc : src);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobile, mobileSrc]);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const narrow = () => matchMedia('(max-width: 800px)').matches;
    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = false;
    video.controls = reducedMotion.matches;
    // Start cold — metadata on every tile saturates mobile networks.
    video.preload = 'none';

    let visible = false;
    let waiting = false;
    let near = false;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const pause = () => {
      video.autoplay = false;
      video.pause();
    };

    const play = () => {
      video.autoplay = visible && !waiting && !reducedMotion.matches && !document.hidden;
      if (video.autoplay && video.paused) {
        void video.play().catch((error: DOMException) => {
          if (error.name !== 'AbortError') video.controls = true;
        });
      }
    };

    const promotePreload = async () => {
      if (cancelled || holdingPreload.current || video.preload === 'auto') return;
      await acquirePreloadSlot();
      if (cancelled || !near) {
        releasePreloadSlot();
        return;
      }
      holdingPreload.current = true;
      video.preload = 'auto';
      // Ensure the browser actually starts the chosen src (after mobile/desktop swap).
      if (video.dataset.activeSrc !== activeSrc) {
        video.dataset.activeSrc = activeSrc;
        video.src = activeSrc;
      }
      video.load();
    };

    const demotePreload = () => {
      if (!holdingPreload.current) return;
      holdingPreload.current = false;
      if (!visible) {
        video.preload = 'none';
        // Drop buffered data when far away so other clips can load.
        video.removeAttribute('src');
        video.load();
        video.dataset.activeSrc = '';
      }
      releasePreloadSlot();
    };

    const preload = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      if (near) void promotePreload();
      else {
        pause();
        demotePreload();
      }
    }, {
      // Mobile: only warm the next clip. Desktop: warmer lookahead, still originals.
      rootMargin: narrow() ? '120px 0px' : '640px 0px',
    });

    const playback = new IntersectionObserver(([entry]) => {
      const viewportHeight = entry.rootBounds?.height ?? innerHeight;
      const visibleHeight = Math.min(entry.intersectionRect.height, viewportHeight);
      const maximumVisibleHeight = Math.min(entry.boundingClientRect.height, viewportHeight);
      const visibleRatio = entry.isIntersecting && maximumVisibleHeight > 0 ? visibleHeight / maximumVisibleHeight : 0;
      visible = visibleRatio >= 0.4;
      if (visible) {
        if (!holdingPreload.current) void promotePreload();
        play();
      } else {
        pause();
      }
    }, { threshold: [0, 0.1, 0.2, 0.4, 0.6, 0.8, 1] });

    const visibility = () => {
      if (reducedMotion.matches) video.controls = true;
      if (document.hidden || !visible || reducedMotion.matches) pause();
      else play();
    };

    const ended = () => {
      if (!loopDelayMs) return;
      waiting = true;
      video.autoplay = false;
      replayTimer = setTimeout(() => {
        waiting = false;
        video.currentTime = 0;
        play();
      }, loopDelayMs);
    };

    const onError = () => {
      // Mobile file missing/corrupt → fall back to full desktop original (no recompression).
      if (mobile && video.currentSrc.includes('/mobile/') && stripQuery(activeSrc) !== stripQuery(src)) {
        setActiveSrc(src);
      }
    };

    preload.observe(video);
    playback.observe(video);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', visibility);
    video.addEventListener('ended', ended);
    video.addEventListener('canplay', play);
    video.addEventListener('error', onError);

    return () => {
      cancelled = true;
      if (replayTimer) clearTimeout(replayTimer);
      preload.disconnect();
      playback.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      reducedMotion.removeEventListener('change', visibility);
      video.removeEventListener('ended', ended);
      video.removeEventListener('canplay', play);
      video.removeEventListener('error', onError);
      pause();
      demotePreload();
    };
  }, [activeSrc, src, mobile, loopDelayMs]);

  // Keep element src in sync when falling back mobile → desktop.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.dataset.activeSrc === activeSrc) return;
    const wasPlaying = !video.paused;
    video.dataset.activeSrc = activeSrc;
    video.src = activeSrc;
    if (video.preload === 'auto') video.load();
    if (wasPlaying) void video.play().catch(() => {});
  }, [activeSrc]);

  return (
    <video
      ref={ref}
      width={width}
      height={height}
      poster={poster}
      muted
      loop={!loopDelayMs}
      playsInline
      preload="none"
      draggable={false}
      controlsList="nodownload nofullscreen"
      disablePictureInPicture
    />
  );
}
