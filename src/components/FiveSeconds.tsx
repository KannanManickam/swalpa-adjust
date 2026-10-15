import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight } from './icons.tsx';

const ease = [0.22, 1, 0.36, 1] as const;
const MU = 0.5; // one lane discharges ~1,800 vehicles/hour = 0.5 per second

const TRAFFIC = [
  { label: 'Light', busy: 60 },
  { label: 'Busy', busy: 80 },
  { label: 'Rush hour', busy: 90 },
  { label: 'Packed', busy: 95 },
];

export function FiveSeconds() {
  const [block, setBlock] = useState(10);
  const [busy, setBusy] = useState(90);
  const r = useMemo(() => {
    const lam = (busy / 100) * MU;
    const clear = (block * MU) / (MU - lam); // time until the queue has fully dissolved
    const delayed = lam * clear;
    const total = (lam * MU * block * block) / (2 * (MU - lam)); // vehicle-seconds
    return { clear, delayed, total, times: total / block };
  }, [block, busy]);
  // you, plus every vehicle you held up
  const dots = Math.min(240, Math.round(r.delayed)) + 1;
  const lost = r.total / 60;

  return (
    <section id="five-seconds" className="relative scroll-mt-16 border-t hairline py-20 md:py-28" aria-labelledby="five-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }}>
          <h2 id="five-title" className="serif text-[2.6rem] leading-[1.02] md:text-[4rem]">
            Your few seconds cost everyone behind you.
          </h2>
          <p className="mt-4 max-w-[640px] text-lg leading-relaxed text-[var(--color-ink-2)]">
            Stop in a lane on a busy road, and the queue behind you keeps growing long after you have gone.
          </p>
        </motion.div>

        <div className="card mt-10 grid gap-8 rounded-[28px] p-6 md:p-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-12">
          {/* controls */}
          <div>
            <label htmlFor="block-secs" className="flex items-baseline justify-between gap-3">
              <span className="text-[1.05rem] font-medium">You stop in the lane for</span>
              <span className="num text-[2.2rem] leading-none text-[var(--brand-ink)]">{block} s</span>
            </label>
            <input
              id="block-secs"
              type="range"
              className="range mt-3"
              min={2}
              max={60}
              step={1}
              value={block}
              onChange={(e) => setBlock(Number(e.target.value))}
            />
            <div className="mt-0.5 flex justify-between text-[11px] text-[var(--color-ink-3)]">
              <span>2 s</span>
              <span>1 min</span>
            </div>
            <div className="mt-7 text-[1.05rem] font-medium">How busy is the road?</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4" role="group" aria-label="How busy the road is">
              {TRAFFIC.map((t) => (
                <button key={t.label} onClick={() => setBusy(t.busy)} aria-pressed={busy === t.busy} className="pick">
                  {t.label}
                  <span className="num block text-[11px] opacity-70">{t.busy}% full</span>
                </button>
              ))}
            </div>
            <p className="mt-7 text-xs leading-relaxed text-[var(--color-ink-3)]">
              Queue model for one lane that can pass 1,800 vehicles an hour, the textbook figure. Real roads do worse: queues spill back into junctions.
              Sources: FHWA Signal Timing Manual; Knoop et al., TRB 2010.
            </p>
          </div>

          {/* what it costs */}
          <div>
            <div className="grid grid-cols-3 items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
              <Tile value={String(block)} unit="s" label="you stop" tone="you" />
              <Arrow />
              <Tile value={Math.round(r.delayed).toString()} label="vehicles get caught behind you" tone="bad" />
              <Arrow />
              <Tile
                value={lost >= 1 ? lost.toFixed(1) : String(Math.round(r.total))}
                unit={lost >= 1 ? 'min' : 's'}
                label="lost by them, together"
                tone="bad"
              />
            </div>
            <p className="mt-5 text-[1.15rem] leading-snug">
              That is <span className="num font-semibold text-[var(--selfish)]">{Math.round(r.times)}×</span> the {block} seconds you took.
            </p>

            {/* timeline: you block, then the queue keeps clearing */}
            <div className="mt-6">
              <div className="flex h-9 overflow-hidden rounded-xl text-[12px] font-semibold text-white">
                <div
                  className="grid shrink-0 place-items-center whitespace-nowrap bg-[var(--selfish)] px-2"
                  style={{ width: `${Math.max(16, (block / r.clear) * 100)}%` }}
                >
                  {block} s
                </div>
                <div className="grid flex-1 place-items-center bg-[var(--amber)] px-2 text-center leading-tight text-[var(--on-amber)]">
                  queue clearing: {Math.round(r.clear - block)} s more
                </div>
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-[var(--color-ink-3)]">
                <span>you stop</span>
                <span>road back to normal after {Math.round(r.clear)} s</span>
              </div>
            </div>

            {/* every vehicle you held up */}
            <div className="mt-6 flex flex-wrap gap-[3px]" aria-hidden>
              {Array.from({ length: dots }, (_, i) => (
                <span
                  key={i}
                  className="h-2.5 w-2.5 rounded-[3px]"
                  style={{ background: i < 1 ? 'var(--brand)' : 'var(--selfish)', opacity: i < 1 ? 1 : 0.4 + 0.6 * (1 - i / dots) }}
                />
              ))}
              {Math.round(r.delayed) + 1 > dots && <span className="ml-1 text-xs text-[var(--color-ink-3)]">+{Math.round(r.delayed) + 1 - dots} more</span>}
            </div>
            <p className="mt-2 text-xs text-[var(--color-ink-3)]">Each square is one vehicle you held up. Yellow is you.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Tile({ value, unit, label, tone }: { value: string; unit?: string; label: string; tone: 'you' | 'bad' }) {
  return (
    <div className="rounded-2xl border hairline bg-[var(--surface-2)] p-3 md:p-4">
      <div
        className={`num text-[1.3rem] leading-none tracking-tight sm:text-[1.7rem] md:text-[2.1rem] ${tone === 'you' ? 'text-[var(--brand-ink)]' : 'text-[var(--selfish)]'}`}
      >
        {value}
        {unit && <span className="ml-1 text-[0.55em]">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[12px] leading-snug text-[var(--color-ink-2)]">{label}</div>
    </div>
  );
}

function Arrow() {
  return (
    <span className="hidden place-items-center text-[var(--color-ink-3)] sm:grid" aria-hidden>
      <ArrowRight size={16} />
    </span>
  );
}
