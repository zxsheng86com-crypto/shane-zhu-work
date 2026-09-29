'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

function visibleLangNode(root: HTMLElement) {
  const zh = document.documentElement.dataset.lang === 'zh';
  return root.querySelector<HTMLElement>(zh ? '.lang-zh' : '.lang-en') ?? root;
}

/** Count wrapped lines from client rect tops. */
function countLines(node: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const tops = new Set<number>();
  for (const rect of range.getClientRects()) {
    if (rect.width < 0.5 || rect.height < 0.5) continue;
    tops.add(Math.round(rect.top));
  }
  if (tops.size > 0) return tops.size;

  // Fallback when range yields nothing (e.g. empty): use height / line-height
  const style = getComputedStyle(node);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.45 || 20;
  const height = node.getBoundingClientRect().height;
  return Math.max(1, Math.round(height / lineHeight));
}

function isMobileCase() {
  return window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
}

export function CaseDescription({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [align, setAlign] = useState<'left' | 'right'>('right');

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      // Mobile / coarse: always left. Desktop keeps 1-line right / 2+ left.
      if (isMobileCase()) {
        setAlign('left');
        return;
      }
      const visible = visibleLangNode(el);
      setAlign(countLines(visible) > 1 ? 'left' : 'right');
    };

    update();
    const resize = new ResizeObserver(() => {
      window.requestAnimationFrame(update);
    });
    resize.observe(el);
    const language = new MutationObserver(update);
    language.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lang'] });
    const mobileMq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
    mobileMq.addEventListener('change', update);
    document.fonts?.ready?.then(update);
    window.addEventListener('resize', update);
    return () => {
      resize.disconnect();
      language.disconnect();
      mobileMq.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, [children]);

  return (
    <p
      ref={ref}
      className="case-desc"
      data-align={align}
      style={{ textAlign: align }}
    >
      {children}
    </p>
  );
}
