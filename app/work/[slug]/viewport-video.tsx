'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video — one slot, one file.
 *
 * Scramble (slot A painting slot B frames) is Safari/Chrome decoder bleed when
 * too many <video src> stay attached. Rules:
 * - Exact pathname match only (no endsWith)
 * - Cap concurrent attached sources site-wide
 * - Detach when leaving view (gray until rebound)
 * - Never tear down bind when the entry gate opens — only gate play()
 */

function isSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|Firefox|Android/i.test(ua);
}

function isNarrowViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
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
    const path = bare.startsWith('http') ? new URL(bare).pathname : bare;
    return decodeURIComponent(path);
  } catch {
    return bare;
  }
}

function isBoundTo(video: HTMLVideoElement, wantUrl: string) {
  if (video.dataset.want !== wantUrl) return false;
  const wantPath = pathOf(wantUrl);
  const current = video.currentSrc || video.getAttribute('src') || '';
  if (!current) return false;
  return pathOf(current) === wantPath;
}

/** Max simultaneous attached MP4 sources. Count-based — no stale element Set. */
function maxAttached() {
  if (isSafari() || isNarrowViewport()) return 1;
  return 2;
}

let attachedCount = 0;
const attachWaiters: Array<() => void> = [];

function acquireAttach(): Promise<() => void> {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (attachedCount >= maxAttached()) {
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
  slot,
}: {
  src: string;
  width?: number;
  height?: number;
  mobile?: boolean;
  poster?: string;
  slot?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const entryReady = useCaseEntryReady();
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);
  // Pre-warm only the first one–two slots; everything else binds on approach.
  const eager = typeof slot === 'number' && slot >= 1 && slot <= (isNarrowViewport() ? 1 : 2);

  const [activeSrc, setActiveSrc] = useState(() => pickSrc(src, mobileSrc, mobile));
  const [ready, setReady] = useState(false);
  const [posterReady, setPosterReady] = useState(false);
  const wantRef = useRef(activeSrc);
  wantRef.current = activeSrc;
  const entryReadyRef = useRef(entryReady);
  entryReadyRef.current = entryReady;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
    const sync = () => setActiveSrc(pickSrc(src, mobileSrc, mobile));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobile, mobileSrc]);

  useEffect(() => {
    if (!poster) return;
    let active = true;
    const preview = new window.Image();
    preview.onload = () => {
      if (active) setPosterReady(true);
    };
    preview.src = poster;
    if (preview.complete && preview.naturalWidth > 0) setPosterReady(true);
    return () => {
      active = false;
    };
  }, [poster]);

  useLayoutEffect(() => {
    setReady(false);
  }, [activeSrc]);

  // Bind / detach — does NOT depend on entryReady (avoids full rebind on gate open).
  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === 'undefined') return;

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
    let near = false;
    let waitingLoop = false;
    let cancelled = false;
    let bound = false;
    let bindGen = 0;
    let releaseAttach: (() => void) | null = null;
    let acquireToken = 0;
    let frameCallbackId: number | undefined;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let detachTimer: ReturnType<typeof setTimeout> | undefined;

    const hide = () => setReady(false);

    const clearPipeline = () => {
      hide();
      bound = false;
      video.dataset.want = '';
      video.dataset.bindGen = '';
      video.autoplay = false;
      try {
        video.pause();
      } catch { /* ignore */ }
      try {
        video.removeAttribute('src');
        video.load();
      } catch { /* ignore */ }
      video.preload = 'none';
    };

    const detach = () => {
      if (detachTimer) {
        clearTimeout(detachTimer);
        detachTimer = undefined;
      }
      clearPipeline();
      if (releaseAttach) {
        releaseAttach();
        releaseAttach = null;
      }
    };

    const revealIfValid = () => {
      if (cancelled) return;
      const want = wantRef.current;
      if (!isBoundTo(video, want)) return;
      if (Number(video.dataset.bindGen || '0') !== bindGen) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.videoWidth < 2 || video.videoHeight < 2) return;
      setReady(true);
    };

    const armReveal = () => {
      if (cancelled) return;
      if (!isBoundTo(video, wantRef.current)) return;
      if (Number(video.dataset.bindGen || '0') !== bindGen) return;
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
          revealIfValid();
        });
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(revealIfValid));
    };

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const playIfAllowed = () => {
      if (!entryReadyRef.current || !inView || waitingLoop || reducedMotion.matches || document.hidden) {
        freeze();
        return;
      }
      if (!bound || !isBoundTo(video, wantRef.current)) return;
      video.autoplay = true;
      if (video.paused) {
        void video.play().catch((error: DOMException) => {
          if (error.name !== 'AbortError') video.controls = true;
        });
      }
    };

    const bindToWant = async () => {
      const want = wantRef.current;
      if (cancelled) return;
      if (bound && isBoundTo(video, want) && releaseAttach) {
        playIfAllowed();
        return;
      }

      hide();
      const token = ++acquireToken;
      if (!releaseAttach) {
        releaseAttach = await acquireAttach();
        if (cancelled || token !== acquireToken) {
          releaseAttach();
          releaseAttach = null;
          return;
        }
      }

      if (detachTimer) {
        clearTimeout(detachTimer);
        detachTimer = undefined;
      }

      bound = true;
      bindGen += 1;
      video.dataset.bindGen = String(bindGen);
      video.dataset.want = want;
      video.preload = 'auto';
      video.src = want;
      try {
        video.load();
      } catch { /* ignore */ }
      playIfAllowed();
    };

    const scheduleDetach = () => {
      if (detachTimer) clearTimeout(detachTimer);
      // Short grace so tiny scroll jank doesn't churn; then free the decoder slot.
      detachTimer = setTimeout(() => {
        detachTimer = undefined;
        if (!near && !inView) detach();
      }, 220);
    };

    const nearIo = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      if (near) {
        if (poster) {
          const img = new window.Image();
          img.decoding = 'async';
          img.src = poster;
        }
        void bindToWant();
      } else if (!inView) {
        freeze();
        scheduleDetach();
      }
    }, {
      rootMargin: isNarrowViewport() ? '60px 0px' : '120px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        near = true;
        void bindToWant().then(() => playIfAllowed());
      } else {
        freeze();
        if (!near) scheduleDetach();
      }
    }, {
      rootMargin: '0px',
      threshold: 0.01,
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
        playIfAllowed();
      }, loopDelayMs);
    };

    const onError = () => {
      hide();
      if (
        mobile
        && !wantRef.current.includes('/mobile/')
        && stripQuery(mobileSrc) !== stripQuery(wantRef.current)
      ) {
        detach();
        setActiveSrc(mobileSrc);
        return;
      }
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
      else playIfAllowed();
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

    if (eager) void bindToWant();

    return () => {
      cancelled = true;
      acquireToken += 1;
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
  }, [activeSrc, src, mobile, mobileSrc, loopDelayMs, poster, eager]);

  // Play gate only — must not rebind / clear src when the entry loader finishes.
  useEffect(() => {
    entryReadyRef.current = entryReady;
    const video = ref.current;
    if (!video) return;
    if (!entryReady) {
      video.autoplay = false;
      if (!video.paused) video.pause();
      return;
    }
    const rect = video.getBoundingClientRect();
    const visible = rect.bottom > 40 && rect.top < window.innerHeight - 40;
    if (
      visible
      && isBoundTo(video, wantRef.current)
      && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      video.autoplay = true;
      void video.play().catch(() => { /* ignore */ });
    }
  }, [entryReady]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}${posterReady ? ' is-poster-ready' : ''}${poster ? ' has-poster' : ''}`}>
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
