'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function Header() {
  const pathname = usePathname();
  const lastY = useRef(0);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [clock, setClock] = useState('');
  const headerRef = useRef<HTMLElement>(null);
  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  useEffect(() => {
    const formatClock = () => setClock(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date()));
    formatClock();
    const timer = window.setInterval(formatClock, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => { closeMenu(); }, [pathname]);

  useEffect(() => {
    lastY.current = window.scrollY;
    const onScroll = () => {
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const y = Math.max(0, Math.min(window.scrollY, maxY));
      // Ignore tiny movements and Safari's overscroll instead of flashing the header.
      if (y > 56 && Math.abs(y - lastY.current) < 12) return;
      const scrollingDown = y > 56 && y > lastY.current;
      if (scrollingDown) closeMenu();
      setHidden(scrollingDown);
      lastY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setLanguage(document.documentElement.dataset.lang === 'zh' ? 'zh' : 'en');
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const setSiteLanguage = (next: 'en' | 'zh') => {
    if (next === language) return;
    setLanguage(next);
    document.documentElement.dataset.lang = next;
    document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
    try { window.localStorage.setItem('portfolio-language', next); } catch {}
  };

  const languageToggle = (
    <button
      className="language-toggle"
      type="button"
      aria-label={language === 'en' ? 'Switch to Chinese' : 'Switch to English'}
      onClick={() => setSiteLanguage(language === 'en' ? 'zh' : 'en')}
    >
      <span className="language-toggle-content"><span className={language === 'zh' ? 'language-option-zh' : undefined}>{language === 'en' ? 'E' : '中'}</span><i aria-hidden="true">/</i><span className={language === 'en' ? 'language-option-zh' : undefined}>{language === 'en' ? '中' : 'E'}</span></span>
    </button>
  );

  const links = <><Link className={pathname === '/work' ? 'active' : ''} href="/work" aria-label="Work" aria-current={pathname === '/work' ? 'page' : undefined}><span>Work</span></Link><Link className={pathname.startsWith('/about') ? 'active' : ''} href="/about" aria-label="About" aria-current={pathname.startsWith('/about') ? 'page' : undefined}><span>About</span></Link></>;

  /* the designed logo mark is used on every page */
  const identity = <img className="nav-logo" src="/logo.svg" alt="Shane Zhu" data-pin-nopin="true" data-pin-no-hover="true" />;

  return <header ref={headerRef} className={`nav nav-home${hidden ? ' nav-hidden' : ''}${menuOpen ? ' is-menu-open' : ''}`} onKeyDown={(event) => {
    if (event.key === 'Escape' && menuOpen) {
      closeMenu();
      headerRef.current?.querySelector<HTMLButtonElement>('.nav-toggle')?.focus();
    }
  }}>
    <div className="nav-identity"><Link className="wordmark" href="/" onClick={closeMenu}>{identity}</Link></div>
    <div className="nav-location" aria-label="Local time">Shanghai, CN <span>({clock})</span></div>
    <nav className="nav-desktop" aria-label="Main navigation">{links}{languageToggle}</nav>
    <button
      className="nav-toggle"
      type="button"
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      aria-controls="main-navigation"
      onClick={() => setMenuOpen((open) => !open)}
    >
      <span aria-hidden="true" /><span aria-hidden="true" />
    </button>
    <nav id="main-navigation" className="nav-mobile" aria-label="Mobile navigation" aria-hidden={!menuOpen} inert={!menuOpen}>
      {links}{languageToggle}
    </nav>
  </header>;
}
