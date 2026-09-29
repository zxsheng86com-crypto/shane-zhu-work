'use client';

import { useEffect, useRef } from 'react';

export function CustomCursor() {
  const cursorRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    if (!cursor || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    const move = (event: PointerEvent) => {
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0)`;
      cursor.classList.add('is-visible');
      const target = event.target instanceof Element ? event.target : null;
      const isHomeCanvas = Boolean(target?.closest('.noravale-home-canvas-link, .fairchild-cover-link'));
      cursor.classList.toggle('is-home-hovering', isHomeCanvas);
      document.documentElement.classList.toggle('has-home-cursor', isHomeCanvas);
    };
    const leave = () => {
      cursor.classList.remove('is-visible', 'is-home-hovering');
      document.documentElement.classList.remove('has-home-cursor');
    };
    const press = () => {
      cursor.classList.remove('is-home-hovering');
      document.documentElement.classList.remove('has-home-cursor');
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerdown', press);
    document.documentElement.addEventListener('pointerleave', leave);
    window.addEventListener('blur', leave);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', press);
      document.documentElement.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', leave);
    };
  }, []);

  return <span ref={cursorRef} className="custom-cursor" aria-hidden="true"><i className="custom-cursor-home-icon" /></span>;
}
