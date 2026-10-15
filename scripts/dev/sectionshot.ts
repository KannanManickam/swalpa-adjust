// Screenshot a whole chapter section (stage + panel): node scripts/dev/sectionshot.ts <outFile> [sectionId] [width] [stepIndex]
import { chromium } from 'playwright-core';
const [out, sec = 'zipper', width = '1440', stepIdx = '5'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: Number(width), height: 1000 } });
const logs: string[] = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5178/', { waitUntil: 'networkidle' });
await page.addStyleTag({ content: 'nav{display:none!important}' });
await page.evaluate((s) => {
  const el = document.getElementById(s)!;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 40, behavior: 'instant' as ScrollBehavior });
}, sec);
await page.waitForTimeout(6000);
if (process.env.THEME === 'night') {
  await page.locator(`#${sec} [data-theme-toggle]`).click();
  await page.waitForTimeout(1500);
}
const dots = page.locator(`#${sec} .stepper .dot`);
const n = await dots.count();
if (n) await dots.nth(Math.min(Number(stepIdx), n - 1)).click();
await page.waitForTimeout(3500);
await page.locator(`#${sec}`).screenshot({ path: out });
console.log(logs.slice(0, 12).join('\n') || 'no console errors');
await browser.close();
