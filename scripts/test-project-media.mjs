import assert from 'node:assert/strict';
const imported = await import(process.argv[2] || 'playwright');
const { chromium, webkit } = imported.default ?? imported;
const browser = await (process.argv.includes('--webkit') ? webkit.launch() : chromium.launch({ channel: 'chrome', headless: true }));
try {
  const projects = [
    ['dji-romo', 31],
    ['dji-avinox', 32],
    ['dji-power', 18],
    ['fly-fpv-2-0', 24],
    ['dji-aura', 12],
  ];
  const mobile = !process.argv.includes('--desktop');
  for (const [slug, count] of projects) {
  const page = await browser.newPage({ viewport: { width: mobile ? 390 : 1440, height: 844 }, isMobile: mobile, hasTouch: mobile });
    const failures = [];
  page.on('response', response => {
    if (response.url().includes('/media/') && response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(`http://localhost:3000/work/${slug}`);
  const figures = page.locator('.placeholder.has-media');
  assert.equal(await figures.count(), count);
  for (let index = 0; index < count; index++) {
    const figure = figures.nth(index);
    await figure.scrollIntoViewIfNeeded();
    const media = figure.locator('img,video');
    const state = await media.evaluate(async e => {
      if (e.tagName === 'IMG') {
        await new Promise((resolve, reject) => {
          const timer = setInterval(() => {
            if (e.naturalWidth > 0 && e.parentElement.parentElement.classList.contains('is-ready')) { clearInterval(timer); resolve(); }
          }, 100);
          setTimeout(() => { clearInterval(timer); reject(new Error(`Image timed out: ${e.getAttribute('src')}`)); }, 15000);
        });
        return { src: e.currentSrc, width: e.naturalWidth, height: e.naturalHeight };
      }
      await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          if (e.error) { clearInterval(timer); reject(new Error(e.error.message)); }
          else if (e.readyState >= 2 && e.currentTime > 0) { clearInterval(timer); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(timer); reject(new Error(`Playback timed out: ${e.currentSrc}`)); }, 15000);
      });
      return { src: e.currentSrc, width: e.videoWidth, height: e.videoHeight };
    });
    assert(state.width > 0 && state.height > 0);
    if (new URL(state.src).pathname.endsWith('.mp4')) {
      assert.equal(state.src.includes('/mobile/'), mobile);
    }
    if (slug === 'dji-aura' && index === 3) {
      const delay = await media.evaluate(e => new Promise((resolve, reject) => {
        let endedAt;
        const timeout = setTimeout(() => reject(new Error('Loop replay timed out')), 8000);
        e.addEventListener('ended', () => { endedAt = performance.now(); }, { once: true });
        const playing = () => {
          if (!endedAt) return;
          clearTimeout(timeout);
          e.removeEventListener('playing', playing);
          resolve(performance.now() - endedAt);
        };
        e.addEventListener('playing', playing);
        e.currentTime = e.duration - .15;
      }));
      assert(delay >= 900, `AURA replayed too early: ${delay}ms`);
      console.log(`PASS AURA 04: replay delay ${Math.round(delay)}ms`);
    }
  }
  const unclearStills = await page.locator('.case-still').evaluateAll(es => es.filter(e => !e.classList.contains('is-ready') || e.querySelector('img').naturalWidth < 2).length);
  assert.equal(unclearStills, 0, `${slug}: a loaded still reverted to placeholder`);
  const videos = page.locator('.case-video video');
  for (let index = 0; index < await videos.count(); index++) {
    const video = videos.nth(index);
    await video.evaluate(e => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(350);
    const before = await video.evaluate(e => e.currentTime);
    await page.waitForTimeout(250);
    const returned = await video.evaluate(e => ({ paused: e.paused, time: e.currentTime, ready: e.parentElement.classList.contains('is-ready') }));
    assert(returned.ready && !returned.paused && returned.time !== before, `${slug}: video ${index} did not resume clearly on return`);
  }
  assert.deepEqual(failures, []);
  console.log(`PASS ${slug}: all ${count} assets, mobile source selection, no failed media responses`);
  await page.close();
  }
} finally { await browser.close(); }
