// Renders the in-browser film to an MP4, frame by frame (deterministic, so it is
// smooth regardless of machine speed). Needs a running server (npm run build && npm run preview) and ffmpeg.
//   node scripts/render-film.ts [url] [out.mp4] [fps] [width] [height] [supersample]
// supersample 2 renders every frame at twice the size and scales it down, which smooths the
// shimmer of thin lines and small vehicles in wide shots.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5179/?film&capture';
const out = process.argv[3] ?? 'video/swalpa-adjust-film.mp4';
const fps = Number(process.argv[4] ?? 30);
const W = Number(process.argv[5] ?? 1920);
const H = Number(process.argv[6] ?? 1080);
const SS = Number(process.argv[7] ?? 1);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: SS });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!(window as unknown as { __film?: unknown }).__film, null, { timeout: 60000 });
await page.evaluate(() => (window as unknown as { __film: { ready: () => Promise<void> } }).__film.ready());
const duration = await page.evaluate(() => (window as unknown as { __film: { duration: number } }).__film.duration);
const frames = Math.ceil(duration * fps);
console.log(`rendering ${frames} frames (${duration.toFixed(1)} s @ ${fps} fps) → ${out}`);

const ff = spawn(
  'ffmpeg',
  [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-c:v',
    'mjpeg',
    '-i',
    '-',
    ...(SS > 1 ? ['-vf', `scale=${W}:${H}:flags=lanczos`] : []),
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '17',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    out,
  ],
  {
    stdio: ['pipe', 'inherit', 'inherit'],
  },
);
const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  await page.evaluate((dt) => (window as unknown as { __film: { step: (d: number) => Promise<void> } }).__film.step(dt), 1 / fps);
  let buf: Buffer | null = null;
  for (let attempt = 0; attempt < 3 && !buf; attempt++) {
    try {
      buf = await page.screenshot({ type: 'jpeg', quality: 93, timeout: 120000 });
    } catch (e) {
      console.warn(`screenshot retry ${attempt + 1} at frame ${f}:`, (e as Error).message.split('\n')[0]);
    }
  }
  if (!buf) throw new Error(`could not capture frame ${f}`);
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (f % 150 === 0) console.log(`frame ${f}/${frames}  ${((Date.now() - t0) / 1000).toFixed(0)}s elapsed`);
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
