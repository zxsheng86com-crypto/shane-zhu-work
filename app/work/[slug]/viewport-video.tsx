'use client';

import { useEffect, useRef, useState } from 'react';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Justified-adapted for local large files + slow production CDN:
 *
 * Desktop: attach when near, keep src, pause off-screen.
 * Mobile (phones / slow CDN — this is where LAN vs Vercel diverges):
 * - Only ONE <video> may hold a src at a time (serial decoder)
 * - Attach only when actually in view (not a large near-margin)
 * - Hide with visibility until THIS element's first painted frame
 * - Release src when leaving view so the next slot cannot inherit a frame
 *
 * LAN feels fine because files arrive instantly; production (esp. CN → SFO)
 * keeps many downloads in flight and Safari briefly paints the wrong slot.
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

/** Mobile: at most two elements may hold an attached video src (covers media-pair). */
const MOBILE_MAX_OWNERS = 2;
const mobileOwners = new Set<HTMLVideoElement>();
const mobileWaiters: Array<{ video: HTMLVideoElement; resolve: () => void }> = [];

function claimMobileOwner(video: HTMLVideoElement) {
  return new Promise<void>((resolve) => {
    if (mobileOwners.has(video) || mobileOwners.size < MOBILE_MAX_OWNERS) {
      mobileOwners.add(video);
      resolve();
      return;
    }
    mobileWaiters.push({ video, resolve });
  });
}

function releaseMobileOwner(video: HTMLVideoElement) {
  if (!mobileOwners.has(video)) return;
  mobileOwners.delete(video);
  const next = mobileWaiters.shift();
  if (!next) return;
  mobileOwners.add(next.video);
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
      if (video.dataset.src !== activeSrc) return;
      const current = video.currentSrc || video.src || '';
      if (current) {
        const want = stripQuery(activeSrc).split('/').pop();
        if (want && !current.includes(want)) return;
      }
      setReady(true);
    };

    const armFrameReveal = () => {
      if (cancelled) return;
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
      delete video.dataset.src;
      video.preload = 'none';
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* ignore */
      }
      releaseMobileOwner(video);
    };

    const attachNow = () => {
      if (cancelled || !inView) return;
      if (attached && video.dataset.src === activeSrc) return;
      hide();
      attached = true;
      video.dataset.src = activeSrc;
      // metadata is enough to get a first frame; auto fights the CDN on phones.
      video.preload = phone() ? 'metadata' : 'auto';
      video.src = activeSrc;
    };

    const attach = () => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = undefined;
      }
      if (attached && video.dataset.src === activeSrc) return;

      if (!phone()) {
        attachNow();
        return;
      }

      const generation = ++attachGeneration;
      void claimMobileOwner(video).then(() => {
        if (cancelled || generation !== attachGeneration || !inView) {
          releaseMobileOwner(video);
          return;
        }
        attachNow();
      });
    };

    const releaseIfPhone = () => {
      if (!phone()) return;
      hide();
      freeze();
      attachGeneration += 1;
      if (releaseTimer) clearTimeout(releaseTimer);
      // Poster must cover before we drop the decoder — longer on slow CDN.
      releaseTimer = setTimeout(() => {
        releaseTimer = undefined;
        if (cancelled || inView) return;
        clearSrc();
      }, 360);
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

    // Desktop: warm when near. Mobile: do NOT attach early — only viewIo attaches.
    const nearIo = new IntersectionObserver(([entry]) => {
      if (phone()) {
        // Warm poster only (cheap). Never touch video.src off-screen on phones.
        if (entry.isIntersecting && poster) {
          const img = new window.Image();
          img.decoding = 'async';
          img.src = poster;
        }
        return;
      }
      if (entry.isIntersecting) attach();
    }, {
      rootMargin: phone() ? '200px 0px' : '480px 0px',
      threshold: 0,
    });

    const viewIo = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      if (inView) play();
      else {
        freeze();
        releaseIfPhone();
      }
    }, {
      // Tiny positive margin so a slot isn't dropped mid-viewport bounce.
      rootMargin: phone() ? '40px 0px' : '0px',
      threshold: phone() ? 0.15 : 0,
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
      hide();
      clearSrc();
    };
  }, [activeSrc, src, mobile, loopDelayMs, poster, entryReady]);

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
