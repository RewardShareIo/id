const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();

  const page = await context.newPage();
  const logs = [];

  page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => logs.push({ type: 'pageerror', text: err.message, stack: err.stack }));
  page.on('requestfailed', req => logs.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText }));

  try {
    const resp = await page.goto('http://localhost:8000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1200);
    console.log(JSON.stringify({ status: resp && resp.status ? resp.status() : 'no-status', logs }, null, 2));
  } catch (err) {
    console.log(JSON.stringify({ status: 'error', error: err.message, logs }, null, 2));
  }

  await browser.close();
})();