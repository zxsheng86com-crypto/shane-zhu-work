'use client';

import { useEffect } from 'react';
import { applyShaneGrid, hydrateShaneGrid } from './shane-grid';

/**
 * Keep Shane gutters stable across routes.
 * Mobile: restore last measured grid from session.
 * Desktop: apply design FALLBACK when nothing is ready yet (never clear mid-session).
 */
export function ShaneGridHydrate() {
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => {
      if (mq.matches) {
        if (!hydrateShaneGrid()) applyShaneGrid();
        return;
      }
      if (document.documentElement.dataset.shaneGrid !== 'ready') {
        applyShaneGrid();
      }
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return null;
}
