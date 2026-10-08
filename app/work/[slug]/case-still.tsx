'use client';

import { useEffect, useRef, useState } from 'react';

function pickSrc(src: string, mobileSrc: string | undefined, allowMobile: boolean) {
  if (allowMobile && mobileSrc && window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches) return mobileSrc;
  return src;
}

function pathOf(url: string) {
  const bare = url.split('?')[0];
  try {
    const path = bare.startsWith('http') ? new URL(bare).pathname : bare;
    return decodeURIComponent(path);
  } catch {
    return bare;
  }
}

/** True only when the element is decoding THIS still (full path). */
function matchesWant(img: HTMLImageElement, wantUrl: string) {
  const want = pathOf(wantUrl);
  const current = pathOf(img.currentSrc || img.getAttribute('src') || '');
  if (!current || !want) return false;
  return current === want;
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
  const [ready, setReady] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [mobileFailed, setMobileFailed] = useState(false);
  const wantRef = useRef(src);

  useEffect(() => {
    const node = imgRef.current;
    if (!node) return;

    const activeMobileSrc = mobileFailed ? undefined : mobileSrc;
    const mq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
    const revealIfValid = () => {
      if (!matchesWant(node, wantRef.current)) return;
      if (!node.complete || node.naturalWidth < 2) return;
      setReady(true);
    };

    const sync = (resetReady = false) => {
      const nextSrc = pickSrc(src, activeMobileSrc, allowMobile);
      const changed = nextSrc !== wantRef.current;
      wantRef.current = nextSrc;
      if (changed && resetReady) setReady(false);
      revealIfValid();
    };
    const onLoad = () => revealIfValid();
    const onError = () => {
      setReady(false);
      if (mobileSrc && pathOf(wantRef.current) === pathOf(mobileSrc)) setMobileFailed(true);
    };
    const onMediaChange = () => sync(true);

    node.addEventListener('load', onLoad);
    node.addEventListener('error', onError);
    mq.addEventListener('change', onMediaChange);
    sync();
    return () => {
      node.removeEventListener('load', onLoad);
      node.removeEventListener('error', onError);
      mq.removeEventListener('change', onMediaChange);
    };
  }, [src, mobileSrc, allowMobile, mobileFailed]);

  return (
    <span className={`case-still${ready ? ' is-ready' : ''}${previewReady ? ' is-preview-ready' : ''}${lqip ? ' has-lqip' : ''}`}>
      {lqip ? <img className="case-media-lqip" src={lqip} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" onLoad={() => setPreviewReady(true)} /> : null}
      {/* Native img — Next/Image cache can paint a foreign bitmap for one frame. */}
      <picture>
        {allowMobile && mobileSrc && !mobileFailed ? <source media="(max-width: 1024px), (pointer: coarse)" srcSet={mobileSrc} /> : null}
        <img
          ref={imgRef}
          src={src}
          alt=""
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          data-pin-nopin="true"
        />
      </picture>
      <span className="case-video-mask" aria-hidden />
    </span>
  );
}
