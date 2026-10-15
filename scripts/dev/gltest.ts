import { chromium } from 'playwright-core';
for (const args of [['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'], ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], []]) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args });
  const page = await browser.newPage();
  await page.goto('http://localhost:5178/');
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null;
    if (!gl) return 'no webgl2';
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'ok';
  });
  await page.waitForTimeout(4000);
  const canv = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('canvas')];
    return cs.map((c) => `${c.width}x${c.height}`).join(',');
  });
  console.log(JSON.stringify(args), '=>', r, canv);
  await browser.close();
}
