// The 60-second teaser for social media: a 1080×1080 frame that plays SCENES (timeline.ts) on the
// real simulations, day theme, with large captions. Local only (?teaser on the dev server).
// scripts/render-film.ts records it frame by frame through window.__film (?teaser&capture).
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Stage } from '../render/Stage.ts';
import { byId } from '../sim/scenarios/index.ts';
import type { Built } from '../sim/scenarios/types.ts';
import { Logo } from '../components/Sections.tsx';
import { CUES, SCENES, TEASER_DURATION, cueAt, type Cue } from './timeline.ts';

const SIZE = 1080;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
/** 0 → 1 over [start, start + dur] */
const ramp = (t: number, start: number, dur = 0.5) => easeOut((t - start) / dur);
const keyOf = (i: number) => `${SCENES[i].scenario}:${SCENES[i].seed}:${SCENES[i].warmup}`;

declare global {
  interface Window {
    __film?: { ready: () => Promise<void>; step: (dt: number) => Promise<void>; duration: number; frame: number };
  }
}

export default function Teaser() {
  const capture = new URLSearchParams(window.location.search).has('capture');
  const boxRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(!capture);
  const [scale, setScale] = useState(1);
  const only_ = useRef<RegExp | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  // fit the 1080 frame into the window when previewing
  useEffect(() => {
    if (capture) return;
    const fit = () => setScale(Math.min(window.innerWidth / SIZE, (window.innerHeight - 64) / SIZE, 1));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [capture]);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    hostRef.current!.appendChild(canvas);
    const st = new Stage({ canvas, overlay: overlayRef.current, mode: 'split', theme: 'day', colorMode: 'explain', steadyCam: true, quality: 'high' });
    const worlds = new Map<string, [Built, Built]>();
    let shown: number | null = null; // scene index on stage
    let lastCue: Cue | null = null;
    let time = 0;
    let cancelled = false;
    let raf = 0;

    const prepareAll = async () => {
      const keys = [...new Set(SCENES.map((_, i) => keyOf(i)))];
      for (let k = 0; k < keys.length; k++) {
        const i = SCENES.findIndex((_, j) => keyOf(j) === keys[k]);
        const sc = SCENES[i];
        const built = await Stage.prepare(byId(sc.scenario), 1, {
          seed: sc.seed,
          warmup: sc.warmup,
          onProgress: (p) => setProgress((k + p) / keys.length),
          cancelled: () => cancelled,
        });
        if (!built) return;
        // let the current shot hide call-outs it is not about
        for (const w of built) {
          const all = w.annotate!;
          w.annotate = (mode) => {
            const only = only_.current;
            const out = all(mode);
            return only ? out.filter((x) => x.kind === 'chain' || x.kind === 'badge' || only.test(x.text)) : out;
          };
        }
        worlds.set(keys[k], built);
      }
    };

    // put the right scene, camera and call-outs on stage for time tt
    const direct = (tt: number) => {
      const cue = cueAt(tt);
      if (cue !== lastCue) {
        const sc = SCENES[cue.scene];
        const sh = sc.shots[cue.shot];
        if (shown === null || keyOf(shown) !== keyOf(cue.scene)) {
          const [a, b] = worlds.get(keyOf(cue.scene))!;
          st.show(byId(sc.scenario), a, b);
        }
        shown = cue.scene;
        only_.current = sh.only ?? null;
        st.setSpeed(byId(sc.scenario).speed * sh.speed);
        st.setAnnotations(sh.anno);
        st.setFocus({ world: sh.world, region: sh.region, pitch: sh.pitch, yaw: sh.yaw, top: 0.27, lift: sh.stamp ? 0.2 : 0.08 }, 0);
        lastCue = cue;
      }
      // a slow push-in on every shot
      const sh = SCENES[cue.scene].shots[cue.shot];
      st.cam.zoom = 1 + (sh.push ?? 0.05) * clamp01((tt - cue.start) / sh.dur);
    };

    const stepBy = (dt: number) => {
      time = Math.min(TEASER_DURATION, time + dt);
      direct(time);
      st.advance(dt);
    };

    if (capture) {
      window.__film = {
        duration: TEASER_DURATION,
        frame: 0,
        ready: async () => {
          await prepareAll();
          await document.fonts.ready;
          direct(0);
          st.advance(0);
          flushSync(() => setLoading(false));
        },
        step: async (dt: number) => {
          stepBy(dt);
          flushSync(() => setT(time));
          window.__film!.frame++;
        },
      };
    } else {
      void prepareAll().then(() => {
        if (cancelled) return;
        setLoading(false);
        direct(0);
        let last = performance.now();
        const loop = (now: number) => {
          if (cancelled) return;
          const dt = Math.min(0.1, (now - last) / 1000);
          last = now;
          if (playingRef.current && time < TEASER_DURATION) {
            stepBy(dt);
            setT(time);
          } else st.advance(0);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      });
    }
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      st.dispose();
      canvas.remove();
      delete window.__film;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === 'r') window.location.reload();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cue = cueAt(t);
  const scene = SCENES[cue.scene];
  const shot = scene.shots[cue.shot];
  const local = t - cue.start;
  const sceneLocal = t - cue.sceneStart;
  const sceneDur = scene.shots.reduce((s, x) => s + x.dur, 0);
  // fade through the background colour between scenarios
  const veil =
    cue.scene === 0 && sceneLocal < 0.6 ? 1 - ramp(sceneLocal, 0, 0.6) : Math.max(1 - ramp(sceneLocal, 0, 0.3), ramp(sceneLocal, sceneDur - 0.25, 0.25));
  const lastScene = cue.scene === SCENES.length - 1;
  const capIn = ramp(local, 0.05, 0.4);
  const stampIn = shot.stamp ? ramp(local, shot.stamp.at, 0.35) : 0;
  const endIn = shot.end !== undefined ? ramp(local, shot.end, 0.7) : 0;
  const idx = CUES.indexOf(cue);

  return (
    <div className="fixed inset-0 grid place-items-center overflow-hidden" style={{ background: capture ? '#e4e9ef' : '#11151c' }}>
      <div
        ref={boxRef}
        className="teaser-box relative overflow-hidden"
        style={{
          width: SIZE,
          height: SIZE,
          transform: capture ? undefined : `scale(${scale})`,
          transformOrigin: 'center',
          background: '#e4e9ef',
          color: '#111827',
        }}
      >
        <div ref={hostRef} className="absolute inset-0" />
        <div ref={overlayRef} className="stage-overlay" style={{ opacity: 1 - endIn }} />

        {/* caption card */}
        <div className="absolute inset-x-[48px] top-[44px]" style={{ opacity: capIn * (1 - endIn), transform: `translateY(${(1 - capIn) * -14}px)` }}>
          <div className="t-card">
            {shot.tag && (
              <div className={`t-chip ${shot.tag === 'today' ? 'is-today' : 'is-fix'}`}>
                <span className="dot" />
                {shot.tag === 'today' ? 'Today' : 'Adjust a little'}
              </div>
            )}
            <div className="t-title">{shot.title}</div>
            {shot.sub && <div className="t-sub">{shot.sub}</div>}
            {shot.source && <div className="t-source">{shot.source}</div>}
          </div>
        </div>

        {/* the result, popping in */}
        {shot.stamp && (
          <div
            className="absolute inset-x-0 bottom-[96px] flex justify-center"
            style={{ opacity: stampIn * (1 - endIn), transform: `scale(${0.85 + 0.15 * stampIn})` }}
          >
            <div className="t-stamp">
              <span className="num t-value">{shot.stamp.value}</span>
              <span className="t-label">{shot.stamp.label}</span>
            </div>
          </div>
        )}

        {/* a soft fade so the footer reads over trees and buildings */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px]"
          style={{ opacity: 1 - endIn, background: 'linear-gradient(to bottom, rgb(228 233 239 / 0), rgb(228 233 239 / 0.92) 60%)' }}
        />
        {/* brand + honesty line */}
        <div className="absolute inset-x-[48px] bottom-[34px] flex items-center justify-between text-[22px]" style={{ opacity: 1 - endIn }}>
          <span className="flex items-center gap-3 font-semibold">
            <Logo size={36} />
            <span>
              Swalpa<span className="text-[#a87400]">Adjust</span>
            </span>
          </span>
          <span className="text-[#4b5563]">Simulated traffic · same roads, same vehicles</span>
        </div>

        {/* end card */}
        {lastScene && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center text-center"
            style={{ opacity: endIn, background: 'rgb(244 246 249 / 0.94)' }}
          >
            <Logo size={84} />
            <div className="serif mt-8 text-[124px] leading-[0.95]">
              Swalpa adjust <em className="text-[#a87400]">maadi.</em>
            </div>
            <div className="mt-6 text-[44px] text-[#4b5563]">A few seconds of patience.</div>
            <div className="mt-12 rounded-full bg-[#111827] px-9 py-4 text-[32px] font-semibold text-white">Try all six yourself · link in the post</div>
            <div className="mt-6 text-[22px] text-[#6b7280]">All results are from a traffic simulation.</div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0" style={{ background: '#e4e9ef', opacity: veil }} />
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-[#e4e9ef]">
            <div className="flex flex-col items-center gap-4 text-[26px] text-[#4b5563]">
              <div className="h-[6px] w-[360px] overflow-hidden rounded-full bg-black/10">
                <div className="h-full bg-[#ffd21a]" style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              Warming up the traffic
            </div>
          </div>
        )}
      </div>

      {/* preview controls (never recorded) */}
      {!capture && (
        <div className="fixed inset-x-0 bottom-0 flex h-16 items-center gap-4 px-6 text-sm text-white/80">
          <button className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20" onClick={() => setPlaying((p) => !p)}>
            {playing ? 'Pause' : 'Play'} (space)
          </button>
          <button className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20" onClick={() => window.location.reload()}>
            Restart (r)
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#ffd21a]" style={{ width: `${(t / TEASER_DURATION) * 100}%` }} />
          </div>
          <span className="num w-[150px] text-right">
            {t.toFixed(1)} / {TEASER_DURATION} s · shot {idx + 1}/{CUES.length}
          </span>
        </div>
      )}
    </div>
  );
}
