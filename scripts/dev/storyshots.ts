// Click through a story chapter and screenshot each step: node scripts/dev/storyshots.ts <outDir> [sectionId] [theme]
import { chromium } from 'playwright-core';
const [outDir, sec = 'zipper', theme = 'day'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
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
const card = page.locator(`#${sec} .story-card`);
if (theme === 'night') {
  await page.locator(`#${sec} [data-theme-toggle]`).click();
  await page.waitForTimeout(1500);
}
const n = await page.locator(`#${sec} .stepper .dot`).count();
for (let i = 0; i < n; i++) {
  await page.waitForTimeout(i === 0 ? 1500 : 3200);
  await card.screenshot({ path: `${outDir}/story_${theme}_${i + 1}.png` });
  console.log('step', i + 1);
  if (i < n - 1) await page.locator(`#${sec} button[aria-label="Next step"]`).click();
}
console.log(logs.slice(0, 12).join('\n') || 'no console errors');
await browser.close();
