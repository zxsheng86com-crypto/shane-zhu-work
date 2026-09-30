'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { loadCaseEntryPack, warmCaseLookahead } from '../../project-opening';

const CaseEntryContext = createContext(true);

/** False while the case entry gate is still warming the opening pack. */
export function useCaseEntryReady() {
  return useContext(CaseEntryContext);
}

const ENTRY_TIMEOUT_MS = 20000;

/**
 * Black progress gate on case entry.
 * Real load underneath; displayed bar eases toward the target so it never
 * jumps then stalls.
 */
export function CaseEntryGate({ slug, children }: { slug: string; children: ReactNode }) {
  const [display, setDisplay] = useState(2);
  const [ready, setReady] = useState(false);
  const targetRef = useRef(2);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let finishTimer = 0;
    let raf = 0;

    const tick = () => {
      setDisplay((prev) => {
        const target = targetRef.current;
        const gap = target - prev;
        if (Math.abs(gap) < 0.15) return target;
        // Ease out — faster while catching a big jump, slower near the end.
        return prev + gap * (readyRef.current ? 0.18 : 0.1);
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const finish = () => {
      if (cancelled || readyRef.current) return;
      readyRef.current = true;
      targetRef.current = 100;
      finishTimer = window.setTimeout(() => {
        if (!cancelled) {
          setReady(true);
          void warmCaseLookahead(slug);
        }
      }, 420);
    };

    const safety = window.setTimeout(finish, ENTRY_TIMEOUT_MS);

    void loadCaseEntryPack(slug, (value: number) => {
      if (cancelled) return;
      targetRef.current = Math.max(targetRef.current, Math.min(99, value));
    })
      .then(finish)
      .catch(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      window.clearTimeout(finishTimer);
      cancelAnimationFrame(raf);
    };
  }, [slug]);

  useEffect(() => {
    if (ready) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [ready]);

  return (
    <CaseEntryContext.Provider value={ready}>
      <div
        className={`cf-intro-loader case-entry-loader${ready ? ' is-hidden' : ''}`}
        aria-hidden={ready}
      >
        <div
          className="cf-loader-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(display)}
          aria-valuetext="Loading"
        >
          <i className="cf-loader-bar-fill" style={{ transform: `scaleX(${Math.max(display, 2) / 100})` }} />
        </div>
      </div>
      {children}
    </CaseEntryContext.Provider>
  );
}
