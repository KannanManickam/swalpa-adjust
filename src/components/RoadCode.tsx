// Not on the page for now (taken off 14 Oct 2026 at the user's request).
// To bring it back, render <RoadCode /> after <FiveSeconds /> in App.tsx.
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { CHAPTERS } from '../data/chapters.ts';
import { Download, HabitIcon, Share } from './icons.tsx';
import { useTheme } from '../lib/theme.tsx';
import type { ThemeName } from '../render/theme.ts';

const ease = [0.22, 1, 0.36, 1] as const;

export function RoadCode() {
  const [name, setName] = useState('');
  const [rule, setRule] = useState(0);
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator);
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) drawCard(c, name.trim(), rule, theme);
    });
    return () => {
      cancelled = true;
    };
  }, [name, rule, theme]);

  const blob = () => new Promise<Blob | null>((res) => canvasRef.current?.toBlob(res, 'image/png'));
  const download = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'swalpa-adjust-pledge.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], 'swalpa-adjust-pledge.png', { type: 'image/png' });
    const data = {
      files: [file],
      title: 'Swalpa adjust maadi',
      text: `I’ll ${CHAPTERS[rule].rule.charAt(0).toLowerCase()}${CHAPTERS[rule].rule.slice(1)} #SwalpaAdjust #NammaBengaluru`,
    };
    if (navigator.canShare?.(data)) await navigator.share(data).catch(() => {});
    else void download();
  };

  return (
    <section id="road-code" className="relative scroll-mt-16 border-t hairline py-24 md:py-32" aria-labelledby="code-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <div className="eyebrow">The Bengaluru road code</div>
        <motion.h2
          id="code-title"
          className="serif mt-4 max-w-[1000px] text-[2.6rem] leading-[1.02] md:text-[4rem]"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease }}
        >
          Six rules. A few seconds each. <span className="text-[var(--brand-ink)]">Hours back for everyone.</span>
        </motion.h2>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_0.85fr]">
          <ol className="divide-y divide-[var(--color-line)] border-y hairline">
            {CHAPTERS.map((c, i) => (
              <motion.li
                key={c.id}
                className="grid grid-cols-[auto_1fr_auto] items-center gap-5 py-5"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, ease, delay: i * 0.05 }}
              >
                <span className="num text-sm text-[var(--brand-ink)]">{c.num}</span>
                <div>
                  <div className="text-xl font-medium md:text-2xl">{c.rule}</div>
                  <a href={`#${c.id}`} className="mt-1 inline-block text-sm text-[var(--color-ink-3)] hover:text-[var(--color-ink)]">
                    {c.title} · see it simulated
                  </a>
                </div>
                <span className="text-[var(--color-ink-3)]">
                  <HabitIcon kind={c.icon} size={30} />
                </span>
              </motion.li>
            ))}
          </ol>

          <div className="card rounded-[28px] p-5 md:p-7">
            <div className="eyebrow">Take one rule. Make it yours.</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm text-[var(--color-ink-2)]">Your name (optional)</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 28))}
                  placeholder="e.g. Kannan"
                  className="mt-1.5 w-full rounded-xl border hairline bg-[var(--surface-2)] px-3.5 py-2.5 outline-none focus:border-[var(--focus)]"
                />
              </label>
              <label className="block">
                <span className="text-sm text-[var(--color-ink-2)]">Your pledge</span>
                <select
                  value={rule}
                  onChange={(e) => setRule(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border hairline bg-[var(--surface-2)] px-3.5 py-2.5 outline-none focus:border-[var(--focus)]"
                >
                  {CHAPTERS.map((c, i) => (
                    <option key={c.id} value={i}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <canvas
              ref={canvasRef}
              width={1080}
              height={1350}
              className="mt-5 aspect-[4/5] w-full rounded-2xl border hairline"
              aria-label="Preview of your pledge card"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-primary" onClick={download}>
                <Download size={17} /> Download card
              </button>
              {canShare && (
                <button className="btn btn-ghost" onClick={share}>
                  <Share size={17} /> Share
                </button>
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--color-ink-3)]">Made in your browser. Nothing is uploaded.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (g.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// the downloadable card follows the site theme: a light card by day, a night card by night
const CARD = {
  day: {
    bg: ['#fffdf6', '#eaf0f6'],
    streak: ['rgba(15,157,99,0.2)', 'rgba(217,119,6,0.18)'],
    glow: 'rgba(255,210,26,0.4)',
    accent: '#a87400',
    ink: '#111827',
    ink2: '#4b5563',
    band: 'rgba(255,255,255,0.86)',
    foot: '#6b7280',
  },
  night: {
    bg: ['#0b1020', '#05070d'],
    streak: ['rgba(56,232,166,0.22)', 'rgba(255,214,140,0.22)'],
    glow: 'rgba(255,210,26,0.22)',
    accent: '#ffd21a',
    ink: '#eef1f6',
    ink2: '#aab3c4',
    band: 'rgba(5,7,13,0.75)',
    foot: '#6c768a',
  },
};

function drawCard(c: HTMLCanvasElement, name: string, idx: number, theme: ThemeName) {
  const T = CARD[theme];
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  const ch = CHAPTERS[idx];
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, T.bg[0]);
  bg.addColorStop(1, T.bg[1]);
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // light streaks
  for (let i = 0; i < 26; i++) {
    const y = 820 + i * 22;
    const grad = g.createLinearGradient(0, y, W, y - 140);
    const civic = i % 3 !== 0;
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, civic ? T.streak[0] : T.streak[1]);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.strokeStyle = grad;
    g.lineWidth = 3 + (i % 4);
    g.beginPath();
    g.moveTo(-40, y + 60);
    g.bezierCurveTo(W * 0.35, y, W * 0.65, y - 60, W + 40, y - 160);
    g.stroke();
  }
  const glow = g.createRadialGradient(W * 0.85, 120, 0, W * 0.85, 120, 520);
  glow.addColorStop(0, T.glow);
  glow.addColorStop(1, 'rgba(255,210,26,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);

  g.fillStyle = T.accent;
  g.font = '500 30px "Geist Mono Variable", monospace';
  g.fillText(`PLEDGE ${ch.num} / 06`, 90, 140);
  g.fillStyle = T.ink;
  g.font = 'italic 400 118px "Instrument Serif", serif';
  g.fillText(name ? `${name} will` : 'I will', 90, 300);
  g.fillText('swalpa adjust.', 90, 420);
  g.font = '500 54px "Geist Variable", sans-serif';
  g.fillStyle = T.ink;
  const lines = wrap(g, ch.rule, W - 180);
  lines.forEach((l, i) => g.fillText(l, 90, 560 + i * 70));
  g.font = '400 34px "Geist Variable", sans-serif';
  g.fillStyle = T.ink2;
  const sub = wrap(g, ch.fix.split('. ')[0] + '.', W - 180);
  sub.slice(0, 3).forEach((l, i) => g.fillText(l, 90, 590 + lines.length * 70 + 20 + i * 48));

  g.fillStyle = T.band;
  g.fillRect(0, H - 190, W, 190);
  g.font = '600 46px "Baloo Tamma 2", sans-serif';
  g.fillStyle = T.accent;
  g.fillText('ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ', 90, H - 105);
  g.font = '400 28px "Geist Variable", sans-serif';
  g.fillStyle = T.foot;
  g.fillText('A few seconds of patience. A city in motion. #SwalpaAdjust', 90, H - 60);
}
