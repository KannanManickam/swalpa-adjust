// The landing view: the headline beside one live city, shown either as it is today or with
// everyone waiting for room. Same stage card and Today / Swalpa adjust idea as the six chapters.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SimStage, type SimStageHandle } from './SimStage.tsx';
import { ArrowDown } from './icons.tsx';
import { useTheme } from '../lib/theme.tsx';

type World = 'a' | 'b';
const VIEWS: Record<World, { name: string; cls: string; line: string }> = {
  a: { name: 'Today', cls: 'is-today', line: 'Drivers enter the junction on green, room or not.' },
  b: { name: 'Swalpa adjust', cls: 'is-fix', line: 'Drivers wait behind the line until there is room.' },
};
const CYCLE = 7; // seconds per view until someone picks one
const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  const { theme } = useTheme();
  const day = theme === 'day';
  const sim = useRef<SimStageHandle>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<World>('a');
  const [auto, setAuto] = useState(true);
  const [m, setM] = useState<{ a: Record<string, number>; b: Record<string, number> } | null>(null);
  const placed = useRef(false);

  // the camera and the call-outs follow the chosen view; keep the switch at the top clear
  useEffect(() => {
    const st = sim.current?.stage();
    if (!st || !ready) return;
    const frame = (dur: number) => {
      const H = cardRef.current?.clientHeight || 1;
      const top = Math.min(0.32, ((topRef.current?.offsetTop ?? 0) + (topRef.current?.offsetHeight ?? 0) + 34) / H);
      st.setFocus({ world: view, top }, dur);
    };
    frame(placed.current ? 1.4 : 0);
    st.setAnnotations(view === 'a' ? 'cost' : 'after');
    placed.current = true;
    const ro = new ResizeObserver(() => frame(0));
    if (cardRef.current) ro.observe(cardRef.current);
    return () => ro.disconnect();
  }, [view, ready]);

  // until someone picks a view, alternate between the two
  useEffect(() => {
    if (!auto || !ready) return;
    const id = setInterval(() => setView((v) => (v === 'a' ? 'b' : 'a')), CYCLE * 1000);
    return () => clearInterval(id);
  }, [auto, ready]);

  const pick = (v: World) => {
    setAuto(false);
    setView(v);
  };

  return (
    <header className="mx-auto grid max-w-[1500px] items-center gap-8 px-4 pb-14 pt-[76px] md:px-8 min-[900px]:min-h-[100svh] min-[900px]:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] min-[900px]:gap-8 min-[900px]:pb-10 min-[900px]:pt-24 lg:gap-12">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease, delay: 0.1 }}>
        <div className="eyebrow !text-[var(--color-ink-2)]">Bengaluru · an interactive experiment</div>
        <h1 className="mt-4 leading-[0.92]">
          <span className="serif block text-[3.4rem] sm:text-[4.6rem] min-[900px]:text-[clamp(3.2rem,5.4vw,6rem)]">
            Swalpa adjust <em className="text-[var(--brand-ink)]">maadi.</em>
          </span>
          <span className="kn mt-2 block text-xl text-[var(--color-ink-2)] md:text-2xl">ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ · “adjust a little”</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-[1.05rem] leading-relaxed text-[var(--color-ink-2)] md:text-lg">
          Six everyday habits jam our roads. Fixing them takes <span className="font-medium text-[var(--color-ink)]">a few seconds of patience</span>.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#habits" className="btn btn-primary">
            Explore the six habits <ArrowDown size={16} />
          </a>
          <a href="#numbers" className="btn btn-ghost">
            Why it matters
          </a>
        </div>
      </motion.div>

      {/* the city: same road, same traffic, two ways of driving */}
      <motion.div
        className={`story-card relative overflow-hidden rounded-[28px] border ${day ? 'is-day' : ''} order-first min-[900px]:order-none`}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, ease, delay: 0.25 }}
      >
        <div ref={cardRef}>
          <SimStage
            ref={sim}
            scenario="hero"
            mode="split"
            civicShare={1}
            seed={5}
            speedMul={1.5}
            persistent
            theme={theme}
            onReady={() => setReady(true)}
            onMetrics={(a, b) => setM({ a, b })}
            className="hero-stage h-[52svh] min-h-[340px] w-full min-[900px]:h-[min(68svh,700px)]"
          >
            <div ref={topRef} className="pointer-events-none absolute inset-x-0 top-4 z-10 flex flex-col items-center gap-2 px-4">
              <div className="hero-switch pointer-events-auto" role="tablist" aria-label="Which road to show">
                {(['a', 'b'] as World[]).map((w) => (
                  <button key={w} role="tab" aria-selected={view === w} className={VIEWS[w].cls} onClick={() => pick(w)}>
                    <span className="dot" />
                    {VIEWS[w].name}
                    {auto && view === w && ready && <span key={`${w}${view}`} className="auto-progress" style={{ animationDuration: `${CYCLE}s` }} />}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={view}
                  className="hero-line"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.25 }}
                >
                  {VIEWS[view].line}
                </motion.div>
              </AnimatePresence>
            </div>
          </SimStage>
        </div>
        {/* live numbers for both roads; tap one to look at it */}
        <div className="story-panel grid grid-cols-2 gap-2 p-3 md:p-4">
          {(['a', 'b'] as World[]).map((w) => (
            <button key={w} onClick={() => pick(w)} aria-pressed={view === w} className="live-col">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: w === 'a' ? 'var(--bad)' : 'var(--good)' }}>
                {VIEWS[w].name}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <span>
                  <span className="num block text-[1.9rem] leading-none">{m ? Math.round(m[w].thru) : '—'}</span>
                  <span className="mt-1 block text-[12px] leading-tight text-[var(--ink-3)]">vehicles out a minute</span>
                </span>
                <span>
                  <span className="num block text-[1.9rem] leading-none">{m ? Math.round(m[w].inbox) : '—'}</span>
                  <span className="mt-1 block text-[12px] leading-tight text-[var(--ink-3)]">stuck in a junction</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </header>
  );
}
