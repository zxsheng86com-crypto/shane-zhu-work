/**
 * Shane letter grid — hidden columns from the visual edges of SHANE.
 *
 * Six vertical lines (left → right), matching the homepage annotation:
 *   1  S left
 *   2  S right  (= H left)
 *   3  H right  (= A left)
 *   4  A right  (= N left)
 *   5  N right  (= E left)
 *   6  E right
 *
 * Columns between the lines:  S | H | A | N | E
 *
 * CSS custom properties written to :root (as vw units = % of viewport width):
 *   --sg-line-1 … --sg-line-6
 *   --sg-s-left, --sg-s-right, --sg-h-right, --sg-a-right, --sg-n-right, --sg-e-right
 *   --sg-col-s … --sg-col-e   (column widths)
 *   --sg-gutter-left / --sg-gutter-right
 *   --sg-ready: 1 when measured
 */

export type ShaneGridLines = {
  /** S left → E right, as fractions of viewport width × 100 (e.g. 42.55). */
  lines: [number, number, number, number, number, number];
};

const FALLBACK: ShaneGridLines = {
  // Measured at 1920×1080 from live Lottie letter comps
  lines: [0.9375, 21.4889, 42.5452, 65.8235, 81.4961, 98.132],
};

function pathBounds(root: Element): { left: number; right: number } | null {
  let left = Infinity;
  let right = -Infinity;
  root.querySelectorAll('path').forEach((path) => {
    const box = path.getBoundingClientRect();
    if (box.width < 1 || box.height < 10) return;
    left = Math.min(left, box.left);
    right = Math.max(right, box.right);
  });
  return left < right ? { left, right } : null;
}

/** Split the combined NE Lottie into N and E by path clusters. */
function splitNE(neRoot: Element): { n: { left: number; right: number }; e: { left: number; right: number } } | null {
  const boxes = [...neRoot.querySelectorAll('path')]
    .map((path) => path.getBoundingClientRect())
    .filter((box) => box.width > 5 && box.height > 40);
  if (boxes.length < 2) return null;
  const extentLeft = Math.min(...boxes.map((box) => box.left));
  const extentRight = Math.max(...boxes.map((box) => box.right));
  const mid = (extentLeft + extentRight) / 2;
  const nBoxes = boxes.filter((box) => (box.left + box.right) / 2 < mid);
  const eBoxes = boxes.filter((box) => (box.left + box.right) / 2 >= mid);
  if (!nBoxes.length || !eBoxes.length) return null;
  return {
    n: {
      left: Math.min(...nBoxes.map((box) => box.left)),
      right: Math.max(...nBoxes.map((box) => box.right)),
    },
    e: {
      left: Math.min(...eBoxes.map((box) => box.left)),
      right: Math.max(...eBoxes.map((box) => box.right)),
    },
  };
}

/** Measure from live `.cf-letter` comps (desktop) or entrance / text wordmark. */
export function measureShaneGrid(hero: HTMLElement): ShaneGridLines | null {
  const width = document.documentElement.clientWidth;
  if (width <= 0) return null;
  const toUnit = (x: number) => (x / width) * 100;
  const isNarrow = width <= 800;

  const letters = [...hero.querySelectorAll('.cf-letter')];
  if (letters.length >= 4) {
    const s = pathBounds(letters[0]);
    const h = pathBounds(letters[1]);
    const a = pathBounds(letters[2]);
    const ne = splitNE(letters[3]) ?? (() => {
      const all = pathBounds(letters[3]);
      if (!all) return null;
      const split = all.left + (all.right - all.left) * 0.52;
      return { n: { left: all.left, right: split }, e: { left: split, right: all.right } };
    })();
    if (s && h && a && ne) {
      return {
        lines: [
          toUnit(s.left),
          toUnit(s.right),
          toUnit(h.right),
          toUnit(a.right),
          toUnit(ne.n.right),
          toUnit(ne.e.right),
        ],
      };
    }
  }

  const entrance = hero.querySelector('.cf-entrance');
  if (entrance) {
    // Mobile letters are shorter in px — use looser filters, then cluster into 5 glyphs.
    const minW = isNarrow ? 6 : 20;
    const minH = isNarrow ? 24 : 80;
    const boxes = [...entrance.querySelectorAll('path')]
      .map((path) => path.getBoundingClientRect())
      .filter((box) => box.width > minW && box.height > minH)
      .sort((a, b) => a.left - b.left);

    const clustered = clusterLetterBoxes(boxes, 5);
    if (clustered) {
      const [s, h, a, n, e] = clustered;
      const lines: ShaneGridLines['lines'] = [
        toUnit(s.left),
        toUnit(s.right),
        toUnit(h.right),
        toUnit(a.right),
        toUnit(n.right),
        toUnit(e.right),
      ];
      // Reject half-width reads (unscaled entrance artboard) — fall through.
      if (lines[5] - lines[0] >= 70) return { lines };
    }

    if (boxes.length >= 5) {
      const sLeft = boxes[0].left;
      const sRight = boxes[0].right;
      const hRight = boxes[2]?.right ?? boxes[1].right;
      const aRight = boxes[3]?.right ?? hRight;
      const eRight = boxes[boxes.length - 1].right;
      const nRight = boxes[boxes.length - 2]?.right ?? (aRight + eRight) / 2;
      const lines: ShaneGridLines['lines'] = [
        toUnit(sLeft),
        toUnit(sRight),
        toUnit(hRight),
        toUnit(aRight),
        toUnit(nRight),
        toUnit(eRight),
      ];
      if (lines[5] - lines[0] >= 70) return { lines };
    }
  }

  const spans = [...hero.querySelectorAll('.cf-wordmark span')];
  if (spans.length === 5) {
    const boxes = spans.map((span) => span.getBoundingClientRect());
    if (boxes.every((box) => box.width > 0)) {
      return {
        lines: [
          toUnit(boxes[0].left),
          toUnit(boxes[0].right),
          toUnit(boxes[1].right),
          toUnit(boxes[2].right),
          toUnit(boxes[3].right),
          toUnit(boxes[4].right),
        ],
      };
    }
  }

  return null;
}

