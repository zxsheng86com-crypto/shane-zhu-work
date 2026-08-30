'use client';

import { useEffect, useRef } from 'react';

export function HomeMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const items = [...container.querySelectorAll<HTMLElement>('[data-home-reveal]')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    container.classList.add('motion-ready');

    requestAnimationFrame(() => container.classList.add('motion-loaded'));
    if (reduced) {
      items.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -4% 0px' });

    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <div className="home-motion" ref={root}>{children}</div>;
}
