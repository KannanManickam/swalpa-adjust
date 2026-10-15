// node scripts/dev/zoomshot.ts <selector> <stageIndexFromEnd> <zoom> <out> [fx] [fz]
import { chromium } from 'playwright-core';
const [sel, idx, zoom, out, fx = '0', fz = '0'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
await page.evaluate((s) => {
  const el = document.querySelector(s)!;
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 64);
}, sel);
await page.waitForTimeout(7000);
await page.evaluate(
  ([i, z, x, y]) => {
    const st = (window as any).__stages.filter((s: any) => s.worlds.length).at(-Number(i) - 1);
    st.cam.zoom = Number(z);
    st.cam.fx = Number(x);
    st.cam.fz = Number(y);
  },
  [idx, zoom, fx, fz],
);
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close();
