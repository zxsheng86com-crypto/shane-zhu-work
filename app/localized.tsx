import type { ReactNode } from 'react';

export function Localized({ en, zh }: { en: ReactNode; zh: ReactNode }) {
  return <><span className="lang-en" lang="en">{en}</span><span className="lang-zh" lang="zh-CN">{zh}</span></>;
}
