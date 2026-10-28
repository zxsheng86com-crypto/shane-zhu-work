'use client';

import { useEffect } from 'react';

// Deters casual saving; browser extensions can still read already-rendered media.
export function MediaProtection() {
  useEffect(() => {
    const preventSave = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(
        'img, video, canvas, .placeholder, .card-media, .cf-cover, .about-portrait-image',
      )) event.preventDefault();
    };
    document.addEventListener('contextmenu', preventSave, true);
    document.addEventListener('dragstart', preventSave, true);
    return () => {
      document.removeEventListener('contextmenu', preventSave, true);
      document.removeEventListener('dragstart', preventSave, true);
    };
  }, []);
  return null;
}
