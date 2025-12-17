const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  // 1) Register page validations
  await page.goto('http://localhost:8000/register.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(200);
  // Click Daftar with empty fields
  // Call register() via page.eval to capture synchronous validation message
  const regMsg = await page.evaluate(() => {
    try { window.register(); } catch (e) { return 'register threw: ' + e.message; }
    return document.getElementById('regMsg') ? document.getElementById('regMsg').textContent.trim() : 'regMsg missing';
  });
  results.push({ page: 'register.html-empty', regMsg });

  // Check short password and username
  await page.fill('#regEmail', 'test@example.com');
  await page.fill('#regUsername', 'ab');
  await page.fill('#regPassword', '123');
  await page.fill('#regConfirm', '123');
  await page.click('text=Daftar');
  await page.waitForTimeout(500);
  const regMsg2 = await page.$eval('#regMsg', el => el.textContent.trim());
  results.push({ page: 'register.html-short', case: 'short-password or short-username', regMsg2 });

  // Try username valid but password mismatch
  await page.fill('#regUsername', 'abcd');
  await page.fill('#regPassword', '123456');
  await page.fill('#regConfirm', '654321');
  await page.click('text=Daftar');
  await page.waitForTimeout(500);
  const regMsg3 = await page.$eval('#regMsg', el => el.textContent.trim());
  results.push({ page: 'register.html-password-mismatch', regMsg3 });

  // 2) Login page validations
  await page.goto('http://localhost:8000/login.html', { waitUntil: 'domcontentloaded' });
  const loginMsg = await page.evaluate(() => { try { window.login(); } catch (e) { return 'login threw: '+e.message; } return document.getElementById('loginMsg') ? document.getElementById('loginMsg').textContent.trim() : 'loginMsg missing'; });
  results.push({ page: 'login.html', loginMsg });

  // 3) Index menu existence
  await page.goto('http://localhost:8000/index.html', { waitUntil: 'domcontentloaded' });
  const menuExists = await page.$('.nav') !== null;
  results.push({ page: 'index.html', menuExists });

  // 4) Task page redirect (requires auth)
  await page.goto('http://localhost:8000/tasks.html', { waitUntil: 'networkidle' });
  const urlAfterTasks = page.url();
  results.push({ page: 'tasks.html', url: urlAfterTasks });

  // 5) Withdraw page redirect (requires auth)
  await page.goto('http://localhost:8000/withdraw.html', { waitUntil: 'networkidle' });
  const urlAfterWithdraw = page.url();
  results.push({ page: 'withdraw.html', url: urlAfterWithdraw });

  console.log(JSON.stringify(results, null, 2));

  await browser.close();
})();