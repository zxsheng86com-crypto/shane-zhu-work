import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <head><meta name="pinterest" content="nopin" /></head>
      <body>{children}</body>
    </html>
  );
}
