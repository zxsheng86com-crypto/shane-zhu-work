'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export function Header() {
  const lastY = useRef(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > 56 && y > lastY.current);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return <header className={`nav nav-home${hidden ? ' nav-hidden' : ''}`}><div className="nav-identity"><span>( 199● ) – 2026</span><Link className="wordmark" href="/">Shane Zhu</Link></div><nav aria-label="Main navigation"><Link href="/work">Work</Link><Link href="/about">About</Link></nav></header>;
}
