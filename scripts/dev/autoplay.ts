import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.getElementById('zipper')!;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
});
await page.waitForTimeout(6000);
await page.locator('#zipper button[aria-label="Auto-play the steps"]').click();
const cur = async () => page.locator('#zipper .stepper .dot.on').getAttribute('aria-label');
for (let i = 0; i < 6; i++) {
  console.log(`t+${i * 5}s:`, await cur());
  await page.waitForTimeout(5000);
}
await browser.close();
