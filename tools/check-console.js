const playwright = require('playwright');

(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();

  const pagesToCheck = [
    '/', 'index.html', 'login.html', 'register.html', 'dashboard.html',
    'deposit.html', 'create-task.html', 'tasks.html', 'history.html', 'withdraw.html', 'admin.html', 'my-tasks.html'
  ];

  const serverBase = 'http://localhost:8000/';

  const results = [];

  for (const pagePath of pagesToCheck) {
    const page = await context.newPage();
    const logs = [];

    page.on('console', msg => {
      try {
        logs.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        logs.push({ type: 'console', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      logs.push({ type: 'pageerror', text: err.message, stack: err.stack });
    });

    page.on('requestfailed', req => {
      logs.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText });
    });

    const url = serverBase + pagePath;
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      // Wait a bit for any JS to run
      await page.waitForTimeout(1200);
      results.push({ page: pagePath, status: resp && resp.status() ? resp.status() : 'no-status', logs });
    } catch (err) {
      results.push({ page: pagePath, status: 'error', error: err.message, logs });
    }

    await page.close();
  }

  await browser.close();

  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
})();