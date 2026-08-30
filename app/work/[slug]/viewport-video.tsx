'use client';

import { useEffect, useRef } from 'react';

export function ViewportVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const preload = new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      video.preload = 'auto';
      video.load();
      observer.disconnect();
    }, { rootMargin: '800px 0px' });
    const playback = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !reducedMotion.matches && !document.hidden) void video.play().catch(() => {});
      else video.pause();
    }, { threshold: 0.2 });
    const visibility = () => {
      if (document.hidden || !visible || reducedMotion.matches) video.pause();
      else void video.play().catch(() => {});
    };

    preload.observe(video);
    playback.observe(video);
    document.addEventListener('visibilitychange', visibility);
    reducedMotion.addEventListener('change', visibility);
    return () => {
      preload.disconnect();
      playback.disconnect();
      document.removeEventListener('visibilitychange', visibility);
      reducedMotion.removeEventListener('change', visibility);
    };
  }, []);

  return <video ref={ref} src={src} muted loop playsInline preload="metadata" draggable={false} controlsList="nodownload" disablePictureInPicture />;
}
