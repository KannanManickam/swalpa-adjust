// Step the film in capture mode and grab stills at given times: node scripts/dev/filmcheck.ts outDir t1 t2 ...
import { chromium } from 'playwright-core';
const [outDir, ...times] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
await page.goto('http://localhost:5178/?film&capture', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!(window as any).__film);
await page.evaluate(() => (window as any).__film.ready());
let t = 0;
for (const target of times.map(Number)) {
  while (t < target - 1e-6) {
    const dt = Math.min(1 / 15, target - t);
    await page.evaluate((d) => (window as any).__film.step(d), dt);
    t += dt;
  }
  await page.screenshot({ path: `${outDir}/film_${String(target).padStart(3, '0')}.jpg`, type: 'jpeg', quality: 80 });
  console.log('still', target);
}
await browser.close();
