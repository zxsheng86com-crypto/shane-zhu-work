import type { Metadata } from 'next';
import './globals.css';
import { CustomCursor } from './custom-cursor';
import { ShaneGridHydrate } from './shane-grid-hydrate';

export const metadata: Metadata = {
  title: 'Your Name — Selected Work',
  description: 'Independent designer portfolio and selected case studies.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-lang="en" suppressHydrationWarning>
      <head><meta name="pinterest" content="nopin" /><script dangerouslySetInnerHTML={{ __html: "try{const l=localStorage.getItem('portfolio-language');if(l==='zh'){document.documentElement.dataset.lang='zh';document.documentElement.lang='zh-CN'}}catch{}" }} /></head>
      <body><ShaneGridHydrate /><CustomCursor />{children}</body>
    </html>
  );
}
