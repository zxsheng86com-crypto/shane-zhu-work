'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HomeParticleField } from './home-particle-field';
import { Localized } from './localized';
import { requestShaneGridSync, startShaneGrid } from './shane-grid';
import { SiteCloseFooter } from './site-close-footer';
import { ProjectGrid, projects } from './site';
import { HomeProjectPrefetch } from './project-prefetch';

const featured = projects.slice(0, 5);
const coverFor = (project: (typeof featured)[number]) => project.workCover || project.cover || '';

export function HomeCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const coverRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const statementRef = useRef<HTMLElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const lottieRef = useRef<HTMLDivElement>(null);
  const [statementVisible, setStatementVisible] = useState(false);
  const [lottieReady, setLottieReady] = useState(false);
  const [introPhase, setIntroPhase] = useState<'loading' | 'wordmark' | 'particles' | 'complete'>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [particlesReady, setParticlesReady] = useState(false);
  // Only after mount: hide nav during intro. Without JS, nav stays visible.
  const [introGate, setIntroGate] = useState(false);
  // ponytail: mount only one cover tree so phones don't download desktop 4MB covers too
  const [coverMode, setCoverMode] = useState<'unknown' | 'desktop' | 'mobile'>('unknown');
  const introPhaseRef = useRef(introPhase);
  const loadStartedAt = useRef(0);
  const particleProgressRef = useRef(0);
  const lottieProgressRef = useRef(0);
  const particlesReadyRef = useRef(false);
  const lottieReadyRef = useRef(false);
  const playEntranceRef = useRef<(() => void) | null>(null);

  const bumpProgress = () => {
    const combined = Math.round(particleProgressRef.current * 0.8 + lottieProgressRef.current * 0.2);
    const capped = particlesReadyRef.current && lottieReadyRef.current ? 100 : Math.min(99, combined);
    setLoadProgress((prev) => (capped > prev ? capped : prev));
  };

  useEffect(() => {
    introPhaseRef.current = introPhase;
  }, [introPhase]);

  useEffect(() => {
    setIntroGate(true);
    loadStartedAt.current = performance.now();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 800px)');
    const sync = () => setCoverMode(mq.matches ? 'mobile' : 'desktop');
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  /* ---- intro phases ----
     loading   → galaxy/particles + Lottie JSON boot together (bar = real progress)
     wordmark  → play already-loaded Shane entrance
     particles → field opacity fade-in at ~50% of Shane entrance
     complete  → nav opacity fade-in */
  useEffect(() => {
    if (introPhase !== 'loading' || !particlesReady || !lottieReady) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduced ? 40 : Math.max(180, 420 - (performance.now() - loadStartedAt.current));
    const timer = window.setTimeout(() => setIntroPhase('wordmark'), hold);
    return () => window.clearTimeout(timer);
  }, [introPhase, particlesReady, lottieReady]);

  useEffect(() => {
    if (introPhase !== 'wordmark' || !lottieReady) return;
    playEntranceRef.current?.();
  }, [introPhase, lottieReady]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const forceComplete = window.setTimeout(() => {
      particlesReadyRef.current = true;
      lottieReadyRef.current = true;
      setParticlesReady(true);
      setLottieReady(true);
      setLoadProgress(100);
      setIntroPhase((phase) => (phase === 'complete' ? phase : 'complete'));
    }, reduced ? 2500 : 16000);
    return () => window.clearTimeout(forceComplete);
  }, []);

  useEffect(() => {
    if (introPhase !== 'particles') return;
    const delay = particlesReady ? 700 : 2200;
    const timer = window.setTimeout(() => setIntroPhase('complete'), delay);
    return () => window.clearTimeout(timer);
  }, [introPhase, particlesReady]);

  /* ---- hero wordmark Lottie: boot during loading, never fall back to fonts ---- */
  useEffect(() => {
    const container = lottieRef.current;
    const hero = heroRef.current;
    if (!container || !hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    let destroyed = false;
    let cleanupHotzone: (() => void) | undefined;
    let entranceStartTimer = 0;
    const allAnims: import('lottie-web').AnimationItem[] = [];

    const WORDMARK_SCALE = 1.6676;
    const LETTER_FILES = ['S', 'H1', 'A', 'NE'];
    const PEAK_FRAME = 30;
    const ENTRANCE_START_MS = 260;
    const PARTICLES_AT_PROGRESS = 0.5;
    const ENTRANCE_URL = '/lottie/home-entrance-shane.json';

    const lettersWrap = document.createElement('div');
    lettersWrap.className = 'cf-letters';
    container.appendChild(lettersWrap);
    const entranceWrap = document.createElement('div');
    entranceWrap.className = 'cf-entrance';
    lettersWrap.appendChild(entranceWrap);

    const markLottieProgress = (value: number) => {
      const next = Math.max(lottieProgressRef.current, Math.min(100, value));
      lottieProgressRef.current = next;
      bumpProgress();
    };

    const loadJson = async (url: string) => {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Failed to load ${url}`);
      return response.json();
    };

    (async () => {
      markLottieProgress(8);
      const [{ default: lottie }, entranceData] = await Promise.all([
        import('lottie-web'),
        loadJson(ENTRANCE_URL),
      ]);
      if (destroyed) return;
      markLottieProgress(isMobile ? 70 : 40);

      type LetterAnim = { anim: import('lottie-web').AnimationItem; cx: number; t: number };
      const letters: LetterAnim[] = [];
      let readyCount = 0;
      let entranceDone = false;
      let handoffDone = false;
      let hotzoneStarted = false;
      let particlesRevealed = false;
      let raf = 0;
      let mouseX: number | null = null;
      let sigma = 120;
      let entrance: import('lottie-web').AnimationItem | null = null;
      let played = false;

      const revealParticles = () => {
        if (destroyed || particlesRevealed) return;
        particlesRevealed = true;
        if (introPhaseRef.current === 'wordmark') setIntroPhase('particles');
      };

      const armParticlesAtHalfway = (anim: import('lottie-web').AnimationItem) => {
        anim.addEventListener('enterFrame', () => {
          if (destroyed || particlesRevealed) return;
          const total = Math.max(1, anim.totalFrames - 1);
          if (anim.currentFrame / total >= PARTICLES_AT_PROGRESS) revealParticles();
        });
      };

      playEntranceRef.current = () => {
        if (destroyed || !entrance || played) return;
        played = true;
        if (reducedMotion) {
          entrance.goToAndStop(Math.max(0, entrance.totalFrames - 1), true);
          revealParticles();
          return;
        }
        entranceStartTimer = window.setTimeout(() => {
          if (!destroyed && entrance) entrance.play();
        }, ENTRANCE_START_MS);
      };

      const bounds = () => {
        letters.forEach((letter) => {
          let left = Infinity;
          let right = -Infinity;
          letter.anim.renderer.elements.forEach((el: unknown) => {
            const g = (el as { baseElement?: SVGGElement }).baseElement;
            if (!g) return;
            const rect = g.getBoundingClientRect();
            if (rect.width === 0) return;
            left = Math.min(left, rect.left);
            right = Math.max(right, rect.right);
          });
          if (left < right) letter.cx = (left + right) / 2;
        });
      };
      const measure = () => {
        letters.forEach((letter) => letter.anim.goToAndStop(PEAK_FRAME, true));
        bounds();
        letters.forEach((letter) => letter.anim.goToAndStop(Math.min(letter.t, 1) * PEAK_FRAME, true));
      };
      const updateSigma = () => {
        const rect = container.getBoundingClientRect();
        sigma = (rect.width / 9) * 1.35 * WORDMARK_SCALE;
      };

      const tick = () => {
        let settled = true;
        letters.forEach((letter) => {
          let target = 0;
          if (mouseX !== null) {
            const d = (letter.cx - mouseX) / sigma;
            target = Math.exp(-0.5 * d * d);
          }
          letter.t += (target - letter.t) * 0.22;
          if (Math.abs(target - letter.t) > 0.0005) settled = false;
          letter.anim.goToAndStop(Math.min(letter.t, 1) * PEAK_FRAME, true);
        });
        raf = settled && mouseX === null ? 0 : requestAnimationFrame(tick);
      };
      const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

      const onMove = (event: MouseEvent) => {
        const rect = hero.getBoundingClientRect();
        const inZone = event.clientX >= rect.left + rect.width * 0.0075
          && event.clientX <= rect.right - rect.width * 0.0075
          && event.clientY >= rect.top + rect.height * 0.57
          && event.clientY <= rect.bottom - rect.height * 0.047;
        mouseX = inZone ? event.clientX : null;
        wake();
      };
      const onLeave = () => { mouseX = null; wake(); };
      const onResize = () => { updateSigma(); measure(); };

      const startHotzone = () => {
        if (hotzoneStarted || destroyed || isMobile || reducedMotion) return;
        hotzoneStarted = true;
        updateSigma();
        hero.addEventListener('mousemove', onMove);
        hero.addEventListener('mouseleave', onLeave);
        window.addEventListener('resize', onResize);
      };

      cleanupHotzone = () => {
        hero.removeEventListener('mousemove', onMove);
        hero.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('resize', onResize);
        cancelAnimationFrame(raf);
      };

      const handoffDesktop = () => {
        if (handoffDone || destroyed) return;
        if (!entranceDone || readyCount !== LETTER_FILES.length) return;
        handoffDone = true;
        lettersWrap.classList.add('is-live');
        if (entrance) entrance.destroy();
        entrance = null;
        startHotzone();
        revealParticles();
      };

      const onEntranceReady = () => {
        if (destroyed || !entrance) return;
        entrance.goToAndStop(0, true);
        markLottieProgress(100);
        lottieReadyRef.current = true;
        setLottieReady(true);
        if (introPhaseRef.current === 'wordmark') playEntranceRef.current?.();
        requestAnimationFrame(() => requestShaneGridSync());
      };

      /* Mobile: entrance only, freeze last frame — no letter comps / hover scrub. */
      if (isMobile) {
        entrance = lottie.loadAnimation({
          container: entranceWrap,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          animationData: entranceData,
        });
        allAnims.push(entrance);
        armParticlesAtHalfway(entrance);
        entrance.addEventListener('DOMLoaded', onEntranceReady);
        entrance.addEventListener('complete', () => {
          if (destroyed || !entrance) return;
          entrance.goToAndStop(entrance.totalFrames - 1, true);
          revealParticles();
          requestAnimationFrame(() => requestShaneGridSync());
        });
        return;
      }

      /* Desktop: mount entrance first so the gate can open; letter comps load in parallel. */
      entrance = lottie.loadAnimation({
        container: entranceWrap,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        animationData: entranceData,
      });
      allAnims.push(entrance);
      armParticlesAtHalfway(entrance);
      entrance.addEventListener('DOMLoaded', onEntranceReady);
      entrance.addEventListener('complete', () => {
        if (destroyed) return;
        entranceDone = true;
        handoffDesktop();
      });

      void Promise.all(
        LETTER_FILES.map(async (name, index) => {
          const url = name === 'H1'
            ? '/lottie/letters/H1.json?v=20261009-h1-3'
            : `/lottie/letters/${name}.json`;
          const data = await loadJson(url);
          markLottieProgress(40 + ((index + 1) / LETTER_FILES.length) * 35);
          return { name, data };
        }),
      ).then((letterDatas) => {
        if (destroyed) return;
        letterDatas.forEach(({ data }, index) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'cf-letter';
          lettersWrap.appendChild(wrapper);
          const anim = lottie.loadAnimation({
            container: wrapper,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: data,
          });
          allAnims.push(anim);
          letters.push({ anim, cx: 0, t: 0 });
          anim.addEventListener('DOMLoaded', () => {
            if (destroyed) return;
            anim.goToAndStop(0, true);
            readyCount += 1;
            if (readyCount === LETTER_FILES.length) {
              updateSigma();
              measure();
              measure();
              handoffDesktop();
            }
          });
        });
      });
    })().catch(() => {
      // Keep trying once — still no font fallback.
      if (destroyed) return;
      void (async () => {
        try {
          markLottieProgress(20);
          const [{ default: lottie }, entranceData] = await Promise.all([
            import('lottie-web'),
            loadJson(ENTRANCE_URL),
          ]);
          if (destroyed) return;
          entranceWrap.replaceChildren();
          const entrance = lottie.loadAnimation({
            container: entranceWrap,
            renderer: 'svg',
            loop: false,
            autoplay: false,
            animationData: entranceData,
          });
          allAnims.push(entrance);
          playEntranceRef.current = () => {
            if (destroyed || !entrance) return;
            if (reducedMotion) {
              entrance.goToAndStop(Math.max(0, entrance.totalFrames - 1), true);
              if (introPhaseRef.current === 'wordmark') setIntroPhase('particles');
              return;
            }
            entranceStartTimer = window.setTimeout(() => {
              if (!destroyed) entrance.play();
            }, ENTRANCE_START_MS);
          };
          entrance.addEventListener('DOMLoaded', () => {
            if (destroyed) return;
            entrance.goToAndStop(0, true);
            markLottieProgress(100);
            lottieReadyRef.current = true;
            setLottieReady(true);
            if (introPhaseRef.current === 'wordmark') playEntranceRef.current?.();
          });
          entrance.addEventListener('complete', () => {
            if (destroyed) return;
            entrance.goToAndStop(entrance.totalFrames - 1, true);
            if (introPhaseRef.current === 'wordmark') setIntroPhase('particles');
          });
          entrance.addEventListener('enterFrame', () => {
            if (destroyed || introPhaseRef.current !== 'wordmark') return;
            const total = Math.max(1, entrance.totalFrames - 1);
            if (entrance.currentFrame / total >= PARTICLES_AT_PROGRESS) setIntroPhase('particles');
          });
        } catch {
          // Last resort: still do not use fonts — advance so the page is usable.
          markLottieProgress(100);
          lottieReadyRef.current = true;
          setLottieReady(true);
        }
      })();
    });

    return () => {
      destroyed = true;
      playEntranceRef.current = null;
      window.clearTimeout(entranceStartTimer);
      cleanupHotzone?.();
      allAnims.forEach((anim) => anim.destroy());
      container.replaceChildren();
    };
  }, []);

  useEffect(() => {
    const statement = statementRef.current;
    if (!statement) return;
    const observer = new IntersectionObserver(([entry]) => setStatementVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(statement);
    return () => observer.disconnect();
  }, []);

  /* Desktop only: sticky cover fade scrub. Mobile uses a Fairchild-style tiled stack. */
  useEffect(() => {
    if (coverMode !== 'desktop') return;

    const update = () => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const rawProgress = -rect.top / window.innerHeight;
      const progress = Math.min(Math.max(rawProgress, 0), featured.length);
      const currentIndex = Math.min(Math.floor(progress), featured.length - 1);
      const transition = progress - currentIndex;
      const reveal = (phase: number, start: number, end: number) => {
        const amount = Math.min(Math.max((phase - start) / (end - start), 0), 1);
        return amount * amount * (3 - 2 * amount);
      };

      coverRefs.current.forEach((cover, index) => {
        if (!cover) return;
        const name = cover.querySelector<HTMLElement>('.cf-project-name');
        const number = cover.querySelector<HTMLElement>('.cf-project-index');
        const description = cover.querySelector<HTMLElement>('.cf-project-description');
        const image = cover.querySelector<HTMLImageElement>('img');
        if (!name || !number || !description) return;
        cover.style.setProperty('--cover-index', String(index));
        const isCurrent = index === currentIndex;
        const isIncoming = index === currentIndex + 1;
        cover.style.visibility = isCurrent || isIncoming ? 'visible' : 'hidden';
        cover.style.pointerEvents = isCurrent ? 'auto' : 'none';
        if (!isCurrent && !isIncoming) return;
        cover.style.clipPath = 'none';
        cover.style.filter = 'none';
        cover.style.opacity = isIncoming ? String(reveal(transition, 0.5, 0.9)) : '1';
        if (image) image.style.transform = 'none';

        const phase = (index === 0 ? rawProgress : progress) - index;
        const positionPhase = index === 0 ? Math.max(phase, 0) : phase;
        const position = `translate3d(0, ${-positionPhase * window.innerHeight}px, 0)`;
        name.style.transform = position;
        number.style.transform = position;
        number.style.opacity = String(reveal(phase, -0.17, 0.01) * (1 - reveal(phase, 0.15, 0.35)));
        const letters = name.querySelectorAll<HTMLElement>('.cf-name-letter');
        letters.forEach((letter, letterIndex) => {
          const stagger = letterIndex / Math.max(letters.length - 1, 3);
          const entrance = reveal(phase, -0.14 + stagger * 0.045, 0.04 + stagger * 0.045);
          const exit = reveal(phase, 0.4 + stagger * 0.081, 0.6 + stagger * 0.081);
          letter.style.opacity = String(entrance * (1 - exit));
        });
        description.style.opacity = String(reveal(phase, 0, 0.15) * (1 - reveal(phase, 0.75, 1)));
      });
    };
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [coverMode]);

  useEffect(() => {
    if (introPhase === 'loading') return;
    const hero = heroRef.current;
    if (!hero) return;
    let stop: (() => void) | undefined;
    const arm = () => {
      stop?.();
      stop = startShaneGrid(hero);
    };
    const frame = window.requestAnimationFrame(arm);
    const delayed = window.setTimeout(arm, 600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(delayed);
      stop?.();
    };
  }, [introPhase, lottieReady]);

  return <main className="cf-home" data-intro-phase={introPhase} {...(introGate ? { 'data-intro-gate': '' } : {})} aria-label="Selected work">
    <HomeProjectPrefetch enabled={introPhase === 'complete'} />
    <section ref={heroRef} className="cf-hero" aria-label="Shane Zhu">
      <HomeParticleField
        onProgress={(value) => {
          particleProgressRef.current = Math.max(particleProgressRef.current, value);
          bumpProgress();
        }}
        onReady={() => {
          particleProgressRef.current = 100;
          particlesReadyRef.current = true;
          setParticlesReady(true);
          bumpProgress();
        }}
      />
      <h1 className={`cf-wordmark${lottieReady ? ' is-lottie-on' : ''}`} aria-label="Shane" />
      <div ref={lottieRef} className="cf-wordmark-lottie" aria-hidden="true" />
      <div className={`cf-intro-loader${introPhase === 'loading' ? '' : ' is-hidden'}`} aria-hidden={introPhase !== 'loading'}>
        <div
          className="cf-loader-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={loadProgress}
          aria-valuetext={`${loadProgress}%`}
        >
          <i className="cf-loader-bar-fill" style={{ transform: `scaleX(${Math.max(loadProgress, 2) / 100})` }} />
        </div>
      </div>
      <p className="cf-hero-meta">
        <span>SENIOR UI DESIGNER</span>
        <span className="cf-hero-meta-locale">SHENZHEN, CN</span>
        <span className="cf-hero-meta-scroll">( SCROLL )</span>
      </p>
    </section>
    <section ref={statementRef} className={`cf-statement${statementVisible ? ' is-visible' : ''}`}>
      <h2>
        <span className="lang-en">
          <span className="cf-line"><span>I design product interfaces,</span></span>
          <span className="cf-line"><span>motion and visual systems</span></span>
          <span className="cf-line"><span>for intelligent hardware.</span></span>
        </span>
        <span className="lang-zh">
          <span className="cf-line"><span>我专注智能硬件的</span></span>
          <span className="cf-line"><span>产品界面、动效</span></span>
          <span className="cf-line"><span>与视觉系统设计。</span></span>
        </span>
      </h2>
    </section>
    <section className="cf-covers" id="work">
      {coverMode !== 'mobile' ? (
      <div ref={trackRef} className="cf-covers-track cf-covers-desktop" style={{ height: `${featured.length + 1}00vh` }}>
        <div className="cf-covers-sticky">
          {featured.map((project, index) => <Link className="cf-cover" href={`/work/${project.slug}`} key={project.slug} ref={(element) => { coverRefs.current[index] = element; }}>
            {coverMode === 'desktop' ? <Image src={coverFor(project)} alt="" fill sizes="100vw" loading="lazy" unoptimized draggable={false} data-pin-nopin="true" data-pin-no-hover="true" /> : null}
            <span className="cf-project-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="cf-project-name">{String(project.titleEn ?? project.title).split('').map((character, letter) => <span className="cf-name-letter" key={`${character}-${letter}`}>{character === ' ' ? '\u00a0' : character}</span>)}</span>
            <span className="cf-project-description">
              <span><Localized en={project.textEn} zh={project.text} /></span>
              <small><Localized en={project.scopeEn ?? ''} zh={project.scope ?? ''} /></small>
            </span>
          </Link>)}
          <svg className="cf-grain" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><filter id="cf-noise"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#cf-noise)" /></svg>
        </div>
      </div>
      ) : null}

      {coverMode !== 'desktop' ? (
      <div className="cf-home-work">
        {coverMode === 'mobile' ? <ProjectGrid /> : null}
      </div>
      ) : null}
    </section>
    <SiteCloseFooter />
  </main>;
}
