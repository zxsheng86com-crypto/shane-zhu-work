'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

function isNarrowViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;
}

function pickSrc(src: string, mobileSrc: string | undefined, allowMobile: boolean) {
  if (allowMobile && mobileSrc && isNarrowViewport()) return mobileSrc;
  return src;
}

function pathOf(url: string) {
  const bare = url.split('?')[0];
  try {
    return bare.startsWith('http') ? new URL(bare).pathname : bare;
  } catch {
    return bare;
  }
}

/** True only when the element is decoding THIS still (full path). */
function matchesWant(img: HTMLImageElement, wantUrl: string) {
  const want = pathOf(wantUrl);
  const current = pathOf(img.currentSrc || img.getAttribute('src') || '');
  if (!current || !want) return false;
  return current === want || current.endsWith(want);
}

/**
 * Case still — never reveal until THIS slot's file is confirmed in currentSrc.
 * Solid gray until then (no cross-fade of a foreign bitmap).
 */
export function CaseStill({
  src,
  mobileSrc,
  lqip,
  sizes = '(max-width: 1024px) 100vw, 81vw',
  priority = false,
}: {
  src: string;
  mobileSrc?: string;
  lqip?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const allowMobile = Boolean(mobileSrc);
  const [activeSrc, setActiveSrc] = useState(() => pickSrc(src, mobileSrc, allowMobile));
  const [ready, setReady] = useState(false);
  const wantRef = useRef(activeSrc);
  wantRef.current = activeSrc;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => setActiveSrc(pickSrc(src, mobileSrc, allowMobile));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobileSrc, allowMobile]);

  // Hide before paint when the target file changes — prevents one-frame foreign flash.
  useLayoutEffect(() => {
    setReady(false);
  }, [activeSrc]);

  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;

    let cancelled = false;

    const revealIfValid = () => {
      if (cancelled) return;
      if (!matchesWant(node, wantRef.current)) return;
      if (!node.complete || node.naturalWidth < 2) return;
      setReady(true);
    };

    // Cached decode can skip onLoad.
    if (node.complete) revealIfValid();

    const onLoad = () => revealIfValid();
    const onError = () => {
      // Stay gray — never reveal a broken/foreign paint.
      setReady(false);
    };

    node.addEventListener('load', onLoad);
    node.addEventListener('error', onError);
    return () => {
      cancelled = true;
      node.removeEventListener('load', onLoad);
      node.removeEventListener('error', onError);
    };
  }, [activeSrc]);

  return (
    <span className={`case-still${ready ? ' is-ready' : ''}${lqip ? ' has-lqip' : ''}`}>
      {lqip ? <span className="case-media-lqip" style={{ backgroundImage: `url(${lqip})` }} aria-hidden /> : null}
      {/* Native img — Next/Image cache can paint a foreign bitmap for one frame. */}
      <img
        ref={imgRef}
        src={activeSrc}
        alt=""
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        data-pin-nopin="true"
      />
      <span className="case-video-mask" aria-hidden />
    </span>
  );
}
