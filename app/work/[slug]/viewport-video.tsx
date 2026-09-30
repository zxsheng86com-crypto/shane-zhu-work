'use client';

import { useEffect, useRef, useState } from 'react';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Justified-adapted for local large files:
 * - Attach src when near; on mobile, release when far (frees decoder)
 * - Never reveal the <video> until THIS element's first painted frame
 *   (iOS Safari otherwise briefly paints another slot's frame → "错位")
 * - Poster stays fully opaque until that frame is confirmed
 * - play/pause from intersection only
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
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);

  const [activeSrc, setActiveSrc] = useState(() => pickSrc(src, mobileSrc, mobile));
  const [ready, setReady] = useState(false);

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

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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
    let replayTimer: ReturnType<typeof setTimeout> | undefined;
    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let frameCallbackId: number | undefined;

    const hide = () => {
      setReady(false);
    };

    const reveal = () => {
      if (cancelled) return;
      // Only reveal if this element still owns the expected source.
      if (video.dataset.src !== activeSrc) return;
      const current = video.currentSrc || video.src || '';
      if (current) {
        const want = stripQuery(activeSrc).split('/').pop();
        if (want && !current.includes(want)) return;
      }
      setReady(true);
    };

    /** Wait for a real painted frame of THIS video — not just loadeddata. */
    const armFrameReveal = () => {
      if (cancelled) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      const rvfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
          cancelVideoFrameCallback?: (id: number) => void;
        }
      );
      if (typeof rvfc.requestVideoFrameCallback === 'function') {
        if (frameCallbackId !== undefined && typeof rvfc.cancelVideoFrameCallback === 'function') {
          rvfc.cancelVideoFrameCallback(frameCallbackId);
        }
        frameCallbackId = rvfc.requestVideoFrameCallback(() => {
          frameCallbackId = undefined;
          reveal();
        });
        return;
      }
      // Fallback: two rAFs after we know data exists.
      requestAnimationFrame(() => {
        requestAnimationFrame(reveal);
      });
    };

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const clearSrc = () => {
      attached = false;
      delete video.dataset.src;
      video.preload = 'none';
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* ignore */
      }
    };

    const attach = () => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = undefined;
      }
      if (attached && video.dataset.src === activeSrc) return;
      // Hide BEFORE swapping src so Safari never paints a borrowed frame.
      hide();
      attached = true;
      video.dataset.src = activeSrc;
      video.preload = 'auto';
      video.src = activeSrc;
    };

    const releaseMobile = () => {
      if (!isNarrowViewport()) return;
      hide();
      freeze();
      // Let poster reclaim the surface before dropping the decoder.
      if (releaseTimer) clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => {
        releaseTimer = undefined;
        if (cancelled || inView) return;
        clearSrc();
      }, 280);
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
      if (entry.isIntersecting) attach();
      else releaseMobile();
    }, {
      // Tight margin on phones: fewer simultaneous decoders = less frame bleed.
      rootMargin: isNarrowViewport() ? '120px 0px' : '480px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else freeze();
    }, { threshold: 0 });

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
        && (video.currentSrc.includes('/mobile/') || activeSrc.includes('/mobile/'))
        && stripQuery(activeSrc) !== stripQuery(src)
      ) {
        hide();
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
    };
  }, [activeSrc, src, mobile, loopDelayMs]);

  return (
    <span className={`case-video${ready ? ' is-ready' : ''}${poster ? ' has-poster' : ''}`}>
      {poster ? <span className="case-media-poster" style={{ backgroundImage: `url(${poster})` }} aria-hidden /> : null}
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
    </span>
  );
}
