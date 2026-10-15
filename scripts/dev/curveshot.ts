// Screenshot the "how many of us need to adjust?" chart of every chapter (dev server running):
// node scripts/dev/curveshot.ts <outDir> [width=1440] [day|night] [share%=30]   BASE=http://localhost:5178
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
const [outDir, width = '1440', theme = 'day', pct = '30'] = process.argv.slice(2);
const base = process.env.BASE ?? 'http://localhost:5178';
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: 1000 }, deviceScaleFactor: 2 });
const logs: string[] = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(base, { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'nav{display:none!important}' });
const ids = await page.$$eval('section .share-curve', (els) => els.map((e) => e.closest('section')!.id));
for (const [i, sec] of ids.entries()) {
  await page.locator(`#${sec} .share-curve`).scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  if (i === 0 && theme === 'night') {
    await page.locator(`#${sec} [data-theme-toggle]`).click();
    await page.waitForTimeout(800);
  }
  await page.locator(`#${sec}-share`).fill(pct);
  await page.waitForTimeout(600);
  const target = Number(width) >= 1024 ? page.locator(`#${sec} .story-panel`) : page.locator(`#${sec} .share-curve`).locator('..');
  await target.screenshot({ path: `${outDir}/${sec}-${width}-${theme}.png` });
  const head = await page.locator(`#${sec} .share-curve figcaption p`).textContent();
  console.log(`${sec}: ${head}`);
}
console.log(logs.slice(0, 12).join('\n') || 'no console errors');
await browser.close();
