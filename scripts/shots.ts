// Multi-section screenshots: node scripts/shots.ts <url> <outDir> <waitMs> <sel1> [sel2 ...]
import { chromium } from 'playwright-core';

const [url, outDir, waitMs, ...sels] = process.argv.slice(2);
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 1000);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const logs: string[] = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'networkidle' });
for (const sel of sels) {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 64, behavior: 'instant' as ScrollBehavior });
  }, sel);
  await page.waitForTimeout(Number(waitMs));
  const name = sel.replace(/[^a-z0-9]/gi, '') || 'top';
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log('shot', name);
}
console.log(logs.slice(0, 15).join('\n') || 'no console errors');
await browser.close();
