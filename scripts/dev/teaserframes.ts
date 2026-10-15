// Steps the teaser exactly like the recorder and saves stills at given times:
//   node scripts/dev/teaserframes.ts <outDir> [t1 t2 ...]   (dev server on 5178)
import { chromium } from 'playwright-core';
const [outDir, ...ts] = process.argv.slice(2);
const times = (ts.length ? ts : ['2.5', '7', '12', '19.5', '24', '31.5', '36', '43.5', '46.5', '49', '51.5', '54', '58.5']).map(Number);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
// SS=2 renders at twice the size, as the recorder does
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: Number(process.env.SS ?? 1) });
const logs: string[] = [];
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
await page.goto('http://localhost:5178/?teaser&capture', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!(window as unknown as { __film?: unknown }).__film, null, { timeout: 60000 });
await page.evaluate(() => (window as unknown as { __film: { ready: () => Promise<void> } }).__film.ready());
const fps = 30;
let frame = 0;
for (const t of times.sort((a, b) => a - b)) {
  const target = Math.round(t * fps);
  const n = target - frame;
  if (n > 0)
    await page.evaluate(async (k) => {
      for (let i = 0; i < k; i++) await (window as any).__film.step(1 / 30);
    }, n);
  frame = target;
  await page.screenshot({ path: `${outDir}/t${String(t).padStart(4, '0')}.png` });
  console.log('saved', t);
}
console.log(logs.slice(0, 8).join('\n') || 'no console errors');
await browser.close();
