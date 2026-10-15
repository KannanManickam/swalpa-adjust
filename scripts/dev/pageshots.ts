// Screenshot every section of the page in one theme: node scripts/dev/pageshots.ts <outDir> [day|night] [width]
import { chromium } from 'playwright-core';
const [outDir, theme = 'day', width = '1440'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: 1000 } });
const logs: string[] = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.addInitScript((t) => localStorage.setItem('swalpa-theme', t), theme);
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
await page.waitForTimeout(4500);
// scroll through once so everything that fades in on scroll has appeared
const total = await page.evaluate(() => document.body.scrollHeight);
for (let y = 0; y < total; y += 500) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y);
  await page.waitForTimeout(220);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/${theme}_${width}_00_hero.png` });
await page.addStyleTag({ content: 'nav{display:none!important}' });
const parts: [string, string][] = [
  ['01_numbers', 'section[aria-labelledby="numbers-title"]'],
  ['02_map', '#map'],
  ['03_habits', '#habits'],
  ['04_zipper', '#zipper'],
  ['05_five', '#five-seconds'],
  ['07_method', '#method'],
  ['08_footer', 'footer'],
];
for (const [name, sel] of parts) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(name === '04_zipper' ? 7000 : 1600);
  await el.screenshot({ path: `${outDir}/${theme}_${width}_${name}.png` });
}
console.log(logs.slice(0, 12).join('\n') || 'no console errors');
await browser.close();
