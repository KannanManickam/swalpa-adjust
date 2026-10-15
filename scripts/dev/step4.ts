import { chromium } from 'playwright-core';
const [outDir] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  const el = document.getElementById('zipper')!;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
});
await page.waitForTimeout(6000);
await page.locator('#zipper button[aria-label="Step 4: Zipper"]').click();
for (let i = 0; i < 4; i++) {
  await page.waitForTimeout(i === 0 ? 2500 : 4000);
  await page.locator('#zipper .story-card').screenshot({ path: `${outDir}/s4_${i}.png` });
}
await browser.close();
