'use client';

import { useEffect, useRef, useState } from 'react';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video — bind once, keep forever.
 * Eager slots start decoding under the entry gate; play only after the gate opens.
 */

function isSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|Android/i.test(ua);
}

/** Safari: one eager bind at a time. */
let safariEagerTail: Promise<void> = Promise.resolve();
function enqueueSafariEagerBind(task: () => Promise<void>) {
  const run = safariEagerTail.then(task, task);
  safariEagerTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

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

function isBoundTo(video: HTMLVideoElement, wantUrl: string) {
  if (video.dataset.want !== wantUrl) return false;
  const wantPath = pathOf(wantUrl);
  const current = video.currentSrc || video.getAttribute('src') || '';
  if (!current) return false;
  const curPath = pathOf(current);
  return curPath === wantPath || curPath.endsWith(wantPath);
}

function nudgeFirstFrame(video: HTMLVideoElement) {
  try {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !video.paused) return;
    const from = video.currentTime;
    video.currentTime = from > 0.05 ? from : Math.min(0.08, Math.max(0.001, (video.duration || 1) * 0.001));
    if (from === 0) {
      const restore = () => {
        try {
          if (video.currentTime !== 0) video.currentTime = 0;
        } catch { /* ignore */ }
        video.removeEventListener('seeked', restore);
      };
      video.addEventListener('seeked', restore);
    }
  } catch { /* ignore */ }
}

export function ViewportVideo({
  src,
  width,
  height,
  mobile = false,
  poster,
  slot,
}: {
  src: string;
  width?: number;
  height?: number;
  mobile?: boolean;
  poster?: string;
  /** Case slot number — used to limit eager binds on phones. */
  slot?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const entryReady = useCaseEntryReady();
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);
  // Phones: only pre-bind the first couple; desktop can warm a short runway.
  const eager = typeof slot === 'number' && slot >= 1 && slot <= (isNarrowViewport() ? 2 : 6);

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
    if (!video || typeof IntersectionObserver === 'undefined') return;
    if (!entryReady && !eager) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.controls = reducedMotion.matches;
    video.preload = 'none';
    video.removeAttribute('poster');

    let inView = false;
    let waitingLoop = false;
    let cancelled = false;
    let bound = false;
    let frameCallbackId: number | undefined;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let revealFallback: ReturnType<typeof setTimeout> | undefined;

    const hide = () => setReady(false);

    const revealIfValid = () => {
      if (cancelled) return;
      if (!isBoundTo(video, wantRef.current)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.videoWidth < 2 || video.videoHeight < 2) return;
      setReady(true);
    };

    const armReveal = () => {
      if (cancelled) return;
      if (!isBoundTo(video, wantRef.current)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      nudgeFirstFrame(video);

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
          revealIfValid();
        });
        if (revealFallback) clearTimeout(revealFallback);
        revealFallback = setTimeout(revealIfValid, 120);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(revealIfValid));
    };

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const ensureBound = () => {
      const want = wantRef.current;
      if (bound && isBoundTo(video, want)) return;
      hide();
      bound = true;
      video.dataset.want = want;
      video.preload = 'auto';
      video.src = want;
      try {
        video.load();
      } catch { /* ignore */ }
    };

    const play = () => {
      if (!entryReady || !inView || waitingLoop || reducedMotion.matches || document.hidden) {
        video.autoplay = false;
        return;
      }
      ensureBound();
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
      ensureBound();
      if (inView) play();
    }, {
      rootMargin: isNarrowViewport() ? '280px 0px' : '480px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else freeze();
    }, {
      rootMargin: isNarrowViewport() ? '40px 0px' : '80px 0px',
      threshold: 0.05,
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
      // Desktop AE exports can exceed Safari decode limits — fall back to mobile MP4.
      if (
        mobile
        && !wantRef.current.includes('/mobile/')
        && stripQuery(mobileSrc) !== stripQuery(wantRef.current)
      ) {
        bound = false;
        hide();
        setActiveSrc(mobileSrc);
        return;
      }
      if (
        mobile
        && wantRef.current.includes('/mobile/')
        && stripQuery(wantRef.current) !== stripQuery(src)
      ) {
        bound = false;
        hide();
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

    if (eager) {
      if (poster) {
        const img = new window.Image();
        img.decoding = 'async';
        img.src = poster;
      }
      // Mobile Chrome also has a small decode pool — serialize eager binds everywhere.
      if (isSafari() || isNarrowViewport()) {
        void enqueueSafariEagerBind(() => {
          if (!cancelled) ensureBound();
          return new Promise<void>((resolve) => {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              resolve();
              return;
            }
            const done = () => {
              video.removeEventListener('loadeddata', done);
              video.removeEventListener('error', done);
              window.clearTimeout(timer);
              resolve();
            };
            const timer = window.setTimeout(done, 10000);
            video.addEventListener('loadeddata', done);
            video.addEventListener('error', done);
          });
        });
      } else {
        ensureBound();
      }
    }

    return () => {
      cancelled = true;
      if (replayTimer) clearTimeout(replayTimer);
      if (revealFallback) clearTimeout(revealFallback);
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
      freeze();
    };
  }, [activeSrc, src, mobile, mobileSrc, loopDelayMs, poster, entryReady, eager]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}${poster ? ' has-poster' : ''}`}>
      {poster ? (
        <span
          className="case-media-poster"
          style={{ backgroundImage: `url(${poster})` }}
          aria-hidden
        />
      ) : null}
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
      <span className="case-video-mask" aria-hidden />
    </span>
  );
}
