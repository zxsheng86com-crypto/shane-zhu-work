'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video — one slot, one file.
 *
 * Rules:
 * - Exact pathname match only (no endsWith)
 * - Bind only near the viewport
 * - Pause offscreen, retaining the loaded frame for an immediate return
 */

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


export function ViewportVideo({
  src,
  width,
  height,
  mobile = false,
  slot,
}: {
  src: string;
  width?: number;
  height?: number;
  mobile?: boolean;
  slot?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);
  // Pre-warm only the first one–two slots; everything else binds on approach.
  const eager = typeof slot === 'number' && slot >= 1 && slot <= (isNarrowViewport() ? 1 : 2);

  const [activeSrc, setActiveSrc] = useState(() => pickSrc(src, mobileSrc, mobile));
  const [ready, setReady] = useState(false);
  const wantRef = useRef(activeSrc);
  wantRef.current = activeSrc;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
    const sync = () => setActiveSrc(pickSrc(src, mobileSrc, mobile));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobile, mobileSrc]);

  useLayoutEffect(() => {
    setReady(false);
  }, [activeSrc]);

  // Bind before entering view; cancel only unfinished offscreen requests.
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
    let frameCallbackId: number | undefined;
    let replayTimer: ReturnType<typeof setTimeout> | undefined;

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
      clearPipeline();
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
      if (!inView || waitingLoop || reducedMotion.matches || document.hidden) {
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

    const bindToWant = () => {
      const want = wantRef.current;
      if (cancelled) return;
      if (bound && isBoundTo(video, want)) {
        playIfAllowed();
        return;
      }

      hide();
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

    const nearIo = new IntersectionObserver(([entry]) => {
      near = entry.isIntersecting;
      if (near) {
        bindToWant();
      } else if (!inView) {
        freeze();
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) clearPipeline();
      }
    }, {
      rootMargin: isNarrowViewport() ? '320px 0px' : '700px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) {
        near = true;
        bindToWant();
      } else {
        freeze();
        if (!near && video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) clearPipeline();
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

    if (eager) bindToWant();

    return () => {
      cancelled = true;
      if (replayTimer) clearTimeout(replayTimer);
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
  }, [activeSrc, src, mobile, mobileSrc, loopDelayMs, eager]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}`}>
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
