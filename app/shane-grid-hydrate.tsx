'use client';

import { useEffect } from 'react';
import { clearShaneGrid, hydrateShaneGrid } from './shane-grid';

/** Apply last homepage-measured Shane gutters on mobile routes only. */
export function ShaneGridHydrate() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => {
      if (mq.matches) {
        hydrateShaneGrid();
      } else {
        // Leaving mobile width: drop phone inline gutters so desktop CSS tokens win.
        clearShaneGrid();
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return null;
}
