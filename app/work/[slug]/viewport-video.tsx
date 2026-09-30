'use client';

import { useEffect, useRef, useState } from 'react';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video player — Chrome + mobile.
 *
 * Scramble (slot A showing slot B art) comes from concurrent <video> decoders
 * and revealing before THIS element's currentSrc is confirmed. Fix:
 * - Count-based attach semaphore (no stale DOM node Set)
 * - Attach only when in view; detach when leaving
 * - No HTML poster attr (CSS poster only — avoids mixed poster/frame flashes)
 * - Opaque mask until path-matched first frame
 * - Never put key= on the ref'd <video> (breaks cleanup vs remount)
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

function pathOf(url: string) {
  const bare = stripQuery(url);
  try {
    return bare.startsWith('http') ? new URL(bare).pathname : bare;
  } catch {
    return bare;
  }
}

/** True when the element is actually decoding the requested file (full path, not just 02.mp4). */
function isBoundTo(video: HTMLVideoElement, wantUrl: string) {
  if (video.dataset.want !== wantUrl) return false;
  const wantPath = pathOf(wantUrl);
  const current = video.currentSrc || video.getAttribute('src') || '';
  if (!current) return false;
  return pathOf(current).endsWith(wantPath) || pathOf(current) === wantPath;
}

/** Max simultaneous attached sources site-wide (pair = 2). Uses a count, not element refs. */
const MAX_ATTACHED = 2;
let attachedCount = 0;
const attachWaiters: Array<() => void> = [];

function acquireSlot() {
  return new Promise<() => void>((resolve) => {
    const tryAcquire = () => {
      if (attachedCount >= MAX_ATTACHED) {
        attachWaiters.push(tryAcquire);
        return;
      }
      attachedCount += 1;
      let released = false;
      resolve(() => {
        if (released) return;
        released = true;
        attachedCount = Math.max(0, attachedCount - 1);
        const next = attachWaiters.shift();
        if (next) next();
      });
    };
    tryAcquire();
  });
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

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.controls = reducedMotion.matches;
    video.preload = 'none';
    // CSS poster only — HTML poster can flash the wrong bitmap while src swaps.
    video.removeAttribute('poster');

    let inView = false;
    let waitingLoop = false;
    let cancelled = false;
    let generation = 0;
    let releaseSlot: (() => void) | undefined;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let detachTimer: ReturnType<typeof setTimeout> | undefined;
    let frameCallbackId: number | undefined;

    const hide = () => setReady(false);

    const revealIfValid = () => {
      if (cancelled) return;
      const want = wantRef.current;
      if (!isBoundTo(video, want)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.videoWidth < 2 || video.videoHeight < 2) return;
      setReady(true);
    };

    const armReveal = () => {
      if (cancelled) return;
      if (!isBoundTo(video, wantRef.current)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      const rvfc = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (cb: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      if (typeof rvfc.requestVideoFrameCallback === 'function') {
        if (frameCallbackId !== undefined && typeof rvfc.cancelVideoFrameCallback === 'function') {
          rvfc.cancelVideoFrameCallback(frameCallbackId);
        }
        const gen = generation;
        frameCallbackId = rvfc.requestVideoFrameCallback(() => {
          frameCallbackId = undefined;
          if (cancelled || gen !== generation) return;
          revealIfValid();
        });
        return;
      }
      const gen = generation;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled || gen !== generation) return;
          revealIfValid();
        });
      });
    };

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const detach = () => {
      hide();
      freeze();
      delete video.dataset.want;
      video.preload = 'none';
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* ignore */
      }
      releaseSlot?.();
      releaseSlot = undefined;
    };

    const attach = async () => {
      if (cancelled || !inView) return;
      const want = wantRef.current;
      if (isBoundTo(video, want) && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        armReveal();
        return;
      }

      const gen = ++generation;
      hide();

      if (!releaseSlot) {
        releaseSlot = await acquireSlot();
      }
      if (cancelled || gen !== generation || !inView) {
        releaseSlot?.();
        releaseSlot = undefined;
        return;
      }

      // Hard reset before binding so Chrome cannot keep a previous bitmap.
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* ignore */
      }

      video.dataset.want = want;
      video.preload = isNarrowViewport() ? 'metadata' : 'auto';
      video.src = want;
      try {
        video.load();
      } catch {
        /* ignore */
      }
    };

    const play = () => {
      if (!inView || waitingLoop || reducedMotion.matches || document.hidden) {
        video.autoplay = false;
        return;
      }
      void attach().then(() => {
        if (cancelled || !inView) return;
        video.autoplay = true;
        if (video.paused) {
          void video.play().catch((error: DOMException) => {
            if (error.name !== 'AbortError') video.controls = true;
          });
        }
      });
    };

    const leave = () => {
      hide();
      freeze();
      generation += 1;
      if (detachTimer) clearTimeout(detachTimer);
      // Poster/mask covers while we tear down the decoder.
      detachTimer = setTimeout(() => {
        detachTimer = undefined;
        if (cancelled || inView) return;
        detach();
      }, 200);
    };

    // Poster warm only — do not attach off-screen (that caused multi-decode scramble).
    const nearIo = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || !poster) return;
      const img = new window.Image();
      img.decoding = 'async';
      img.src = poster;
    }, { rootMargin: '240px 0px', threshold: 0 });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (detachTimer) {
        clearTimeout(detachTimer);
        detachTimer = undefined;
      }
      if (inView) play();
      else leave();
    }, {
      rootMargin: isNarrowViewport() ? '32px 0px' : '64px 0px',
      threshold: isNarrowViewport() ? 0.1 : 0.05,
    });

    const onLoaded = () => armReveal();
    const onPlaying = () => armReveal();

    const onEnded = () => {
      if (!loopDelayMs) return;
      waitingLoop = true;
      video.autoplay = false;
      replayTimer = setTimeout(() => {
        waitingLoop = false;
        video.currentTime = 0;
        play();
      }, loopDelayMs);
    };

    const onError = () => {
      if (
        mobile
        && wantRef.current.includes('/mobile/')
        && stripQuery(wantRef.current) !== stripQuery(src)
      ) {
        detach();
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
    video.addEventListener('loadeddata', onLoaded);
    video.addEventListener('canplay', onLoaded);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onVisibility);

    return () => {
      cancelled = true;
      generation += 1;
      if (replayTimer) clearTimeout(replayTimer);
      if (detachTimer) clearTimeout(detachTimer);
      const rvfc = video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
      if (frameCallbackId !== undefined && typeof rvfc.cancelVideoFrameCallback === 'function') {
        rvfc.cancelVideoFrameCallback(frameCallbackId);
      }
      nearIo.disconnect();
      viewIo.disconnect();
      video.removeEventListener('loadeddata', onLoaded);
      video.removeEventListener('canplay', onLoaded);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onVisibility);
      detach();
    };
  }, [activeSrc, src, mobile, loopDelayMs, poster, entryReady]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}${poster ? ' has-poster' : ''}`}>
      {poster ? (
        <span
          className="case-media-poster"
          style={{ backgroundImage: `url(${poster})` }}
          aria-hidden
        />
      ) : null}
      {/* Stable node — do not key-remount; src is owned by the effect. */}
      <video
        ref={ref}
        width={width}
        height={height}
        muted
        loop={!loopDelayMs}
        playsInline
        preload="none"
        draggable={false}
        controlsList="nodownload nofullscreen"
        disablePictureInPicture
      />
      {/* Hard cover until this slot's own frame is confirmed (Chrome-safe). */}
      {!ready ? <span className="case-video-mask" aria-hidden /> : null}
    </span>
  );
}
