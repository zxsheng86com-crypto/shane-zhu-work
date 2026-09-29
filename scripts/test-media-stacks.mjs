import assert from 'node:assert/strict';
const { chromium, webkit } = await import(process.argv[2] || 'playwright');
const browser = await (process.argv.includes('--webkit') ? webkit.launch() : chromium.launch({ channel: 'chrome', headless: true }));
try {
  const page = await browser.newPage();
  for (const width of [390, 768, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    for (const slug of ['common-ground', 'dji-avinox', 'dji-aura-logo']) {
      await page.goto(`http://localhost:3000/work/${slug}`);
      for (const stack of await page.locator('.media-stack').all()) {
        await stack.scrollIntoViewIfNeeded();
        await stack.locator('video,img').evaluateAll(es => Promise.all(es.map(e => {
          if (e.tagName === 'IMG') return e.decode();
          if (e.readyState >= 1) return;
          return new Promise((resolve, reject) => {
            e.addEventListener('loadedmetadata', resolve, { once: true });
            e.addEventListener('error', reject, { once: true });
          });
        })));
        await page.waitForTimeout(900);
        const heights = await stack.evaluate(e => [...e.children].map(c => c.getBoundingClientRect().height));
        assert(Math.abs(heights[0] - heights[1]) < .5, `${slug} at ${width}px: ${heights}`);
        const gaps = await stack.evaluate(e => {
          const [top, bottom] = [...e.querySelector(':scope>div').children].map(c => c.getBoundingClientRect());
          const right = e.querySelector(':scope>figure').getBoundingClientRect();
          return [bottom.top - top.bottom, right.left - top.right];
        });
        assert(Math.abs(gaps[0] - gaps[1]) < .5, `Horizontal and vertical gaps differ: ${gaps}`);
        const pairGap = await page.locator('.media-pair').first().evaluate(e => parseFloat(getComputedStyle(e).columnGap));
        assert(gaps.every(gap => Math.abs(gap - pairGap) < .5), `Combination gaps ${gaps} must match double-column gap ${pairGap}`);
      }
    }
    console.log(`PASS: all populated combinations align without cropping at ${width}px`);
  }
} finally { await browser.close(); }
