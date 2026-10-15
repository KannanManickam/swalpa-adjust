// Screenshot helper: node scripts/shot.ts <url> <out.png> [waitMs] [scrollToSelector] [width] [height]
import { chromium } from 'playwright-core';

const [url, out, waitMs = '6000', sel = '', w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) }, deviceScaleFactor: 1 });
const logs: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
if (sel) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
  }, sel);
}
await page.waitForTimeout(Number(waitMs));
await page.screenshot({ path: out });
console.log(logs.slice(0, 15).join('\n') || 'no console errors');
await browser.close();
