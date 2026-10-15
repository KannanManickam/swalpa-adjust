// A chapter told as a guided walkthrough on one large stage:
// setup → what goes wrong today → the cost → the fix → the result → the difference.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Chapter as ChapterData } from '../data/chapters.ts';
import type { Story, SummaryLine } from '../data/stories.ts';
import { useTheme } from '../lib/theme.tsx';
import { byId } from '../sim/scenarios/index.ts';
import type { MetricDef } from '../sim/scenarios/types.ts';
import { compare, duration, fmtValue } from '../lib/format.ts';
import { SimStage, type SimStageHandle } from './SimStage.tsx';
import { ShareCurve } from './ShareCurve.tsx';
import { ArrowRight, External, Pause, Play, Restart } from './icons.tsx';
import { ThemeToggle } from './Sections.tsx';

type M = Record<string, number>;
const ease = [0.22, 1, 0.36, 1] as const;

export function StoryChapter({ ch, story, index }: { ch: ChapterData; story: Story; index: number }) {
  const def = byId(ch.id);
  const steps = story.steps;
  const sim = useRef<SimStageHandle>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);
  const { theme } = useTheme();
  const [playing, setPlaying] = useState(true);
  const [share, setShare] = useState(1);
  const [m, setM] = useState<{ a: M; b: M; t: number } | null>(null);
  const [auto, setAuto] = useState(false);
  const s = steps[step];
  const day = theme === 'day';

  // drive the camera and call-outs from the current step
  useEffect(() => {
    const st = sim.current?.stage();
    if (!st || !ready) return;
    const phone = window.innerWidth <= 760;
    st.setFocus({ world: s.world, region: (phone && s.regionMobile) || s.region, pitch: s.pitch, yaw: s.yaw, lift: phone ? 0.3 : 0.2 }, 1.6);
    st.setAnnotations((phone && s.annoMobile) || s.anno);
  }, [step, ready, s]);

  const go = useCallback((d: number) => setStep((x) => Math.max(0, Math.min(steps.length - 1, x + d))), [steps.length]);

  // the slider (or a tap on the share curve) jumps to the final step to show the result
  const pickShare = (x: number) => {
    setShare(x);
    if (step < steps.length - 1) setStep(steps.length - 1);
    setAuto(false);
  };

  // auto-play: hold each step for its duration, stop at the end
  useEffect(() => {
    if (!auto || !ready) return;
    if (step >= steps.length - 1) {
      setAuto(false);
      return;
    }
    const id = setTimeout(() => setStep((x) => Math.min(steps.length - 1, x + 1)), (s.dur || 8) * 1000);
    return () => clearTimeout(id);
  }, [auto, ready, step, steps.length, s.dur]);

  // arrow keys while the chapter is on screen
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let inView = false;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    const onKey = (e: KeyboardEvent) => {
      if (!inView || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      io.disconnect();
      window.removeEventListener('keydown', onKey);
    };
  }, [go]);

  const badge =
    s.badge === 'today'
      ? { text: story.badges.today, short: 'Status quo', cls: 'is-today' }
      : s.badge === 'fix'
        ? { text: story.badges.fix, short: 'Swalpa adjust', cls: 'is-fix' }
        : s.badge === 'setup'
          ? { text: 'The situation', short: 'The situation', cls: 'is-setup' }
          : { text: 'The difference', short: 'The difference', cls: 'is-compare' };

  return (
    <section ref={sectionRef} id={ch.id} className="relative scroll-mt-16 border-t hairline py-16 md:py-24" aria-labelledby={`${ch.id}-title`}>
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        {/* compact header */}
        <motion.div
          className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-10%' }}
          transition={{ duration: 0.8, ease }}
        >
          <div>
            <div className="flex items-center gap-3">
              <span className="num text-sm text-[var(--brand-ink)]">{ch.num}</span>
              <span className="h-px w-8 bg-[var(--chip-border)]" />
              <span className="eyebrow">{ch.short}</span>
            </div>
            <h2 id={`${ch.id}-title`} className="serif mt-3 text-[2.6rem] leading-[1] md:text-[3.6rem]">
              {ch.title}
            </h2>
          </div>
          <p className="max-w-[440px] pb-1 text-lg leading-snug text-[var(--color-ink-2)]">{ch.rule}</p>
        </motion.div>

        <div className={`story-card mt-8 overflow-hidden rounded-[28px] border ${day ? 'is-day' : ''}`}>
          {/* the stage */}
          <SimStage
            ref={sim}
            scenario={ch.id}
            mode="split"
            civicShare={share}
            playing={playing}
            speedMul={s.speed ?? 1}
            seed={11 + index}
            theme={theme}
            colorMode="explain"
            onReady={() => setReady(true)}
            onMetrics={(a, b, t) => setM({ a, b, t })}
            className="story-stage w-full"
          >
            {/* top bar: what we are looking at, controls, and what the colours mean */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 p-4 md:p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={badge.text}
                  className={`story-badge ${badge.cls} ${day ? 'is-day' : ''}`}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="dot" />
                  <span className="hidden sm:inline">{badge.text}</span>
                  <span className="sm:hidden">{badge.short}</span>
                </motion.div>
              </AnimatePresence>
              <div className="pointer-events-auto flex items-center gap-2">
                <ThemeToggle className={day ? 'is-day' : 'glass'} />
                <button className={`icon-btn ${day ? 'is-day' : 'glass'}`} onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button className={`icon-btn ${day ? 'is-day' : 'glass'}`} onClick={() => sim.current?.restart()} aria-label="Restart simulation">
                  <Restart size={16} />
                </button>
              </div>
              <div className="w-full">
                <div className={`legend ${day ? 'is-day' : ''}`}>
                  {story.legend.map((l) => (
                    <span key={l.text}>
                      <i style={{ background: l.color }} /> {l.pre && <span className="hidden sm:inline">{l.pre}</span>} {l.text}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* caption + navigation */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between md:p-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  className={`caption pointer-events-auto ${day ? 'is-day' : ''} ${s.summary ? 'is-summary' : ''}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.45, ease }}
                >
                  <div className="num text-[11px] uppercase tracking-[0.18em] opacity-60">
                    Step {step + 1} of {steps.length}
                  </div>
                  <div className="mt-1 text-[1.35rem] font-semibold leading-tight tracking-tight md:text-[1.6rem]">{s.title}</div>
                  {s.summary ? (
                    <Summary metrics={def.metrics} story={story} a={m?.a} b={m?.b} />
                  ) : (
                    <p className="mt-1.5 text-[0.98rem] leading-snug opacity-80">{s.text}</p>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className={`stepper pointer-events-auto ${day ? 'is-day' : ''}`}>
                <button
                  onClick={() => {
                    if (!auto && step === steps.length - 1) setStep(0);
                    setAuto((x) => !x);
                  }}
                  aria-pressed={auto}
                  aria-label={auto ? 'Stop auto-play' : 'Auto-play the steps'}
                  className={`nav auto ${auto ? 'on' : ''}`}
                >
                  {auto ? <Pause size={14} /> : <Play size={14} />}
                  <span className="hidden sm:inline">{auto ? 'Auto' : 'Auto-play'}</span>
                </button>
                <button onClick={() => go(-1)} disabled={step === 0} aria-label="Previous step" className="nav">
                  <ArrowRight size={16} className="rotate-180" />
                </button>
                <div className="flex items-center gap-1.5">
                  {steps.map((x, i) => (
                    <button
                      key={x.key}
                      onClick={() => setStep(i)}
                      aria-label={`Step ${i + 1}: ${x.key}`}
                      aria-current={i === step}
                      className={`dot ${i === step ? 'on' : ''}`}
                    >
                      <span>{x.key}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => go(1)} disabled={step === steps.length - 1} aria-label="Next step" className="nav next">
                  {step === steps.length - 1 ? 'Done' : 'Next'} <ArrowRight size={16} />
                  {auto && step < steps.length - 1 && <span key={step} className="auto-progress" style={{ animationDuration: `${s.dur || 8}s` }} />}
                </button>
              </div>
            </div>
          </SimStage>

          {/* try it · simulation numbers · evidence */}
          <div className="story-panel grid gap-x-10 gap-y-8 p-5 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <ShareSlider id={`${ch.id}-share`} label={story.slider} share={share} onChange={pickShare}>
              <ShareCurve id={ch.id} metrics={def.metrics} words={story.curve} label={ch.result.label} share={share} onPick={pickShare} />
            </ShareSlider>
            <LiveNumbers metrics={def.metrics} names={story.names} a={m?.a} b={m?.b} />
            <div className="lg:col-start-1 lg:row-start-2">
              <div className="panel-eyebrow">On real roads</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {ch.evidence.map((e) => (
                  <a key={e.stat} href={e.href} target="_blank" rel="noreferrer" className="evidence group">
                    <div className="num text-[1.35rem] leading-none tracking-tight">{e.stat}</div>
                    <p className="mt-2 text-[13px] leading-snug text-[var(--ink-2)]">{e.text}</p>
                    <div className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-[var(--ink-3)] group-hover:text-[var(--ink-2)]">
                      {e.source} <External size={11} />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 px-1 text-xs text-[var(--color-ink-3)]">A traffic simulation, not real-time data. {ch.simNote}</p>
      </div>
    </section>
  );
}

function ShareSlider({
  id,
  label,
  share,
  onChange,
  children,
}: {
  id: string;
  label: string;
  share: number;
  onChange: (x: number) => void;
  children?: ReactNode;
}) {
  const pct = Math.round(share * 100);
  const tone = pct > 60 ? 'var(--good)' : pct > 25 ? 'var(--warn)' : 'var(--bad)';
  return (
    <div className="lg:col-start-1 lg:row-start-1">
      <div className="panel-eyebrow">Try it</div>
      <label htmlFor={id} className="mt-2 flex items-end justify-between gap-4">
        <span className="text-[1.15rem] font-semibold leading-tight tracking-tight">{label}</span>
        <span className="num text-[2.1rem] leading-none" style={{ color: tone }}>
          {pct}%
        </span>
      </label>
      <input id={id} type="range" className="range mt-3" min={0} max={100} step={5} value={pct} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <div className="mt-0.5 flex justify-between text-[11px] text-[var(--ink-3)]">
        <span>nobody</span>
        <span>half</span>
        <span>everybody</span>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[var(--ink-2)]">Changes the swalpa-adjust road only. Today’s road stays as it is.</p>
      {children}
    </div>
  );
}

function LiveNumbers({ metrics, names, a, b }: { metrics: MetricDef[]; names: Story['names']; a?: M; b?: M }) {
  const hero = metrics.find((x) => x.hero) ?? metrics[0];
  const rest = metrics.filter((x) => x !== hero);
  const c = compare(hero, a?.[hero.key], b?.[hero.key]);
  const max = Math.max(a?.[hero.key] ?? 0, b?.[hero.key] ?? 0, 1e-6);
  return (
    <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <div className="panel-eyebrow flex items-center gap-2">
        <span className="live-dot" /> Simulation numbers
      </div>
      <div className="hero-metric mt-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-medium">{hero.label}</span>
          <Change c={c} big />
        </div>
        <Bar label={names.a} tone="bad" value={a?.[hero.key]} max={max} text={withUnit(hero, a?.[hero.key])} big />
        <Bar label={names.b} tone="good" value={b?.[hero.key]} max={max} text={withUnit(hero, b?.[hero.key])} big />
      </div>
      <div className="mt-3">
        <div className="metric-row is-head">
          <span />
          <span className="text-right text-[var(--bad)]">{names.a}</span>
          <span className="text-right text-[var(--good)]">{names.b}</span>
          <span className="text-right">Change</span>
        </div>
        {rest.map((d) => (
          <div key={d.key} className="metric-row">
            <span className="text-[var(--ink-2)]">{d.label}</span>
            <span className="num text-right text-[var(--bad)]">{withUnit(d, a?.[d.key])}</span>
            <span className="num text-right font-semibold text-[var(--good)]">{withUnit(d, b?.[d.key])}</span>
            <span className="text-right">
              <Change c={compare(d, a?.[d.key], b?.[d.key])} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function withUnit(d: MetricDef, v: number | undefined) {
  const s = fmtValue(d, v);
  if (s === '—' || !d.unit || d.clock) return s;
  return d.unit === '%' || d.unit.startsWith('/') ? `${s}${d.unit}` : `${s} ${d.unit}`;
}

function Change({ c, big }: { c: ReturnType<typeof compare>; big?: boolean }) {
  const cls = c.good === null ? 'is-same' : c.good ? 'is-good' : 'is-bad';
  return <span className={`change num ${cls} ${big ? 'is-big' : ''}`}>{c.text}</span>;
}

/** The result in two or three lines, drawn to scale, from the running simulation. */
function Summary({ metrics, story, a, b }: { metrics: MetricDef[]; story: Story; a?: M; b?: M }) {
  const defOf = (l: SummaryLine) => metrics.find((d) => d.key === l.key)!;
  const fmt = (l: SummaryLine, v: number | undefined) => (v === undefined ? '—' : l.format === 'duration' ? duration(v) : withUnit(defOf(l), v));
  const bars = story.summary.filter((l) => l.show === 'bars');
  const pairs = story.summary.filter((l) => l.show === 'pair');
  return (
    <div className="mt-4 space-y-4">
      {bars.map((l) => {
        const va = a?.[l.key];
        const vb = b?.[l.key];
        const c = compare(defOf(l), va, vb);
        const max = Math.max(va ?? 0, vb ?? 0, 1e-6);
        return (
          <div key={l.key}>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="opacity-70">{l.label}</span>
              <Change c={c} />
            </div>
            <Bar label={story.names.a} tone="bad" value={va} max={max} text={fmt(l, va)} />
            <Bar label={story.names.b} tone="good" value={vb} max={max} text={fmt(l, vb)} />
          </div>
        );
      })}
      <div className={`grid gap-3 text-[13px] ${pairs.length > 2 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {pairs.map((l) => {
          const c = compare(defOf(l), a?.[l.key], b?.[l.key]);
          return (
            <div key={l.key}>
              <div className="opacity-70">{l.label}</div>
              <div className="mt-0.5">
                <span className="num text-[var(--bad)]">{fmt(l, a?.[l.key])}</span>
                <span className="mx-1.5 opacity-40">→</span>
                <span className="num font-semibold text-[var(--good)]">{fmt(l, b?.[l.key])}</span>
              </div>
              {l.sub ? (
                <div className="text-[12px] opacity-60">{l.sub}</div>
              ) : (
                c.good !== null && <div className={`num text-[12px] ${c.good ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>{c.text}</div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[12px] leading-snug opacity-60">From the simulation. {story.note}</p>
    </div>
  );
}

function Bar({ label, tone, value, max, text, big }: { label: string; tone: 'bad' | 'good'; value?: number; max: number; text: string; big?: boolean }) {
  const color = `var(--${tone})`;
  return (
    <div className={`bar-row ${big ? 'is-big' : ''}`}>
      <span className="truncate opacity-70">{label}</span>
      <div className="bar-track">
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${Math.max(2, ((value ?? 0) / max) * 100)}%`, background: color }}
        />
      </div>
      <span className="num text-right font-semibold" style={{ color }}>
        {text}
      </span>
    </div>
  );
}
