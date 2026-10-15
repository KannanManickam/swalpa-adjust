// "The film": a ~90-second scripted sequence through all six habits.
// Plays live in the browser, and can be stepped frame-by-frame by
// scripts/render-film.ts to produce an MP4 (?film&capture).

import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { CHAPTERS, type Chapter } from '../data/chapters.ts';
import { Stage, type Metrics } from '../render/Stage.ts';
import { byId } from '../sim/scenarios/index.ts';
import type { Built, ScenarioDef } from '../sim/scenarios/types.ts';
import { compare, fmtValue } from '../lib/format.ts';
import { Logo } from './Sections.tsx';
import { Close, Pause, Play } from './icons.tsx';

type Scene =
  | { kind: 'title'; dur: number; scenario: string }
  | { kind: 'intro'; dur: number; scenario: string }
  | { kind: 'chapter'; dur: number; scenario: string; ch: Chapter }
  | { kind: 'outro'; dur: number; scenario: string };

const SCENES: Scene[] = [
  { kind: 'title', dur: 7, scenario: 'hero' },
  { kind: 'intro', dur: 7, scenario: 'hero' },
  ...CHAPTERS.map((ch) => ({ kind: 'chapter' as const, dur: 11.5, scenario: ch.id, ch })),
  { kind: 'outro', dur: 8, scenario: 'hero' },
];
const STARTS = SCENES.reduce<number[]>((acc, s, i) => (acc.push(i ? acc[i - 1] + SCENES[i - 1].dur : 0), acc), []);
export const FILM_DURATION = STARTS[STARTS.length - 1] + SCENES[SCENES.length - 1].dur;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** 0→1 over [start, start+dur] */
const ramp = (t: number, start: number, dur = 0.8) => ease((t - start) / dur);
// per-scene seeds and warm-ups so each world has reached its steady state when its scene starts
const FILM_SIM: Record<string, { seed: number; warmup: number }> = {
  hero: { seed: 5, warmup: 330 },
  zipper: { seed: 21, warmup: 480 },
  gridlock: { seed: 5, warmup: 392 },
  freeleft: { seed: 23, warmup: 260 },
  phantom: { seed: 24, warmup: 150 },
  busbay: { seed: 25, warmup: 300 },
  zebra: { seed: 26, warmup: 240 },
};

declare global {
  interface Window {
    __film?: { ready: () => Promise<void>; step: (dt: number) => Promise<void>; duration: number; frame: number };
  }
}

