'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * Justified-style still:
 * LQIP underneath (CSS blur) → sharp image fades in on load.
 */
export function CaseStill({
  src,
  lqip,
  sizes = '(max-width: 1024px) 100vw, 81vw',
  priority = false,
}: {
  src: string;
  lqip?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);

  const markReady = () => setReady(true);

  // Cached images can skip onLoad — catch them.
  useEffect(() => {
    setReady(false);
    const node = imgRef.current;
    if (node?.complete && node.naturalWidth > 0) setReady(true);
  }, [src]);

  return (
    <span className={`case-still${ready ? ' is-ready' : ''}${lqip ? ' has-lqip' : ''}`}>
      {lqip ? <span className="case-media-lqip" style={{ backgroundImage: `url(${lqip})` }} aria-hidden /> : null}
      <Image
        key={src}
        ref={imgRef}
        src={src}
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
          // Ignore stale load events from a previous src.
          if (node.currentSrc && !node.currentSrc.includes(src.split('?')[0].split('/').pop() || '')) return;
          markReady();
        }}
      />
      {!ready ? <span className="case-video-mask" aria-hidden /> : null}
    </span>
  );
}
