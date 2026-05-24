import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3000);

  // Introspect DOM structure
  const info = await page.evaluate(() => {
    const root = document.getElementById('root');
    const body = document.body;
    return {
      rootChildCount: root ? root.children.length : -1,
      rootHTML: root ? root.innerHTML.slice(0, 500) : 'null',
      bodyBg: getComputedStyle(body).backgroundColor,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: '/tmp/studio-inspect.png' });
  await browser.close();
})();
