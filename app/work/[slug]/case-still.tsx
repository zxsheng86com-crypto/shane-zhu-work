'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

function isNarrowViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches;
}

function pickSrc(src: string, mobileSrc: string | undefined, allowMobile: boolean) {
  if (allowMobile && mobileSrc && isNarrowViewport()) return mobileSrc;
  return src;
}

/**
 * Case still — uses /mobile/*.jpg on narrow viewports when present.
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

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => setActiveSrc(pickSrc(src, mobileSrc, allowMobile));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [src, mobileSrc, allowMobile]);

  useEffect(() => {
    setReady(false);
    const node = imgRef.current;
    if (node?.complete && node.naturalWidth > 0) setReady(true);
  }, [activeSrc]);

  return (
    <span className={`case-still${ready ? ' is-ready' : ''}${lqip ? ' has-lqip' : ''}`}>
      {lqip ? <span className="case-media-lqip" style={{ backgroundImage: `url(${lqip})` }} aria-hidden /> : null}
      <Image
        key={activeSrc}
        ref={imgRef}
        src={activeSrc}
        alt=""
        fill
        sizes={sizes}
        unoptimized
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        draggable={false}
        data-pin-nopin="true"
        onLoad={(event) => {
          const node = event.currentTarget;
          const leaf = activeSrc.split('?')[0].split('/').pop() || '';
          if (node.currentSrc && leaf && !node.currentSrc.includes(leaf)) return;
          setReady(true);
        }}
      />
      <span className="case-video-mask" aria-hidden />
    </span>
  );
}
