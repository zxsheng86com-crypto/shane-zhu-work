import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.argv[2] || 'playwright');
const browser = await (process.argv.includes('--webkit') ? webkit.launch() : chromium.launch({ channel: 'chrome', headless: true }));
try {
  for (const slug of ['common-ground', 'dji-avinox', 'dji-power', 'dji-aura-logo']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route(url => url.pathname.includes('/media/') || url.pathname === '/_next/image', async route => { await held; await route.continue(); });
    await page.goto(`http://localhost:3000/work/${slug}`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.fonts.load('16px Inter'));
    await page.evaluate(() => scrollTo(0, 2000));
    await page.waitForTimeout(1000);
    const snapshot = () => page.evaluate(() => ({ y: scrollY, height: document.documentElement.scrollHeight, boxes: [...document.querySelectorAll('.placeholder.has-media')].map(e => e.offsetHeight) }));
    const before = await snapshot();
    release();
    await page.waitForTimeout(4000);
    const after = await snapshot();
    console.log(slug, JSON.stringify({ before, after }));
    if (!process.argv.includes('--baseline')) {
      assert(before.boxes.every(h => h > 0), 'Unloaded media must reserve space');
      assert.deepEqual(after, before, 'Media downloads must not move layout or scroll position');
    }
    await page.close();
  }
} finally { await browser.close(); }
