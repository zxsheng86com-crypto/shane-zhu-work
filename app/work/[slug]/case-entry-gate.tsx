'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadCaseEntryPack, warmCaseLookahead } from '../../project-opening';

const CaseEntryContext = createContext(true);

/** False while the case entry gate is still warming the opening pack. */
export function useCaseEntryReady() {
  return useContext(CaseEntryContext);
}

const ENTRY_TIMEOUT_MS = 12000;

/**
 * Black progress gate on case entry.
 * Finishes slots 01–06 with real progress, then releases the page and
 * immediately warms 07–08 while the visitor is still on the first frames.
 */
export function CaseEntryGate({ slug, children }: { slug: string; children: ReactNode }) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let finishTimer = 0;

    const finish = () => {
      if (cancelled) return;
      setProgress(100);
      finishTimer = window.setTimeout(() => {
        if (!cancelled) {
          setReady(true);
          // While viewing the top: prefetch the next two slots into HTTP cache.
          void warmCaseLookahead(slug);
        }
      }, 180);
    };

    const safety = window.setTimeout(finish, ENTRY_TIMEOUT_MS);

    void loadCaseEntryPack(slug, (value: number) => {
      if (!cancelled) setProgress((prev) => (value > prev ? value : prev));
    })
      .then(finish)
      .catch(finish);

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
      window.clearTimeout(finishTimer);
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
          aria-valuenow={progress}
          aria-valuetext="Loading"
        >
          <i className="cf-loader-bar-fill" style={{ transform: `scaleX(${Math.max(progress, 2) / 100})` }} />
        </div>
      </div>
      {children}
    </CaseEntryContext.Provider>
  );
}