/** Group path boxes into N left-to-right letter clusters by x-gap. */
function clusterLetterBoxes(
  boxes: DOMRect[],
  count: number,
): Array<{ left: number; right: number }> | null {
  if (boxes.length < count) return null;
  const centers = boxes.map((box) => (box.left + box.right) / 2);
  const gaps = centers.slice(1).map((c, i) => ({ i, gap: c - centers[i] }));
  gaps.sort((a, b) => b.gap - a.gap);
  const cuts = gaps
    .slice(0, count - 1)
    .map((item) => item.i + 1)
    .sort((a, b) => a - b);
  const edges = [0, ...cuts, boxes.length];
  const clusters: Array<{ left: number; right: number }> = [];
  for (let i = 0; i < count; i++) {
    const slice = boxes.slice(edges[i], edges[i + 1]);
    if (!slice.length) return null;
    clusters.push({
      left: Math.min(...slice.map((box) => box.left)),
      right: Math.max(...slice.map((box) => box.right)),
    });
  }
  return clusters;
}

/** Phone layout only — never `(pointer: coarse)` alone (avoids touching desktop Web). */
export function isMobileViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 800px)').matches;
}

const STORAGE_KEY_MOBILE = 'shane-grid-lines-mobile';

/** Ensure mobile gutters never drop below 12px (matches --cf-mobile-gutter floor). */
function clampMobileGutters(lines: ShaneGridLines['lines']): ShaneGridLines['lines'] {
  if (!isMobileViewport()) return lines;
  const width = document.documentElement.clientWidth;
  if (width <= 0) return lines;
  const min = (12 / width) * 100;
  const [l1, l2, l3, l4, l5, l6] = lines;
  if (l1 >= min && 100 - l6 >= min) return lines;
  const span = Math.max(0.0001, l6 - l1);
  const nextL1 = Math.max(l1, min);
  const nextL6 = Math.min(l6, 100 - min);
  const scale = (nextL6 - nextL1) / span;
  return [
    nextL1,
    nextL1 + (l2 - l1) * scale,
    nextL1 + (l3 - l1) * scale,
    nextL1 + (l4 - l1) * scale,
    nextL1 + (l5 - l1) * scale,
    nextL6,
  ];
}

