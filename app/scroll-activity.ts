/** Shared scroll activity — pause background warm / lookahead while the user is scrubbing. */

type Listener = (active: boolean) => void;

const listeners = new Set<Listener>();
let scrolling = false;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let abort: AbortController | undefined;

const SETTLE_MS = 160;

function emit(active: boolean) {
  listeners.forEach((listener) => listener(active));
}

function markScrolling() {
  const was = scrolling;
  scrolling = true;
  if (!was) {
    abort?.abort();
    abort = new AbortController();
    emit(true);
  }
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    scrolling = false;
    emit(false);
  }, SETTLE_MS);
}

export function isPageScrolling() {
  return scrolling;
}

/** Signal aborted whenever a new scroll gesture starts. */
export function prefetchAbortSignal() {
  if (!abort) abort = new AbortController();
  return abort.signal;
}

export function onScrollActivity(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function waitForScrollIdle() {
  if (!scrolling) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const stop = onScrollActivity((active) => {
      if (active) return;
      stop();
      resolve();
    });
  });
}

let armed = false;
export function armScrollActivity() {
  if (armed || typeof window === 'undefined') return;
  armed = true;
  const opts: AddEventListenerOptions = { passive: true, capture: true };
  window.addEventListener('scroll', markScrolling, opts);
  window.addEventListener('wheel', markScrolling, opts);
  window.addEventListener('touchmove', markScrolling, opts);
}
