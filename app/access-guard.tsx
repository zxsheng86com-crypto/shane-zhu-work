'use client';

import { useEffect } from 'react';

export function AccessGuard() {
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/access', { method: 'HEAD', cache: 'no-store' });
        if (response.status === 401) window.location.reload();
      } catch { /* A temporary network failure must not interrupt a loaded project. */ }
    };
    const restored = (event: PageTransitionEvent) => { if (event.persisted) void check(); };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('pageshow', restored);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('pageshow', restored);
    };
  }, []);
  return null;
}