export function applyShaneGrid(grid: ShaneGridLines = FALLBACK, options?: { persist?: boolean }) {
  const root = document.documentElement;
  const [l1, l2, l3, l4, l5, l6] = clampMobileGutters(grid.lines);
  const set = (name: string, value: string) => root.style.setProperty(name, value);
  // Percent of the layout viewport (clientWidth). Prefer % over vw so
  // scrollbar width does not shift right-edge alignments.
  const unit = (n: number) => `${n.toFixed(4)}%`;

  set('--sg-line-1', unit(l1));
  set('--sg-line-2', unit(l2));
  set('--sg-line-3', unit(l3));
  set('--sg-line-4', unit(l4));
  set('--sg-line-5', unit(l5));
  set('--sg-line-6', unit(l6));

  set('--sg-s-left', unit(l1));
  set('--sg-s-right', unit(l2));
  set('--sg-h-right', unit(l3));
  set('--sg-a-right', unit(l4));
  set('--sg-n-right', unit(l5));
  set('--sg-e-right', unit(l6));

  set('--sg-col-s', unit(l2 - l1));
  set('--sg-col-h', unit(l3 - l2));
  set('--sg-col-a', unit(l4 - l3));
  set('--sg-col-n', unit(l5 - l4));
  set('--sg-col-e', unit(l6 - l5));

  set('--sg-gutter-left', unit(l1));
  set('--sg-gutter-right', unit(100 - l6));
  set('--sg-ready', '1');
  root.dataset.shaneGrid = 'ready';

  // Persist measured mobile grids only — never bake desktop FALLBACK into phone storage.
  if (options?.persist && isMobileViewport()) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY_MOBILE, JSON.stringify([l1, l2, l3, l4, l5, l6]));
    } catch {
      /* ignore quota / private mode */
    }
  }
}

/** Restore last mobile-measured gutters. No-op on desktop Web. */
export function hydrateShaneGrid() {
  if (typeof window === 'undefined') return false;
  if (!isMobileViewport()) return false;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY_MOBILE);
    if (!raw) return false;
    const lines = JSON.parse(raw) as ShaneGridLines['lines'];
    if (!Array.isArray(lines) || lines.length !== 6 || lines.some((n) => typeof n !== 'number')) return false;
    applyShaneGrid({ lines }, { persist: true });
    syncDebugOverlay();
    return true;
  } catch {
    return false;
  }
}

export function clearShaneGrid() {
  const root = document.documentElement;
  [
    '--sg-line-1', '--sg-line-2', '--sg-line-3', '--sg-line-4', '--sg-line-5', '--sg-line-6',
    '--sg-s-left', '--sg-s-right', '--sg-h-right', '--sg-a-right', '--sg-n-right', '--sg-e-right',
    '--sg-col-s', '--sg-col-h', '--sg-col-a', '--sg-col-n', '--sg-col-e',
    '--sg-gutter-left', '--sg-gutter-right', '--sg-ready',
  ].forEach((name) => root.style.removeProperty(name));
  delete root.dataset.shaneGrid;
}

/** Sync measured grid onto :root; returns a cleanup that clears vars. */
export function startShaneGrid(hero: HTMLElement) {
  const sync = () => {
    const measured = measureShaneGrid(hero);
    if (measured) {
      // Persist only on mobile so other mobile routes share gutters.
      applyShaneGrid(measured, { persist: isMobileViewport() });
    } else if (!isMobileViewport()) {
      // Desktop: design FALLBACK for letter lines. Mobile: keep CSS 12px until letters measure.
      applyShaneGrid(FALLBACK, { persist: false });
    }
    syncDebugOverlay();
  };
  sync();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
  ro?.observe(hero);
  const mq = window.matchMedia('(max-width: 800px)');
  window.addEventListener('resize', sync);
  window.addEventListener('cf-shane-grid-sync', sync);
  mq.addEventListener('change', sync);
  // Mobile entrance settles over a few frames — remeasure after paint.
  const retries = [120, 400, 900, 1600].map((ms) => window.setTimeout(sync, ms));
  return () => {
    ro?.disconnect();
    window.removeEventListener('resize', sync);
    window.removeEventListener('cf-shane-grid-sync', sync);
    mq.removeEventListener('change', sync);
    retries.forEach((id) => window.clearTimeout(id));
    // Keep gutters on :root across routes so chrome (nav) and case pages don't jump.
    removeDebugOverlay();
  };
}

export function requestShaneGridSync() {
  window.dispatchEvent(new Event('cf-shane-grid-sync'));
}

function syncDebugOverlay() {
  if (typeof window === 'undefined') return;
  const enabled = new URLSearchParams(window.location.search).has('grid')
    || window.localStorage.getItem('shane-grid-debug') === '1';
  if (!enabled) {
    removeDebugOverlay();
    return;
  }
  let overlay = document.getElementById('shane-grid-debug');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'shane-grid-debug';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    for (let i = 1; i <= 6; i += 1) {
      const line = document.createElement('i');
      line.dataset.line = String(i);
      const label = document.createElement('span');
      label.textContent = String(i);
      line.appendChild(label);
      overlay.appendChild(line);
    }
  }
  overlay.querySelectorAll('i').forEach((line) => {
    const n = line.getAttribute('data-line');
    (line as HTMLElement).style.left = `var(--sg-line-${n})`;
  });
}

function removeDebugOverlay() {
  document.getElementById('shane-grid-debug')?.remove();
}
