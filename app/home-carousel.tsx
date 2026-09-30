'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { HomeParticleField } from './home-particle-field';
import { Localized } from './localized';
import { requestShaneGridSync, startShaneGrid } from './shane-grid';
import { SiteCloseFooter } from './site-close-footer';
import { projects } from './site';
import { HomeProjectPrefetch } from './project-prefetch';

const featured = projects.filter((project) => project.slug !== 'confidential-project').slice(0, 5);
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
  const [sceneEnabled, setSceneEnabled] = useState(false);
  const [particlesReady, setParticlesReady] = useState(false);
  // Only after mount: hide nav during intro. Without JS, nav stays visible.
  const [introGate, setIntroGate] = useState(false);
  const introPhaseRef = useRef(introPhase);
  const lottieArmed = introPhase !== 'loading';

  useEffect(() => {
    introPhaseRef.current = introPhase;
  }, [introPhase]);

  useEffect(() => {
    setIntroGate(true);
  }, []);

  /* ---- intro phases ----
     loading   → CSS bar (~1.2s)
     wordmark  → Shane entrance Lottie (particles mount + init in parallel)
     particles → field opacity fade-in at ~50% of Shane entrance
     complete  → nav opacity fade-in
     Hard timeouts so mobile never stays black if WebGL/Lottie stalls. */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const toWordmark = window.setTimeout(() => {
      setSceneEnabled(true);
      setIntroPhase('wordmark');
    }, reduced ? 80 : 1200);
    // Absolute safety: never leave the page without a finished intro.
    const forceComplete = window.setTimeout(() => {
      setSceneEnabled(true);
      setParticlesReady(true);
      setIntroPhase('complete');
    }, reduced ? 1200 : 5500);
    return () => {
      window.clearTimeout(toWordmark);
      window.clearTimeout(forceComplete);
    };
  }, []);

  // Advance to complete once particles are ready — or after a short wait in particles phase.
  useEffect(() => {
    if (introPhase !== 'particles') return;
    const delay = particlesReady ? 700 : 2200;
    const timer = window.setTimeout(() => setIntroPhase('complete'), delay);
    return () => window.clearTimeout(timer);
  }, [introPhase, particlesReady]);

  /* ---- hero wordmark Lottie ---- */
  useEffect(() => {
    if (!lottieArmed) return;
    const container = lottieRef.current;
    const hero = heroRef.current;
    if (!container || !hero) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setLottieReady(false);
      const timer = window.setTimeout(() => {
        setSceneEnabled(true);
        // Keep a beat on wordmark so CSS text fallback can paint, then particles.
        setIntroPhase('wordmark');
        window.setTimeout(() => setIntroPhase('particles'), 80);
      }, 100);
      return () => window.clearTimeout(timer);
    }

    const isMobile = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    let destroyed = false;
    let cleanupHotzone: (() => void) | undefined;
    let entranceStartTimer = 0;
    let fallbackTimer = 0;
    const allAnims: import('lottie-web').AnimationItem[] = [];

    const WORDMARK_SCALE = 1.6676;
    const LETTER_FILES = ['S', 'H1', 'A', 'NE'];
    const PEAK_FRAME = 30;
    const ENTRANCE_START_MS = 260;
    const PARTICLES_AT_PROGRESS = 0.5;

    const lettersWrap = document.createElement('div');
    lettersWrap.className = 'cf-letters';
    container.appendChild(lettersWrap);
    const entranceWrap = document.createElement('div');
    entranceWrap.className = 'cf-entrance';
    lettersWrap.appendChild(entranceWrap);

    (async () => {
      const { default: lottie } = await import('lottie-web');
      if (destroyed) return;

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
      let entranceReady = false;
      let introExpired = false;

      // Fade particles once Shane entrance is halfway — don't wait for it to finish.
      const revealParticles = () => {
        if (destroyed || particlesRevealed) return;
        particlesRevealed = true;
        setSceneEnabled(true);
        if (introPhaseRef.current === 'wordmark') setIntroPhase('particles');
      };

      const armParticlesAtHalfway = (anim: import('lottie-web').AnimationItem) => {
        anim.addEventListener('enterFrame', () => {
          if (destroyed || particlesRevealed) return;
          const total = Math.max(1, anim.totalFrames - 1);
          if (anim.currentFrame / total >= PARTICLES_AT_PROGRESS) revealParticles();
        });
      };

      const startEntrance = () => {
        if (!entranceReady || !entrance || destroyed || introExpired) return;
        setLottieReady(true);
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
        if (hotzoneStarted || destroyed || isMobile) return;
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
        // Safety: if enterFrame never fired, still reveal particles on complete.
        revealParticles();
      };

      /* Mobile: play entrance only, freeze last frame — no letter comps / hover scrub. */
      if (isMobile) {
        entrance = lottie.loadAnimation({
          container: entranceWrap,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: '/lottie/home-entrance-shane.json',
        });
        allAnims.push(entrance);
        armParticlesAtHalfway(entrance);
        entrance.addEventListener('DOMLoaded', () => {
          if (destroyed) return;
          entrance!.goToAndStop(0, true);
          entranceReady = true;
          startEntrance();
          requestAnimationFrame(() => requestShaneGridSync());
        });
        entrance.addEventListener('complete', () => {
          if (destroyed || !entrance) return;
          entrance.goToAndStop(entrance.totalFrames - 1, true);
          revealParticles();
          requestAnimationFrame(() => requestShaneGridSync());
        });
        entrance.addEventListener('data_failed', () => {
          if (destroyed) return;
          introExpired = true;
          setLottieReady(false);
          fallbackTimer = window.setTimeout(revealParticles, 400);
        });
        fallbackTimer = window.setTimeout(() => {
          if (!destroyed && introPhaseRef.current === 'wordmark') {
            introExpired = true;
            setLottieReady(false);
            revealParticles();
          }
        }, 3200);
        return;
      }

      /* Desktop: entrance → letter comps + pointer scrub */
      LETTER_FILES.forEach((name) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'cf-letter';
        lettersWrap.appendChild(wrapper);
        const anim = lottie.loadAnimation({
          container: wrapper,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          path: `/lottie/letters/${name}.json`,
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

      entrance = lottie.loadAnimation({
        container: entranceWrap,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: '/lottie/home-entrance-shane.json',
      });
      allAnims.push(entrance);
      armParticlesAtHalfway(entrance);
      entrance.addEventListener('DOMLoaded', () => {
        if (destroyed) return;
        entrance!.goToAndStop(0, true);
        entranceReady = true;
        startEntrance();
      });
      entrance.addEventListener('complete', () => {
        if (destroyed) return;
        entranceDone = true;
        handoffDesktop();
      });
      entrance.addEventListener('data_failed', () => {
        if (destroyed) return;
        introExpired = true;
        entranceReady = false;
        setLottieReady(false);
        fallbackTimer = window.setTimeout(revealParticles, 1500);
      });
      fallbackTimer = window.setTimeout(() => {
        if (!destroyed && introPhaseRef.current === 'wordmark') {
          introExpired = true;
          setLottieReady(false);
          revealParticles();
        }
      }, 4000);
    })().catch(() => {
      if (!destroyed) {
        setLottieReady(false);
        fallbackTimer = window.setTimeout(() => {
          setSceneEnabled(true);
          setIntroPhase('particles');
        }, 800);
      }
    });

    return () => {
      destroyed = true;
      window.clearTimeout(entranceStartTimer);
      window.clearTimeout(fallbackTimer);
      cleanupHotzone?.();
      allAnims.forEach((anim) => anim.destroy());
      container.replaceChildren();
    };
  }, [lottieArmed]);

  useEffect(() => {
    const statement = statementRef.current;
    if (!statement) return;
    const observer = new IntersectionObserver(([entry]) => setStatementVisible(entry.isIntersecting), { threshold: 0.3 });
    observer.observe(statement);
    return () => observer.disconnect();
  }, []);

  /* Desktop only: sticky cover fade scrub. Mobile uses a Fairchild-style tiled stack. */
  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 800px), (pointer: coarse)');
    if (mobile.matches) return;

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
        if (!name || !number || !description || !image) return;
        cover.style.setProperty('--cover-index', String(index));
        const isCurrent = index === currentIndex;
        const isIncoming = index === currentIndex + 1;
        cover.style.visibility = isCurrent || isIncoming ? 'visible' : 'hidden';
        cover.style.pointerEvents = isCurrent ? 'auto' : 'none';
        if (!isCurrent && !isIncoming) return;
        cover.style.clipPath = 'none';
        cover.style.filter = 'none';
        cover.style.opacity = isIncoming ? String(reveal(transition, 0.5, 0.9)) : '1';
        image.style.transform = 'none';

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
  }, []);

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
      {sceneEnabled ? <HomeParticleField onReady={() => setParticlesReady(true)} /> : null}
      <h1 className={`cf-wordmark${lottieReady ? ' is-lottie-on' : ''}`} aria-label="Shane">
        {'SHANE'.split('').map((character, index) => <span key={`${character}-${index}`} style={{ animationDelay: `${0.3 + index * 0.05}s` }}>{character === ' ' ? '\u00a0' : character}</span>)}
      </h1>
      <div ref={lottieRef} className="cf-wordmark-lottie" aria-hidden="true" />
      <div className={`cf-intro-loader${introPhase === 'loading' ? '' : ' is-hidden'}`} aria-hidden="true">
        <div className="cf-loader-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuetext="Loading">
          <i className="cf-loader-bar-fill" />
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
      {/* Desktop: fixed-stage opacity covers (unchanged) */}
      <div ref={trackRef} className="cf-covers-track cf-covers-desktop" style={{ height: `${featured.length + 1}00vh` }}>
        <div className="cf-covers-sticky">
          {featured.map((project, index) => <Link className="cf-cover" href={`/work/${project.slug}`} key={project.slug} ref={(element) => { coverRefs.current[index] = element; }}>
            {/* Lazy: hero LCP is galaxy/SHANE; both cover trees stay in DOM so eager would download hidden-branch covers on workplace nets. */}
            <Image src={coverFor(project)} alt="" fill sizes="100vw" loading="lazy" unoptimized draggable={false} />
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

      {/* Mobile: Fairchild-style vertical tile stack */}
      <div className="cf-project-stack">
        <div className="cf-project-stack-head">
          <span>LATEST PROJECTS</span>
          <Link href="/work">ALL WORK</Link>
        </div>
        {featured.map((project, index) => {
          const title = project.titleEn ?? project.title;
          const src = coverFor(project);
          return <Link className="cf-project-tile" href={`/work/${project.slug}`} key={`tile-${project.slug}`}>
            <div className="cf-project-tile-media">
              {src
                ? <Image src={src} alt="" fill sizes="100vw" loading="lazy" unoptimized draggable={false} />
                : null}
            </div>
            <div className="cf-project-tile-meta">
              <span className="cf-project-tile-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="cf-project-tile-title">{title}</span>
              <span className="cf-project-tile-scope"><Localized en={project.tagEn ?? project.type} zh={project.tag ?? project.type} /></span>
              <span className="cf-project-tile-arrow" aria-hidden="true">→</span>
            </div>
          </Link>;
        })}
      </div>
    </section>
    <SiteCloseFooter />
  </main>;
}
