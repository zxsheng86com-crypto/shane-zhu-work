'use client';

import { useEffect, useRef, useState } from 'react';
import {
  enqueueCaseVideoBind,
  entryUnitId,
  reportCaseEntryShare,
} from '../../case-entry-progress';
import { useCaseEntryReady } from './case-entry-gate';

export const videoLoopDelays: Record<string, number> = {
  '/media/dji-aura/04.mp4': 1000,
};

/**
 * Case video — load once, keep forever on this page.
 *
 * Entry slots (01–06) bind during the black gate via real <video> decode
 * (Safari cannot reuse fetch() for media). Off-screen = pause only.
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

function isBoundTo(video: HTMLVideoElement, wantUrl: string) {
  if (video.dataset.want !== wantUrl) return false;
  const wantPath = pathOf(wantUrl);
  const current = video.currentSrc || video.getAttribute('src') || '';
  if (!current) return false;
  const curPath = pathOf(current);
  return curPath === wantPath || curPath.endsWith(wantPath);
}

/** Safari often needs a tiny seek before the first frame is paintable. */
function nudgeFirstFrame(video: HTMLVideoElement) {
  try {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    if (!video.paused) return;
    const from = video.currentTime;
    const probe = from > 0.05 ? from : Math.min(0.08, Math.max(0.001, (video.duration || 1) * 0.001));
    video.currentTime = probe;
    if (from === 0) {
      const restore = () => {
        try {
          if (video.currentTime !== 0) video.currentTime = 0;
        } catch {
          /* ignore */
        }
        video.removeEventListener('seeked', restore);
      };
      video.addEventListener('seeked', restore);
    }
  } catch {
    /* ignore */
  }
}

export function ViewportVideo({
  src,
  width,
  height,
  mobile = false,
  poster,
  eager = false,
  entrySlug,
  entrySlot,
}: {
  src: string;
  width?: number;
  height?: number;
  mobile?: boolean;
  poster?: string;
  /** Bind early (slots 01–08). */
  eager?: boolean;
  /** When set with entrySlot ≤ 6, this player feeds the entry progress gate. */
  entrySlug?: string;
  entrySlot?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const loopDelayMs = Math.max(0, videoLoopDelays[stripQuery(src)] ?? 0);
  const entryReady = useCaseEntryReady();
  const mobileSrc = withQuery(src.replace(/\/([^/?]+)(\?.*)?$/, '/mobile/$1'), src);
  const feedsEntry =
    Boolean(entrySlug)
    && typeof entrySlot === 'number'
    && entrySlot >= 1
    && entrySlot <= 6;

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
    // Entry/eager slots bind even while the gate is up; others wait for entryReady.
    if (!video || typeof IntersectionObserver === 'undefined') return;
    if (!entryReady && !eager && !feedsEntry) return;

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
    const entryId =
      feedsEntry && entrySlug && entrySlot
        ? entryUnitId(entrySlug, entrySlot, 'video')
        : null;

    const hide = () => setReady(false);

    const reportEntry = (ratio: number) => {
      if (!entrySlug || !entryId) return;
      reportCaseEntryShare(entrySlug, entryId, ratio);
    };

    const revealIfValid = () => {
      if (cancelled) return;
      const want = wantRef.current;
      if (!isBoundTo(video, want)) return;
      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
      if (video.videoWidth < 2 || video.videoHeight < 2) return;
      reportEntry(1);
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
        // Safari may never fire RVFC while paused — don't hang the gray mask.
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
      } catch {
        /* ignore */
      }
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

    const onProgress = () => {
      if (!entryId || !isBoundTo(video, wantRef.current)) return;
      try {
        if (video.buffered.length > 0 && video.duration > 0) {
          reportEntry(Math.min(0.99, video.buffered.end(video.buffered.length - 1) / video.duration));
        }
      } catch {
        /* ignore */
      }
    };

    const onLoaded = () => {
      onProgress();
      armReveal();
    };
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
        bound = false;
        hide();
        setActiveSrc(src);
        return;
      }
      // Don't block the entry gate forever on a dead file.
      reportEntry(1);
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
    video.addEventListener('progress', onProgress);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onVisibility);

    const shouldBindNow = eager || feedsEntry;
    if (shouldBindNow) {
      if (poster) {
        const img = new window.Image();
        img.decoding = 'async';
        img.src = poster;
      }
      void enqueueCaseVideoBind(async () => {
        if (cancelled) return;
        ensureBound();
        // Give this clip time to reach a frame before the next eager bind.
        await new Promise<void>((resolve) => {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 1) {
            reportEntry(1);
            resolve();
            return;
          }
          const done = () => {
            video.removeEventListener('loadeddata', done);
            video.removeEventListener('error', done);
            window.clearTimeout(timer);
            resolve();
          };
          const timer = window.setTimeout(done, 12000);
          video.addEventListener('loadeddata', done);
          video.addEventListener('error', done);
        });
      });
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
      video.removeEventListener('progress', onProgress);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('error', onError);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onVisibility);
      freeze();
    };
  }, [activeSrc, src, mobile, loopDelayMs, poster, entryReady, eager, feedsEntry, entrySlug, entrySlot]);

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