export default function Film({ onClose }: { onClose: () => void }) {
  const capture = new URLSearchParams(window.location.search).has('capture');
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const prepared = useRef(new Map<number, Promise<[Built, Built] | null>>());
  const shownScenario = useRef<string | null>(null);
  const time = useRef(0);
  const [t, setT] = useState(0);
  const [m, setM] = useState<{ a: Metrics; b: Metrics } | null>(null);
  const metricsRef = useRef<{ a: Metrics; b: Metrics } | null>(null);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [divX, setDivX] = useState(0.5);
  const divRef = useRef(0.5);

  const sceneAt = (tt: number) => {
    let i = 0;
    while (i < SCENES.length - 1 && tt >= STARTS[i + 1]) i++;
    return i;
  };

  const prepare = useCallback((i: number) => {
    if (i >= SCENES.length) return null;
    const sc = SCENES[i];
    // the opening scenario is reused by the intro and the outro
    if (sc.scenario === 'hero' && i > 0) return prepare(0);
    let p = prepared.current.get(i);
    if (!p) {
      const def = byId(sc.scenario);
      const cfg = FILM_SIM[sc.scenario];
      p = Stage.prepare(def, 1, { seed: cfg.seed, warmup: cfg.warmup });
      prepared.current.set(i, p);
    }
    return p;
  }, []);

  /** Make sure the stage shows the scene at time tt (loading if needed). */
  const ensureScene = useCallback(
    async (tt: number) => {
      const st = stageRef.current;
      if (!st) return;
      const i = sceneAt(tt);
      const sc = SCENES[i];
      // the outro returns to the opening scenario: keep it running instead of re-loading
      const key = sc.scenario === 'hero' ? 'hero' : `${sc.scenario}`;
      if (shownScenario.current !== key) {
        const built = await prepare(sc.kind === 'outro' ? 0 : i);
        if (!built) return;
        const def: ScenarioDef = byId(sc.scenario);
        st.show(def, built[0], built[1]);
        shownScenario.current = key;
        if (sc.scenario !== 'hero') prepared.current.delete(i);
      }
      // warm the next scene in the background
      void prepare(i + 1);
    },
    [prepare],
  );

  // stage + optional capture driver
  useEffect(() => {
    const host = hostRef.current!;
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    host.appendChild(canvas);
    const st = new Stage({
      canvas,
      overlay: overlayRef.current,
      quality: 'high',
      steadyCam: true,
      tagAlign: 'right',
      labels: { a: 'Status quo', b: 'Swalpa adjust' },
      onMetrics: (a, b) => {
        metricsRef.current = { a, b };
        if (!capture) setM({ a, b });
      },
    });
    stageRef.current = st;
    let raf = 0;
    let last = performance.now();
    let cancelled = false;

    const applyCamera = (tt: number) => {
      const i = sceneAt(tt);
      const local = tt - STARTS[i];
      const sc = SCENES[i];
      const k = local / sc.dur;
      st.cam.zoom = sc.kind === 'title' ? 0.86 + 0.18 * ease(k) : sc.kind === 'outro' ? 1.0 - 0.12 * ease(k) : 1.0 + 0.08 * k;
      st.cam.yaw = (k - 0.5) * (sc.kind === 'chapter' ? 0.08 : 0.16);
      st.cam.pitch = sc.kind === 'title' ? -0.12 * (1 - ease(k)) : 0;
      if (sc.kind === 'title') st.setWipe(1.001);
      else if (sc.kind === 'intro') st.setWipe(1 - 0.5 * ease((local - 1.2) / 3.2));
      else if (sc.kind === 'outro') st.setWipe(0.5 - 0.5 * ease((local - 0.5) / 4));
      else st.setWipe(1 - 0.5 * ease((local - 0.6) / 2.4));
    };

    const stepTo = async (dt: number) => {
      const next = Math.min(FILM_DURATION, time.current + dt);
      const prevScene = sceneAt(time.current);
      time.current = next;
      if (sceneAt(next) !== prevScene || !shownScenario.current) await ensureScene(next);
      applyCamera(next);
      st.advance(dt);
      divRef.current = st.dividerScreenX();
    };

    if (capture) {
      window.__film = {
        duration: FILM_DURATION,
        frame: 0,
        ready: async () => {
          await ensureScene(0);
          // let fonts settle
          await document.fonts.ready;
          setLoading(false);
        },
        step: async (dt: number) => {
          await stepTo(dt);
          flushSync(() => {
            setT(time.current);
            setM(metricsRef.current);
            setDivX(divRef.current);
          });
          window.__film!.frame++;
        },
      };
    } else {
      void ensureScene(0).then(() => {
        if (cancelled) return;
        setLoading(false);
        last = performance.now();
        const loop = async (now: number) => {
          if (cancelled) return;
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (playingRef.current && time.current < FILM_DURATION) {
            await stepTo(dt);
            setT(time.current);
            setDivX(divRef.current);
          } else st.advance(0);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    }
    const ro = new ResizeObserver(() => st.resize());
    ro.observe(host);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      st.dispose();
      canvas.remove();
      stageRef.current = null;
      delete window.__film;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playingRef = useRef(true);
  playingRef.current = playing;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const i = sceneAt(t);
  const sc = SCENES[i];
  const local = t - STARTS[i];
  const fade = Math.min(ramp(local, 0, 0.45), 1 - ramp(local, sc.dur - 0.45, 0.45));
  const ended = t >= FILM_DURATION - 0.01;

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-[var(--color-ink)]">
      <div ref={hostRef} className="absolute inset-0" />
      <div ref={overlayRef} className="stage-overlay" style={{ opacity: sc.kind === 'chapter' && byId(sc.scenario).view === 'split' ? fade : 0 }} />
      {/* before/after chips that ride on the wipe divider */}
      {(sc.kind === 'intro' || (sc.kind === 'chapter' && byId(sc.scenario).view === 'wipe')) && divX > 0.04 && divX < 0.96 && (
        <div className="pointer-events-none absolute top-[33vh] z-[1]" style={{ left: `${divX * 100}%`, opacity: fade }}>
          <div className="absolute right-[1vw] flex items-center gap-[0.5vw] whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-[0.9vw] py-[0.6vh] font-mono text-[0.75vw] uppercase tracking-[0.18em] text-[var(--selfish)]">
            <span className="h-[0.5vw] w-[0.5vw] rounded-full bg-[var(--selfish)]" />◀ Status quo
          </div>
          <div className="absolute left-[1vw] flex items-center gap-[0.5vw] whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-[0.9vw] py-[0.6vh] font-mono text-[0.75vw] uppercase tracking-[0.18em] text-[var(--civic)]">
            Swalpa adjust ▶<span className="h-[0.5vw] w-[0.5vw] rounded-full bg-[var(--civic)]" />
          </div>
        </div>
      )}
      {/* legibility gradients */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-black/85 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black/90 via-black/45 to-transparent" />
      {/* extra shade behind big type */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: sc.kind === 'title' || sc.kind === 'intro' ? 1 : sc.kind === 'outro' ? ramp(local, 0.2, 1.2) : 0,
          background:
            sc.kind === 'outro'
              ? 'radial-gradient(60% 55% at 50% 52%, rgba(0,0,0,0.78), rgba(0,0,0,0.25) 70%, transparent)'
              : 'linear-gradient(90deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 38%, transparent 70%)',
        }}
      />
      {/* scene fade */}
      <div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: 1 - fade }} />

      <div className="pointer-events-none absolute left-[4.5vw] top-[4.5vh] flex items-center gap-3" style={{ opacity: sc.kind === 'title' ? 0 : 0.9 }}>
        <Logo size={30} />
        <span className="text-[1.05vw] font-semibold tracking-tight">
          Swalpa<span className="text-[var(--brand)]">Adjust</span>
        </span>
      </div>

      {sc.kind === 'title' && <TitleCard local={local} />}
      {sc.kind === 'intro' && <IntroCard local={local} />}
      {sc.kind === 'chapter' && <ChapterCard ch={sc.ch} local={local} m={m} def={byId(sc.ch.id)} />}
      {sc.kind === 'outro' && <OutroCard local={local} />}

      {!capture && (
        <>
          <div className="absolute right-[3vw] top-[4vh] z-20 flex gap-2">
            <button className="icon-btn glass" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause film' : 'Play film'}>
              {playing ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <button className="icon-btn glass" onClick={onClose} aria-label="Close film">
              <Close size={16} />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 z-20 h-[3px] bg-white/10">
            <div className="h-full bg-[var(--brand)]" style={{ width: `${(t / FILM_DURATION) * 100}%` }} />
          </div>
          {(loading || ended) && (
            <div className="absolute inset-0 z-10 grid place-items-center">
              {loading ? (
                <span className="eyebrow">Warming up the traffic…</span>
              ) : (
                <div className="flex gap-3">
                  <button className="btn btn-primary" onClick={() => window.location.reload()}>
                    Watch again
                  </button>
                  <button className="btn btn-ghost" onClick={onClose}>
                    Explore the simulations
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Reveal({ at, local, children, className = '', dy = 18 }: { at: number; local: number; children: React.ReactNode; className?: string; dy?: number }) {
  const k = ramp(local, at, 0.9);
  return (
    <div className={className} style={{ opacity: k, transform: `translateY(${(1 - k) * dy}px)` }}>
      {children}
    </div>
  );
}

function TitleCard({ local }: { local: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-start justify-end px-[6vw] pb-[11vh]">
      <Reveal at={0.4} local={local}>
        <div className="eyebrow !text-[0.9vw]">Bengaluru · rush hour</div>
      </Reveal>
      <Reveal at={0.8} local={local}>
        <div className="serif mt-3 text-[7.4vw] leading-[0.95]">
          The world’s <em className="text-[var(--selfish)]">second</em>
          <br />
          most congested city.
        </div>
      </Reveal>
      <div className="mt-8 flex gap-[3vw]">
        {[
          ['36 min', 'to drive 10 km'],
          ['168 h', 'lost in rush hour every year'],
          ['1.3 crore', 'vehicles, 2,000+ more every day'],
        ].map(([v, l], k) => (
          <Reveal key={v} at={2.6 + k * 0.6} local={local}>
            <div className="num text-[2.6vw]">{v}</div>
            <div className="text-[1vw] text-[var(--color-ink-2)]">{l}</div>
          </Reveal>
        ))}
      </div>
      <Reveal at={4.6} local={local}>
        <div className="mt-6 text-[0.8vw] text-[var(--color-ink-3)]">TomTom Traffic Index 2025 · Karnataka Transport Department</div>
      </Reveal>
    </div>
  );
}

function IntroCard({ local }: { local: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-start justify-end px-[6vw] pb-[11vh]">
      <Reveal at={0.3} local={local}>
        <div className="serif text-[4.6vw] leading-[1.02]">
          Flyovers take years.
          <br />
          <span className="text-[var(--brand)]">Habits take seconds.</span>
        </div>
      </Reveal>
      <Reveal at={2.2} local={local}>
        <p className="mt-5 max-w-[46vw] text-[1.45vw] leading-snug text-[var(--color-ink-2)]">
          Same roads. Same traffic. On the left, everyone for themselves. On the right, everyone adjusts a little.
        </p>
      </Reveal>
    </div>
  );
}

function ChapterCard({ ch, local, m, def }: { ch: Chapter; local: number; m: { a: Metrics; b: Metrics } | null; def: ScenarioDef }) {
  const hero = def.metrics.find((x) => x.hero) ?? def.metrics[0];
  const a = m?.a[hero.key];
  const b = m?.b[hero.key];
  const c = compare(hero, a, b);
  return (
    <>
      <div className="pointer-events-none absolute left-[4.5vw] top-[11vh] max-w-[44vw]">
        <Reveal at={0.25} local={local}>
          <div className="flex items-center gap-3 text-[0.95vw]">
            <span className="num text-[var(--brand)]">{ch.num}</span>
            <span className="h-px w-[2vw] bg-white/30" />
            <span className="eyebrow !text-[0.85vw]">{ch.short}</span>
          </div>
        </Reveal>
        <Reveal at={0.45} local={local}>
          <div className="serif mt-2 text-[4.2vw] leading-[1]">{ch.title}</div>
        </Reveal>
        <Reveal at={1.0} local={local}>
          <div className="mt-3 text-[1.35vw] text-[var(--color-ink-2)]">{ch.rule}</div>
        </Reveal>
        {m && (m.a.frozen ?? 0) > 0 && (
          <div className="gridlock-badge mt-[2.4vh] inline-block rounded-[0.9vw] border border-[var(--selfish)]/60 bg-[#2a0b10]/80 px-[1.1vw] py-[0.9vh]">
            <div className="num text-[0.8vw] uppercase tracking-[0.22em] text-[var(--selfish)]">Gridlock · status quo</div>
            <div className="text-[1.15vw]">Nobody has moved for {Math.floor(m.a.frozen)} s</div>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute bottom-[7vh] left-[4.5vw] right-[4.5vw] flex items-end justify-between gap-[2vw]">
        <Reveal at={2.4} local={local} className="max-w-[40vw]">
          <div className="text-[1.05vw] leading-snug text-[var(--color-ink-3)]">{ch.simNote}</div>
        </Reveal>
        <Reveal at={3.2} local={local}>
          <div className="glass flex items-end gap-[2.2vw] rounded-[1.4vw] px-[1.8vw] py-[1.4vh]">
            <div>
              <div className="text-[0.8vw] uppercase tracking-[0.16em] text-[var(--color-ink-2)]">{hero.label}</div>
              {c.good !== null && <div className={`num mt-1 text-[1vw] ${c.good ? 'text-[var(--civic)]' : 'text-[var(--selfish)]'}`}>{c.text}</div>}
            </div>
            <Num label="Status quo" color="var(--selfish)" v={fmtValue(hero, a)} unit={hero.unit} />
            <Num label="Swalpa adjust" color="var(--civic)" v={fmtValue(hero, b)} unit={hero.unit} />
          </div>
        </Reveal>
      </div>
    </>
  );
}

function Num({ label, color, v, unit }: { label: string; color: string; v: string; unit: string }) {
  return (
    <div>
      <div className="text-[0.75vw] uppercase tracking-[0.16em]" style={{ color }}>
        {label}
      </div>
      <div className="num text-[3vw] leading-none">
        {v}
        <span className="ml-1 text-[1vw] text-[var(--color-ink-3)]">{unit}</span>
      </div>
    </div>
  );
}

function OutroCard({ local }: { local: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <Reveal at={0.4} local={local}>
        <div className="serif text-[4.4vw] leading-[1.05]">
          A few seconds of patience.
          <br />
          <span className="text-[var(--color-ink-2)]">A city in motion.</span>
        </div>
      </Reveal>
      <Reveal at={2.2} local={local}>
        <div className="serif mt-8 text-[6.4vw] leading-none">
          Swalpa adjust <em className="text-[var(--brand)]">maadi.</em>
        </div>
      </Reveal>
      <Reveal at={3.2} local={local}>
        <div className="kn mt-4 text-[2vw] text-[var(--color-ink-2)]">ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ</div>
      </Reveal>
    </div>
  );
}
