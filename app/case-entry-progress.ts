/**
 * Progress bus for case-entry gate.
 * Images report from loadCaseEntryPack; entry videos report from ViewportVideo
 * after real <video> decode (Safari cannot reuse fetch() bytes for media).
 */

type EntryState = {
  shares: Map<string, number>;
  listeners: Set<(progress: number) => void>;
};

const states = new Map<string, EntryState>();

function progressOf(state: EntryState) {
  if (state.shares.size === 0) return 100;
  let sum = 0;
  state.shares.forEach((value) => {
    sum += value;
  });
  return Math.max(0, Math.min(100, Math.round((sum / state.shares.size) * 100)));
}

export function beginCaseEntry(slug: string, unitIds: string[]) {
  const existing = states.get(slug);
  if (existing) {
    // Keep listeners; ensure all expected units exist.
    for (const id of unitIds) {
      if (!existing.shares.has(id)) existing.shares.set(id, 0);
    }
    return () => {
      states.delete(slug);
    };
  }
  const shares = new Map<string, number>();
  for (const id of unitIds) shares.set(id, 0);
  const listeners = new Set<(progress: number) => void>();
  states.set(slug, { shares, listeners });
  return () => {
    states.delete(slug);
  };
}

export function reportCaseEntryShare(slug: string, unitId: string, ratio: number) {
  const state = states.get(slug);
  if (!state || !state.shares.has(unitId)) return;
  const next = Math.max(state.shares.get(unitId) ?? 0, Math.min(1, ratio));
  state.shares.set(unitId, next);
  const progress = progressOf(state);
  state.listeners.forEach((listener) => listener(progress));
}

export function subscribeCaseEntry(slug: string, listener: (progress: number) => void) {
  const state = states.get(slug);
  if (!state) return () => {};
  state.listeners.add(listener);
  listener(progressOf(state));
  return () => {
    state.listeners.delete(listener);
  };
}

export function caseEntryComplete(slug: string) {
  const state = states.get(slug);
  if (!state) return true;
  for (const value of state.shares.values()) {
    if (value < 1) return false;
  }
  return true;
}

export function waitCaseEntry(slug: string, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    if (caseEntryComplete(slug)) {
      resolve();
      return;
    }
    const safety = window.setTimeout(() => resolve(), timeoutMs);
    const unsubscribe = subscribeCaseEntry(slug, () => {
      if (!caseEntryComplete(slug)) return;
      window.clearTimeout(safety);
      unsubscribe();
      resolve();
    });
  });
}

/** Serial bind queue — Safari chokes if many large MP4s attach at once. */
let bindTail: Promise<void> = Promise.resolve();

export function enqueueCaseVideoBind(task: () => Promise<void>) {
  const run = bindTail.then(task, task);
  bindTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function entryUnitId(slug: string, slot: number, kind: 'image' | 'video' | 'poster') {
  return `${slug}:${kind}:${String(slot).padStart(2, '0')}`;
}
