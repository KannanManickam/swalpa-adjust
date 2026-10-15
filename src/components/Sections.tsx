import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView } from 'motion/react';
import { STATS, type Stat, type Viz } from '../data/stats.ts';
import { CHAPTERS, type Chapter } from '../data/chapters.ts';
import { compare } from '../lib/format.ts';
import { ChevronDown, Close, External, HabitIcon, Menu, Moon, Sun } from './icons.tsx';
import { useTheme } from '../lib/theme.tsx';

const ease = [0.22, 1, 0.36, 1] as const;

// Everything on the page, in order. The six chapters sit under "Six habits".
const SECTIONS = [
  { id: 'numbers', label: 'The numbers' },
  { id: 'map', label: 'The map' },
  { id: 'habits', label: 'Six habits' },
  { id: 'five-seconds', label: 'Your few seconds' },
  { id: 'method', label: 'How it works' },
];

/** The section (and chapter) under the middle of the screen. */
function useWhereAmI() {
  const [at, setAt] = useState<{ section: string | null; chapter: string | null }>({ section: null, chapter: null });
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > 40);
      const mid = window.innerHeight * 0.45;
      const inside = (id: string) => {
        const r = document.getElementById(id)?.getBoundingClientRect();
        return !!r && r.top <= mid && r.bottom > mid;
      };
      const chapter = CHAPTERS.find((c) => inside(c.id))?.id ?? null;
      const section = chapter || inside('habits') ? 'habits' : (SECTIONS.find((x) => inside(x.id))?.id ?? null);
      setAt((p) => (p.section === section && p.chapter === chapter ? p : { section, chapter }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return { ...at, scrolled };
}

export function Nav() {
  const { section, chapter, scrolled } = useWhereAmI();
  const [habitsOpen, setHabitsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const habitsRef = useRef<HTMLDivElement>(null);
  // a mouse opens the dropdown on hover; the click that follows must not close it again
  const openedByHover = useRef(false);
  const navRef = useRef<HTMLElement>(null);
  const current = CHAPTERS.find((c) => c.id === chapter);

  // close popovers on outside click or Escape
  useEffect(() => {
    if (!habitsOpen && !menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (habitsOpen && !habitsRef.current?.contains(e.target as Node)) setHabitsOpen(false);
      if (menuOpen && !navRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setHabitsOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [habitsOpen, menuOpen]);

  const link = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-[13px] transition-colors ${on ? 'bg-[var(--press)] text-[var(--color-ink)]' : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'}`;

  return (
    <nav
      ref={navRef}
      aria-label="Sections"
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${scrolled || menuOpen ? 'border-b hairline bg-[var(--color-bg)]/85 backdrop-blur-xl' : ''}`}
    >
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 md:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Swalpa Adjust, back to top" onClick={() => setMenuOpen(false)}>
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">
            Swalpa<span className="text-[var(--brand-ink)]">Adjust</span>
          </span>
        </a>

        {/* wide screens: every section, with the six chapters in a dropdown */}
        <div className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((x) =>
            x.id === 'habits' ? (
              <div
                key={x.id}
                ref={habitsRef}
                className="relative"
                onMouseLeave={() => {
                  openedByHover.current = false;
                  setHabitsOpen(false);
                }}
              >
                <button
                  className={`${link(section === 'habits')} inline-flex items-center gap-1.5`}
                  aria-expanded={habitsOpen}
                  aria-haspopup="true"
                  onClick={() => {
                    if (openedByHover.current) openedByHover.current = false;
                    else setHabitsOpen((o) => !o);
                  }}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== 'mouse' || habitsOpen) return;
                    openedByHover.current = true;
                    setHabitsOpen(true);
                  }}
                >
                  {current ? (
                    <>
                      <span className="num text-[11px] opacity-60">{current.num}</span> {current.short}
                    </>
                  ) : (
                    x.label
                  )}
                  <ChevronDown size={13} className={`transition-transform ${habitsOpen ? 'rotate-180' : ''}`} />
                </button>
                {habitsOpen && (
                  <div className="absolute left-1/2 top-full -translate-x-1/2 pt-2">
                    <div className="card w-[270px] rounded-2xl p-1.5">
                      <a href="#habits" className="nav-item" onClick={() => setHabitsOpen(false)}>
                        <span className="num w-6 text-[11px] opacity-50">··</span> All six at a glance
                      </a>
                      {CHAPTERS.map((c) => (
                        <a key={c.id} href={`#${c.id}`} className={`nav-item ${chapter === c.id ? 'is-on' : ''}`} onClick={() => setHabitsOpen(false)}>
                          <span className="num w-6 text-[11px] opacity-50">{c.num}</span> {c.short}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <a key={x.id} href={`#${x.id}`} className={link(section === x.id)}>
                {x.label}
              </a>
            ),
          )}
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* a wrapper, because .icon-btn sets its own display */}
          <span className="lg:hidden">
            <button className="icon-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <Close size={18} /> : <Menu size={18} />}
            </button>
          </span>
        </div>
      </div>

      {/* phones and tablets: the same list, opened from the menu button */}
      {menuOpen && (
        <div className="max-h-[calc(100svh-64px)] overflow-y-auto border-t hairline bg-[var(--color-bg)] px-4 pb-5 pt-2 md:px-8 lg:hidden">
          {SECTIONS.map((x) => (
            <div key={x.id}>
              <a href={`#${x.id}`} className={`nav-item !text-[15px] ${section === x.id && !chapter ? 'is-on' : ''}`} onClick={() => setMenuOpen(false)}>
                {x.label}
              </a>
              {x.id === 'habits' && (
                <div className="mb-1 ml-3 grid grid-cols-2 gap-x-2 border-l hairline pl-2">
                  {CHAPTERS.map((c) => (
                    <a key={c.id} href={`#${c.id}`} className={`nav-item ${chapter === c.id ? 'is-on' : ''}`} onClick={() => setMenuOpen(false)}>
                      <span className="num w-6 text-[11px] opacity-50">{c.num}</span> {c.short}
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}

/** One sun/moon switch for the whole site (the chapters have the same switch). */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const day = theme === 'day';
  return (
    <button
      className={`icon-btn ${className}`}
      onClick={toggle}
      aria-label={day ? 'Switch to night view' : 'Switch to day view'}
      title={day ? 'Night view' : 'Day view'}
      data-theme-toggle
    >
      <motion.span
        key={theme}
        className="grid place-items-center"
        initial={{ opacity: 0, rotate: -60, scale: 0.6 }}
        animate={{ opacity: 1, rotate: 0, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {day ? <Moon size={17} /> : <Sun size={18} />}
      </motion.span>
    </button>
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="18" fill="#0f1422" stroke="rgba(255,255,255,0.12)" />
      <path d="M16 46 L30 18 M34 46 L48 18" stroke="#ffd21a" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="32" r="5" fill="#38e8a6" />
    </svg>
  );
}

function CountUp({ stat }: { stat: Stat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -12% 0px' });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const c = animate(0, stat.value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = v.toLocaleString('en-IN', { minimumFractionDigits: stat.decimals ?? 0, maximumFractionDigits: stat.decimals ?? 0 });
      },
    });
    return () => c.stop();
  }, [inView, stat]);
  return (
    <span className="num">
      {stat.prefix}
      <span ref={ref}>0</span>
      {stat.suffix}
    </span>
  );
}

export function Numbers() {
  return (
    <section id="numbers" className="relative scroll-mt-16 py-20 md:py-28" aria-labelledby="numbers-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.9, ease }}>
          <h2 id="numbers-title" className="serif text-[2.6rem] leading-[1.02] md:text-[4rem]">
            We can’t build our way out.
          </h2>
          <p className="mt-4 max-w-[620px] text-lg leading-relaxed text-[var(--color-ink-2)]">
            Traffic grows faster than roads can. The quickest fix is <span className="font-medium text-[var(--color-ink)]">how we use the lanes we have</span>.
          </p>
        </motion.div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATS.map((s, i) => (
            <motion.a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="card group flex flex-col rounded-3xl p-6"
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-5%' }}
              transition={{ duration: 0.8, ease, delay: (i % 3) * 0.06 }}
            >
              <div className="text-[3rem] leading-none tracking-tight md:text-[3.4rem]">
                <CountUp stat={s} />
              </div>
              <div className="mt-2 text-[1.05rem] font-medium leading-snug">{s.label}</div>
              <div className="mt-5 flex-1">
                <StatViz viz={s.viz} />
              </div>
              <div className="mt-5 flex items-center gap-1 text-[11px] text-[var(--color-ink-3)] group-hover:text-[var(--color-ink-2)]">
                {s.source} <External size={11} />
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Small pictures that make each number concrete. */
function StatViz({ viz }: { viz: Viz }) {
  if (viz.kind === 'bars') {
    const max = Math.max(...viz.rows.map((r) => r.value));
    return (
      <div>
        {viz.rows.map((r) => (
          <div key={r.label} className="mt-1.5 grid grid-cols-[86px_minmax(0,1fr)_auto] items-center gap-2.5 text-[12.5px]">
            <span className={r.hi ? 'font-semibold' : 'text-[var(--color-ink-3)]'}>{r.label}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-[var(--track)]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(r.value / max) * 100}%`, background: r.hi ? 'var(--selfish)' : 'var(--color-ink-3)', opacity: r.hi ? 1 : 0.45 }}
              />
            </span>
            <span className={`num min-w-[3.4rem] text-right ${r.hi ? 'font-semibold text-[var(--selfish)]' : 'text-[var(--color-ink-3)]'}`}>{r.text}</span>
          </div>
        ))}
        {viz.note && <div className="mt-2 text-[11px] text-[var(--color-ink-3)]">{viz.note}</div>}
      </div>
    );
  }
  if (viz.kind === 'days') {
    return (
      <div>
        <div className="grid grid-cols-7 gap-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, k) => (
            <div key={k} className="grid aspect-square place-items-center rounded-lg bg-[var(--selfish)] text-[12px] font-semibold text-white">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[var(--color-ink-3)]">{viz.note}</div>
      </div>
    );
  }
  if (viz.kind === 'people') {
    return (
      <div>
        <div className="flex items-end gap-3">
          {Array.from({ length: viz.total }, (_, k) => (
            <Person key={k} hi={k < viz.hi} />
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[var(--color-ink-3)]">{viz.note}</div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {viz.parts.map((p) => (
          <span key={p.label} style={{ width: `${p.share}%`, background: p.color }} />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--color-ink-2)]">
        {viz.parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <i className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.label} <span className="num text-[var(--color-ink-3)]">{p.share}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Person({ hi }: { hi: boolean }) {
  return (
    <svg width="30" height="52" viewBox="0 0 30 52" aria-hidden style={{ fill: hi ? 'var(--selfish)' : 'var(--color-ink-3)', opacity: hi ? 1 : 0.35 }}>
      <circle cx="15" cy="7" r="6" />
      <path d="M7 16h16a3 3 0 0 1 3 3v13h-5v18h-5V36h-2v14H9V32H4V19a3 3 0 0 1 3-3z" />
    </svg>
  );
}

export function HabitIndex() {
  return (
    <section id="habits" className="relative scroll-mt-16 py-16 md:py-20" aria-labelledby="habits-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <h2 id="habits-title" className="serif text-[2.4rem] leading-[1.02] md:text-[3.4rem]">
          The six habits
        </h2>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CHAPTERS.map((c, i) => (
            <motion.a
              key={c.id}
              href={`#${c.id}`}
              className="card group relative overflow-hidden rounded-3xl p-6"
              initial={{ opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-5%' }}
              transition={{ duration: 0.8, ease, delay: (i % 3) * 0.07 }}
            >
              <div className="flex items-center justify-between">
                <span className="num text-sm text-[var(--brand-ink)]">{c.num}</span>
                <span className="text-[var(--color-ink-3)] transition-colors group-hover:text-[var(--brand-ink)]">
                  <HabitIcon kind={c.icon} size={28} />
                </span>
              </div>
              <h3 className="serif mt-4 text-[1.9rem] leading-tight">{c.title}</h3>
              <ResultBars r={c.result} />
            </motion.a>
          ))}
        </div>
        <p className="mt-4 text-xs text-[var(--color-ink-3)]">Simulated: nobody adjusting vs everybody adjusting, averaged over three runs.</p>
      </div>
    </section>
  );
}

/** Nobody adjusts vs everybody adjusts, to scale. */
function ResultBars({ r }: { r: Chapter['result'] }) {
  const max = Math.max(r.today, r.fix, 1e-6);
  const c = compare({ key: '', label: r.label, unit: r.unit, better: r.better, time: r.time, down: r.down, up: r.up }, r.today, r.fix);
  const fmt = (v: number) =>
    `${v.toLocaleString('en-IN', { maximumFractionDigits: v < 10 && v % 1 ? 1 : 0 })}${r.unit ? (r.unit.startsWith('/') ? r.unit : ` ${r.unit}`) : ''}`;
  return (
    <div className="mt-5">
      <div className="num text-[1.7rem] font-semibold leading-none tracking-tight text-[var(--civic)]">{c.text}</div>
      <div className="mt-1.5 text-[13px] text-[var(--color-ink-2)]">{r.label}</div>
      <div className="mt-3">
        {(
          [
            ['Today', r.today, 'var(--selfish)'],
            ['Adjusted', r.fix, 'var(--civic)'],
          ] as const
        ).map(([label, v, color]) => (
          <div key={label} className="mt-1.5 grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 text-[12px]">
            <span className="text-[var(--color-ink-3)]">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: color }} />
            </span>
            <span className="num min-w-[4.2rem] text-right" style={{ color }}>
              {fmt(v)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
