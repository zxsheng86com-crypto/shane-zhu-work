/* Vanilla homepage boot — works even when React hydration stalls. */
(function () {
  function start(home) {
    if (!home || home.dataset.boot === '1') return;
    home.dataset.boot = '1';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mobile = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    home.setAttribute('data-home-layout', mobile ? 'mobile' : 'desktop');

    var loader = home.querySelector('.cf-intro-loader');
    var lottieHost = home.querySelector('.cf-wordmark-lottie');
    var wordmark = home.querySelector('.cf-wordmark');
    var particles = home.querySelector('.cf-hero-particles');

    function setPhase(phase) {
      home.setAttribute('data-intro-phase', phase);
      if (phase !== 'loading' && loader) loader.classList.add('is-hidden');
      particles = home.querySelector('.cf-hero-particles');
      if ((phase === 'particles' || phase === 'complete') && particles) {
        particles.classList.add('is-fallback');
      }
      try {
        window.dispatchEvent(new CustomEvent('portfolio:home-phase', { detail: { phase: phase } }));
      } catch (e) {}
    }

    function goParticles() {
      var phase = home.getAttribute('data-intro-phase');
      if (phase === 'particles' || phase === 'complete') return;
      setPhase('particles');
      window.setTimeout(function () {
        if (home.getAttribute('data-intro-phase') === 'particles') setPhase('complete');
      }, 700);
    }

    function startEntrance(lottie) {
      lottieHost = home.querySelector('.cf-wordmark-lottie');
      wordmark = home.querySelector('.cf-wordmark');
      if (!lottieHost || window.__cfLottieStarted) return;
      window.__cfLottieStarted = true;

      var wrap = document.createElement('div');
      wrap.className = 'cf-letters';
      var entranceWrap = document.createElement('div');
      entranceWrap.className = 'cf-entrance';
      wrap.appendChild(entranceWrap);
      lottieHost.appendChild(wrap);

      var anim = lottie.loadAnimation({
        container: entranceWrap,
        renderer: 'svg',
        loop: false,
        autoplay: false,
        path: '/lottie/home-entrance-shane.json',
      });

      anim.addEventListener('DOMLoaded', function () {
        if (wordmark) wordmark.classList.add('is-lottie-on');
        anim.goToAndStop(0, true);
        window.setTimeout(function () { anim.play(); }, 220);
      });
      anim.addEventListener('complete', function () {
        try { anim.goToAndStop(anim.totalFrames - 1, true); } catch (e) {}
        goParticles();
      });
      anim.addEventListener('data_failed', function () {
        if (wordmark) wordmark.classList.remove('is-lottie-on');
        goParticles();
      });
      window.setTimeout(function () {
        if (home.getAttribute('data-intro-phase') === 'wordmark') goParticles();
      }, 5000);
    }

    function loadLottie() {
      if (window.lottie) {
        startEntrance(window.lottie);
        return;
      }
      var script = document.createElement('script');
      script.src = '/lottie/lottie.min.js';
      script.async = true;
      script.onload = function () {
        if (window.lottie) startEntrance(window.lottie);
        else goParticles();
      };
      script.onerror = function () {
        if (wordmark) wordmark.classList.remove('is-lottie-on');
        goParticles();
      };
      document.head.appendChild(script);
    }

    function goWordmark() {
      if (home.getAttribute('data-intro-phase') !== 'loading') return;
      setPhase('wordmark');
      if (reduced) {
        if (wordmark) wordmark.classList.remove('is-lottie-on');
        window.setTimeout(goParticles, 100);
        return;
      }
      loadLottie();
    }

    window.setTimeout(goWordmark, reduced ? 60 : 1200);
    window.setTimeout(function () {
      var phase = home.getAttribute('data-intro-phase');
      if (phase === 'loading' || phase === 'wordmark') goParticles();
      if (loader) loader.classList.add('is-hidden');
    }, 5500);
  }

  function wait() {
    var home = document.querySelector('.cf-home');
    if (home) start(home);
    else window.requestAnimationFrame(wait);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wait);
  else wait();
})();
