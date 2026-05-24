import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));
  page.on('response', res => {
    if (!res.ok() && res.url().includes('localhost')) {
      errors.push(`HTTP ${res.status()} ${res.url()}`);
    }
  });

  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);

  // Check key elements
  const checks = [
    { name: 'Header', selector: 'text=AI Terminal Studio', expect: true },
    { name: 'Start Loop button', selector: 'button:has-text("Start Loop")', expect: true },
    { name: 'Files tab', selector: 'text=Files', expect: true },
    { name: 'Chat tab', selector: 'text=Chat', expect: true },
    { name: 'Providers tab', selector: 'text=Providers', expect: true },
  ];

  let passed = 0;
  for (const c of checks) {
    const visible = await page.locator(c.selector).first().isVisible().catch(() => false);
    if (visible === c.expect) { console.log('✓', c.name); passed++; }
    else { console.log('✗', c.name); }
  }

  // Click Start Loop
  await page.click('button:has-text("Start Loop")').catch(() => {});
  await page.waitForTimeout(2000);

  // Check center panel loop started
  const loopRunning = await page.locator('text=Analyze').first().isVisible().catch(() => false);
  if (loopRunning) { passed++; console.log('✓ Loop started'); }

  // Navigate providers
  await page.click('text=Providers').catch(() => {});
  await page.waitForTimeout(800);
  const providerVisible = await page.locator('text=Ollama').first().isVisible().catch(() => false);
  if (providerVisible) { passed++; console.log('✓ Providers visible'); }

  // Take final screenshot
  await page.screenshot({ path: '/tmp/studio-final.png', fullPage: true });
  console.log('Screenshot saved: /tmp/studio-final.png');
  console.log(`Checks passed: ${passed}/${checks.length + 2}`);
  console.log('Errors found:', errors.length > 0 ? errors : 'none');

  fs.writeFileSync('/tmp/verify-results.json', JSON.stringify({ passed, total: checks.length + 2, errors }, null, 2));
  await browser.close();
})();
