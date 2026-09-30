'use client';

import { useEffect, useRef, useState } from 'react';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video — anti-scramble rules (Web + mobile):
 *
 * 1. Never paint until THIS element has a verified first frame (visibility:hidden
 *    until is-ready — opacity alone is not enough on Safari).
 * 2. Cap concurrent attached <video src> globally (decoder frame bleed).
 * 3. Attach only when in/near view; detach when leaving so the next slot cannot
 *    inherit another clip's frame.
 * 4. Reveal only after requestVideoFrameCallback (or double-rAF) AND currentSrc
 *    filename matches the requested asset.
 */

function isNarrowViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;
}

function stripQuery(path: string) {
  return path.split('?')[0];
}

function withQuery(path: string, from: string) {
  const q = from.includes('?') ? from.slice(from.indexOf('?')) : '';
  return `${path}${q}`;
}

function pickSrc(src: string, mobileSrc: string, allowMobile: boolean) {
  if (allowMobile && isNarrowViewport()) return mobileSrc;
  return src;
}

function fileName(url: string) {
  return stripQuery(url).split('/').pop() || '';
}

function srcMatches(video: HTMLVideoElement, wantUrl: string) {
  const want = fileName(wantUrl);
  if (!want) return false;
  if (video.dataset.src !== wantUrl) return false;
  const current = video.currentSrc || video.getAttribute('src') || '';
  if (!current) return false;
  return current.includes(want);
}

/** Global attach pool — Safari bleeds frames across simultaneous decoders. */
const MAX_OWNERS = 2;
const owners = new Set<HTMLVideoElement>();
const waiters: Array<{ video: HTMLVideoElement; resolve: () => void }> = [];

function claimOwner(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (owners.has(video) || owners.size < MAX_OWNERS) {
      owners.add(video);
      resolve();
      return;
    }
    waiters.push({ video, resolve });
  });
}

function releaseOwner(video: HTMLVideoElement) {
  if (!owners.has(video)) return;
  owners.delete(video);
  const next = waiters.shift();
  if (!next) return;
  owners.add(next.video);
  next.resolve();
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
  mobile?: boolean;
  poster?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const entryReady = useCaseEntryReady();
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);

  const [activeSrc, setActiveSrc] = useState(() => pickSrc(src, mobileSrc, mobile));
  const [ready, setReady] = useState(false);
  const wantRef = useRef(activeSrc);
  wantRef.current = activeSrc;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => setActiveSrc(pickSrc(src, mobileSrc, mobile));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobile, mobileSrc]);

  useEffect(() => {
    setReady(false);
  }, [activeSrc]);

  useEffect(() => {
    const video = ref.current;
    if (!entryReady || !video || typeof IntersectionObserver === 'undefined') return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const phone = () => isNarrowViewport();

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.controls = reducedMotion.matches;
    video.preload = 'none';

    let inView = false;
    let waiting = false;
    let attached = false;
    let cancelled = false;
    let attachGeneration = 0;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let frameCallbackId: number | undefined;

    const hide = () => setReady(false);

    const reveal = () => {
      if (cancelled) return;
      const want = wantRef.current;
      if (!srcMatches(video, want)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      setReady(true);
    };

    const armFrameReveal = () => {
      if (cancelled) return;
      const want = wantRef.current;
      if (!srcMatches(video, want)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      const rvfc = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      if (typeof rvfc.requestVideoFrameCallback === 'function') {
        if (frameCallbackId !== undefined && typeof rvfc.cancelVideoFrameCallback === 'function') {
          rvfc.cancelVideoFrameCallback(frameCallbackId);
        }
        frameCallbackId = rvfc.requestVideoFrameCallback(() => {
          frameCallbackId = undefined;
          // Re-check after the compositor has this element's frame.
          reveal();
        });
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(reveal));
    };

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const clearSrc = () => {
      attached = false;
      hide();
      delete video.dataset.src;
      video.preload = 'none';
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* ignore */
      }
      releaseOwner(video);
    };

    const attachNow = () => {
      if (cancelled || !inView) return;
      const want = wantRef.current;
      if (attached && video.dataset.src === want && srcMatches(video, want)) return;

      // Drop any previous decoder state before binding a new URL.
      hide();
      if (attached || video.getAttribute('src')) {
        delete video.dataset.src;
        video.removeAttribute('src');
        try {
          video.load();
        } catch {
          /* ignore */
        }
      }

      attached = true;
      video.dataset.src = want;
      video.preload = phone() ? 'metadata' : 'auto';
      video.src = want;
    };

    const attach = () => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = undefined;
      }
      const want = wantRef.current;
      if (attached && video.dataset.src === want && srcMatches(video, want)) return;

      const generation = ++attachGeneration;
      void claimOwner(video).then(() => {
        if (cancelled || generation !== attachGeneration || !inView) {
          releaseOwner(video);
          return;
        }
        attachNow();
      });
    };

    const releaseWhenAway = () => {
      hide();
      freeze();
      attachGeneration += 1;
      if (releaseTimer) clearTimeout(releaseTimer);
      // Keep poster covering while decoder tears down.
      releaseTimer = setTimeout(() => {
        releaseTimer = undefined;
        if (cancelled || inView) return;
        clearSrc();
      }, phone() ? 360 : 220);
    };

    const play = () => {
      if (!inView || waiting || reducedMotion.matches || document.hidden) {
        video.autoplay = false;
        return;
      }
      attach();
      video.autoplay = true;
      if (video.paused) {
        void video.play().catch((error: DOMException) => {
          if (error.name !== 'AbortError') video.controls = true;
        });
      }
    };

    const nearIo = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      if (poster) {
        const img = new window.Image();
        img.decoding = 'async';
        img.src = poster;
      }
      // Warm attach only on desktop near-zone; phones wait for viewIo.
      if (!phone()) attach();
    }, {
      rootMargin: phone() ? '120px 0px' : '200px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else releaseWhenAway();
    }, {
      rootMargin: phone() ? '24px 0px' : '80px 0px',
      threshold: phone() ? 0.12 : 0.02,
    });

    const onReady = () => {
      armFrameReveal();
      if (inView) play();
    };

    const onPlaying = () => armFrameReveal();

    const onEnded = () => {
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
      if (
        mobile
        && (video.currentSrc.includes('/mobile/') || wantRef.current.includes('/mobile/'))
        && stripQuery(wantRef.current) !== stripQuery(src)
      ) {
        clearSrc();
        setActiveSrc(src);
      }
    };

    const onVisibility = () => {
      if (reducedMotion.matches) video.controls = true;
      if (document.hidden || reducedMotion.matches) freeze();
      else if (inView) play();
    };

    nearIo.observe(video);
    viewIo.observe(video);
    video.addEventListener('loadeddata', onReady);
    video.addEventListener('canplay', onReady);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onVisibility);

    return () => {
      cancelled = true;
      attachGeneration += 1;
      if (replayTimer) clearTimeout(replayTimer);
      if (releaseTimer) clearTimeout(releaseTimer);
      const rvfc = video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
      if (frameCallbackId !== undefined && typeof rvfc.cancelVideoFrameCallback === 'function') {
        rvfc.cancelVideoFrameCallback(frameCallbackId);
      }
      nearIo.disconnect();
      viewIo.disconnect();
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onVisibility);
      freeze();
      clearSrc();
    };
  }, [activeSrc, src, mobile, loopDelayMs, poster, entryReady]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}${poster ? ' has-poster' : ''}`}>
      {poster ? <span className="case-media-poster" style={{ backgroundImage: `url(${poster})` }} aria-hidden /> : null}
      <video
        key={activeSrc}
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
    </span>
  );
}
