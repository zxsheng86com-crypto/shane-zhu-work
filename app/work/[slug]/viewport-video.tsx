'use client';

import { useEffect, useRef, useState } from 'react';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Justified-adapted for local large files:
 * - Attach src when near (no global queue)
 * - Keep src after attach on mobile AND desktop (pause = freeze frame)
 * - Never detach on scroll — remounting caused mobile scramble / wrong frames
 * - preload=metadata; play/pause from intersection only
 * - Sharp poster under video until first frame fades in
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
    let replayTimer: ReturnType<typeof setTimeout> | undefined;

    const freeze = () => {
      video.autoplay = false;
      if (!video.paused) video.pause();
    };

    const attach = () => {
      if (attached && video.dataset.src === activeSrc) return;
      attached = true;
      video.dataset.src = activeSrc;
      video.preload = 'metadata';
      video.src = activeSrc;
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
      // Keep src attached — pause only via viewIo (avoids mobile reload scramble).
    }, {
      rootMargin: isNarrowViewport() ? '240px 0px' : '480px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else freeze();
    }, { threshold: 0 });

    const onReady = () => {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) setReady(true);
      if (inView) play();
    };

    const onPlaying = () => setReady(true);

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
        attached = false;
        delete video.dataset.src;
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
      if (replayTimer) clearTimeout(replayTimer);
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
