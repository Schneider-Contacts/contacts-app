// Synthetic browser fixtures only. All non-fixture requests are blocked.
// Configure PLAYWRIGHT_MODULE and CHROME_EXECUTABLE for existing local installs.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
(async () => {
  const browser = await chromium.launch({headless: true,
    ...(process.env.CHROME_EXECUTABLE ? {executablePath: process.env.CHROME_EXECUTABLE} : {})});
  try {
    for (const file of ['qa/combined-browser.html', 'qa/directory-home-browser.html', 'tests/dialog-accessibility.html']) {
      const page = await browser.newPage({viewport: {width: 1100, height: 1000}});
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'regression.test') return route.abort();
        const target = decodeURIComponent(url.pathname.slice(1));
        if (target.includes('..') || !fs.existsSync(path.join(root, target))) return route.abort();
        await route.fulfill({status: 200, body: fs.readFileSync(path.join(root, target)),
          contentType: target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.png') ? 'image/png' : target.endsWith('.svg') ? 'image/svg+xml' : 'text/html'});
      });
      await page.goto('http://regression.test/' + file);
      await page.waitForFunction(() => /ALL \d+ CHECKS PASSED|FAIL/.test(document.getElementById('results').textContent), {}, {timeout: 60000});
      const result = await page.locator('#results').textContent();
      assert(!result.includes('FAIL'), result);
      assert.deepEqual(errors, [], 'No browser script errors in ' + file);
      console.log(file + ': ' + result.match(/ALL \d+ CHECKS PASSED/)[0]);
      if (process.env.QA_SCREENSHOT_DIR && file === 'qa/directory-home-browser.html') {
        for (const width of [320, 390, 960]) {
          await page.locator('#previewWidth').selectOption(String(width));
          await page.locator('#fixture').screenshot({path: path.join(process.env.QA_SCREENSHOT_DIR, 'directory-home-' + width + '.png')});
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
