import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CAUSES, HOTSPOTS, LAKES, METRO, ORR, PARKS, QUEUES, RADIALS, proj, type Cause, type Hotspot, type LL } from '../data/hotspots.ts';
import { ArrowRight } from './icons.tsx';
import { useTheme } from '../lib/theme.tsx';

/** Catmull–Rom spline through projected points, as an SVG path. */
function smooth(pts: LL[], closed = false): string {
  const p = pts.map(([la, ln]) => proj(la, ln));
  if (closed) p.push(p[0], p[1], p[2]);
  const n = p.length;
  let d = `M${p[closed ? 1 : 0][0].toFixed(3)},${p[closed ? 1 : 0][1].toFixed(3)}`;
  const start = closed ? 1 : 0;
  const end = closed ? n - 2 : n - 1;
  for (let i = start; i < end; i++) {
    const p0 = p[Math.max(0, i - 1)];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[Math.min(n - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(3)},${c1[1].toFixed(3)} ${c2[0].toFixed(3)},${c2[1].toFixed(3)} ${p2[0].toFixed(3)},${p2[1].toFixed(3)}`;
  }
  return d;
}

const ease = [0.22, 1, 0.36, 1] as const;

const MAP = {
  day: {
    bg: '#eef2f6',
    grid: 'rgba(15,23,42,0.05)',
    glow: '#ffffff',
    park: '#cfe5c3',
    lake: '#cde3f5',
    lakeEdge: '#a7c8e6',
    road: '#c3ccd8',
    ring: '#97a3b4',
    flowRing: '#d97706',
    flowRoad: '#8a6a2f',
    label: '#6b7280',
    name: '#111827',
    nameDim: '#4b5563',
    halo: '#eef2f6',
    dotEdge: '#ffffff',
    sel: '#111827',
    sev: { 3: '#e2364a', 2: '#ea7a0c', 1: '#d4a106' } as Record<number, string>,
    off: 'rgba(15,23,42,0.1)',
    muted: 'rgba(15,23,42,0.26)',
    tagInk: true,
  },
  night: {
    bg: '#070a12',
    grid: 'rgba(255,255,255,0.035)',
    glow: '#1a2340',
    park: '#123222',
    lake: '#10233f',
    lakeEdge: '#1d3a66',
    road: '#3a4358',
    ring: '#505b74',
    flowRing: '#ffb02e',
    flowRoad: '#ffd9a0',
    label: '#6c768a',
    name: '#ffffff',
    nameDim: '#aab3c4',
    halo: '#070a12',
    dotEdge: '#05070d',
    sel: '#ffffff',
    sev: { 3: '#ff4d5e', 2: '#ffb02e', 1: '#facc15' } as Record<number, string>,
    off: 'rgba(255,255,255,0.1)',
    muted: 'rgba(255,255,255,0.28)',
    tagInk: false,
  },
};
const SEV_LABEL: Record<number, string> = { 3: 'Severe', 2: 'Heavy', 1: 'Recurring' };

export function HotspotMap() {
  const [sel, setSel] = useState<Hotspot>(HOTSPOTS[0]);
  const [filter, setFilter] = useState<Cause | null>(null);
  const paths = useMemo(
    () => ({
      orr: smooth(ORR, true),
      radials: RADIALS.map((r) => ({ name: r.name, d: smooth(r.pts) })),
      metro: METRO.map((m) => ({ ...m, d: smooth(m.pts) })),
    }),
    [],
  );
  const M = MAP[useTheme().theme];
  // how many chokepoints each cause shows up at, behaviour first
  const counts = useMemo(() => {
    const n = {} as Record<Cause, number>;
    for (const h of HOTSPOTS) for (const c of h.causes) n[c] = (n[c] ?? 0) + 1;
    const rows = (Object.keys(CAUSES) as Cause[]).map((c) => ({ c, n: n[c] ?? 0 }));
    const beh = rows.filter((r) => CAUSES[r.c].chapter).sort((a, b) => b.n - a.n);
    const other = rows.filter((r) => !CAUSES[r.c].chapter).sort((a, b) => b.n - a.n);
    return { beh, other, max: Math.max(...rows.map((r) => r.n)), withBehaviour: HOTSPOTS.filter((h) => h.causes.some((c) => CAUSES[c].chapter)).length };
  }, []);

  return (
    <section id="map" className="relative scroll-mt-16 py-24 md:py-28" aria-labelledby="map-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <div className="eyebrow">Where Bengaluru chokes</div>
        <motion.h2
          id="map-title"
          className="serif mt-4 max-w-[980px] text-[2.6rem] leading-[1.02] md:text-[4rem]"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease }}
        >
          Most jams start where lanes meet, and someone doesn’t wait.
        </motion.h2>
        <p className="mt-4 max-w-[640px] text-lg leading-relaxed text-[var(--color-ink-2)]">
          {HOTSPOTS.length} known chokepoints. At {HOTSPOTS.filter((h) => h.causes.some((c) => CAUSES[c].chapter)).length} of them, one of the six habits makes
          it worse.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <div className="card relative overflow-hidden rounded-[28px]" style={{ background: M.bg }}>
            <svg viewBox="-17 -21 43 40" className="block h-auto w-full" role="img" aria-label="Stylised map of Bengaluru with congestion hotspots">
              <defs>
                <radialGradient id="mapGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={M.glow} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={M.bg} stopOpacity="0" />
                </radialGradient>
                <pattern id="grid" width="2" height="2" patternUnits="userSpaceOnUse">
                  <path d="M2 0H0V2" fill="none" stroke={M.grid} strokeWidth="0.04" />
                </pattern>
                <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="0.35" />
                </filter>
              </defs>
              <rect x="-17" y="-21" width="43" height="40" fill="url(#grid)" />
              <circle cx="1" cy="-1" r="20" fill="url(#mapGlow)" />
              {PARKS.map((p) => {
                const [x, y] = proj(p.lat, p.lng);
                return <ellipse key={p.name} cx={x} cy={y} rx={p.rx} ry={p.ry} fill={M.park} opacity={0.9} />;
              })}
              {LAKES.map((l, i) => {
                const [x, y] = proj(l.lat, l.lng);
                return (
                  <ellipse
                    key={i}
                    cx={x}
                    cy={y}
                    rx={l.rx}
                    ry={l.ry}
                    transform={`rotate(${l.rot} ${x} ${y})`}
                    fill={M.lake}
                    stroke={M.lakeEdge}
                    strokeWidth={0.05}
                  />
                );
              })}
              {paths.radials.map((r) => (
                <path key={r.name} d={r.d} fill="none" stroke={M.road} strokeWidth={0.22} strokeLinecap="round" />
              ))}
              <path d={paths.orr} fill="none" stroke={M.ring} strokeWidth={0.42} />
              <path d={paths.orr} fill="none" stroke={M.flowRing} strokeOpacity={0.55} strokeWidth={0.12} strokeDasharray="0.6 1.4" className="flow-dash" />
              {paths.radials.map((r) => (
                <path
                  key={`f-${r.name}`}
                  d={r.d}
                  fill="none"
                  stroke={M.flowRoad}
                  strokeOpacity={0.28}
                  strokeWidth={0.08}
                  strokeDasharray="0.4 1.6"
                  className="flow-dash"
                />
              ))}
              {paths.metro.map((m) => (
                <path
                  key={m.name}
                  d={m.d}
                  fill="none"
                  stroke={m.color}
                  strokeWidth={0.16}
                  strokeOpacity={0.85}
                  strokeDasharray={m.dashed ? '0.35 0.3' : undefined}
                  strokeLinecap="round"
                />
              ))}
              <text
                x={proj(12.976, 77.593)[0]}
                y={proj(12.976, 77.593)[1] + 0.25}
                fontSize={0.62}
                fill={M.label}
                textAnchor="middle"
                fontFamily="Geist Mono Variable"
                letterSpacing="0.08"
              >
                CBD
              </text>
              {HOTSPOTS.map((h) => {
                const [x, y] = proj(h.lat, h.lng);
                const on = !filter || h.causes.includes(filter);
                const isSel = sel.name === h.name;
                const r = 0.38 + h.severity * 0.16;
                const color = M.sev[h.severity];
                return (
                  <g
                    key={h.name}
                    transform={`translate(${x} ${y})`}
                    style={{ cursor: 'pointer', opacity: on ? 1 : 0.18, transition: 'opacity .3s' }}
                    onMouseEnter={() => setSel(h)}
                    onClick={() => setSel(h)}
                    tabIndex={0}
                    role="button"
                    aria-label={h.name}
                    onFocus={() => setSel(h)}
                  >
                    {on && (
                      <circle r={r} fill="none" stroke={color} strokeWidth={0.08} className="hot-pulse" style={{ animationDelay: `${(x + y) * 0.07}s` }} />
                    )}
                    <circle r={r * 1.9} fill={color} opacity={0.18} filter="url(#soft)" />
                    <circle r={r * 0.62} fill={color} stroke={isSel ? M.sel : M.dotEdge} strokeWidth={isSel ? 0.14 : 0.08} />
                  </g>
                );
              })}
              {HOTSPOTS.map((h) => {
                const [x, y] = proj(h.lat, h.lng);
                const on = !filter || h.causes.includes(filter);
                const isSel = sel.name === h.name;
                if (!(isSel || h.severity === 3) || !on) return null;
                return (
                  <g key={`l-${h.name}`} transform={`translate(${x} ${y})`} pointerEvents="none">
                    <text
                      x={0.85}
                      y={0.22}
                      fontSize={0.62}
                      fill={isSel ? M.name : M.nameDim}
                      stroke={M.halo}
                      strokeWidth={0.16}
                      paintOrder="stroke"
                      fontFamily="Geist Variable"
                      fontWeight={isSel ? 600 : 500}
                    >
                      {h.name}
                    </text>
                    {isSel && h.figure && (
                      <text
                        x={0.85}
                        y={0.98}
                        fontSize={0.52}
                        fill={M.sev[h.severity]}
                        stroke={M.halo}
                        strokeWidth={0.14}
                        paintOrder="stroke"
                        fontFamily="Geist Mono Variable"
                        fontWeight={600}
                      >
                        {h.figure.value}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-x-3 gap-y-1 rounded-full bg-[var(--tag-bg)] px-3 py-1.5 text-[11px] text-[var(--color-ink-2)]">
              {[3, 2, 1].map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: M.sev[k] }} />
                  {SEV_LABEL[k]}
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-[var(--color-ink-3)]">
              {METRO.map((m) => (
                <span key={m.name} className="flex items-center gap-1.5">
                  <span className="inline-block h-[3px] w-4 rounded" style={{ background: m.color, opacity: m.dashed ? 0.6 : 1 }} />
                  {m.name}
                  {m.dashed ? ' (building)' : ''}
                </span>
              ))}
              <span className="ml-auto">Stylised, not to exact scale</span>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="card rounded-[28px] p-5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="eyebrow">What’s behind the jams</div>
                <div className="text-[13px] text-[var(--color-ink-2)]">
                  <span className="num text-[var(--color-ink)]">{counts.withBehaviour}</span> of {HOTSPOTS.length} involve a habit
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {[...counts.beh, ...counts.other].map(({ c, n }, i) => {
                  const cc = CAUSES[c];
                  const on = filter === c;
                  return (
                    <button
                      key={c}
                      onClick={() => setFilter(on ? null : c)}
                      aria-pressed={on}
                      className={`cause-row ${on ? 'is-on' : ''} ${i === counts.beh.length ? 'mt-3' : ''}`}
                    >
                      <span className={`truncate text-left ${cc.chapter ? '' : 'text-[var(--color-ink-3)]'}`}>{cc.label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-[var(--track)]">
                        <span
                          className="block h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${(n / counts.max) * 100}%`, background: cc.chapter ? cc.color : M.muted }}
                        />
                      </span>
                      <span className="num text-right text-[var(--color-ink-2)]">{n}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-ink-3)]">
                <span>Coloured: a habit this site simulates. Tap a bar to filter the map.</span>
                {filter && (
                  <button className="underline underline-offset-2 hover:text-[var(--color-ink)]" onClick={() => setFilter(null)}>
                    Show all
                  </button>
                )}
              </div>
            </div>
            <div className="card relative flex min-h-[300px] flex-1 flex-col overflow-hidden rounded-[28px] p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={sel.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease }}
                >
                  <div className="flex items-center gap-2">
                    {[1, 2, 3].map((k) => (
                      <span key={k} className="h-1.5 w-6 rounded-full" style={{ background: k <= sel.severity ? M.sev[sel.severity] : M.off }} />
                    ))}
                    <span className="eyebrow ml-1">{sel.severity === 3 ? 'Severe' : sel.severity === 2 ? 'Heavy' : 'Recurring'}</span>
                  </div>
                  <h3 className="serif mt-4 text-4xl">{sel.name}</h3>
                  {sel.figure && (
                    <div className="mt-3 flex items-baseline gap-3">
                      <span className="num text-[2.2rem] leading-none tracking-tight" style={{ color: M.sev[sel.severity] }}>
                        {sel.figure.value}
                      </span>
                      <span className="text-sm leading-snug text-[var(--color-ink-2)]">{sel.figure.label}</span>
                    </div>
                  )}
                  <p className="mt-3 leading-relaxed text-[var(--color-ink-2)]">{sel.note}</p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {sel.causes.map((c) => {
                      const cc = CAUSES[c];
                      return cc.chapter ? (
                        <a
                          key={c}
                          href={`#${cc.chapter}`}
                          className="group flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-[var(--press)]"
                          style={{ borderColor: `${cc.color}88`, color: M.tagInk ? M.name : cc.color }}
                        >
                          <span className="inline-block h-2 w-2 rounded-full" style={{ background: cc.color }} />
                          {cc.label}
                          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                        </a>
                      ) : (
                        <span key={c} className="rounded-full border border-[var(--chip-border)] px-3 py-1.5 text-sm text-[var(--color-ink-3)]">
                          {cc.label}
                        </span>
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>
              <p className="mt-auto pt-6 text-[11px] leading-relaxed text-[var(--color-ink-3)]">
                Compiled from Bengaluru Traffic Police statements and news reports, 2024–2026. Coloured tags link to the habit that makes it worse.
              </p>
            </div>
          </div>
        </div>

        {/* the longest queues, to scale */}
        <div className="card mt-4 rounded-[28px] p-5 md:p-7">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <div className="eyebrow">Longest queues on record</div>
            <div className="text-[12px] text-[var(--color-ink-3)]">Kilometres of standing traffic, as reported by Bengaluru Traffic Police and the press</div>
          </div>
          <div className="mt-4 space-y-2.5">
            {QUEUES.map((q) => {
              const spot = HOTSPOTS.find((h) => h.name === q.hotspot);
              return (
                <button
                  key={q.name}
                  className={`queue-row ${spot && sel.name === spot.name ? 'is-on' : ''}`}
                  onClick={() => spot && setSel(spot)}
                  disabled={!spot}
                  aria-label={`${q.name}: ${q.km} km`}
                >
                  <span className="text-left">
                    <span className="block text-[14px] font-medium leading-tight">{q.name}</span>
                    <span className="block text-[11.5px] leading-snug text-[var(--color-ink-3)]">{q.when}</span>
                  </span>
                  <span className="relative h-3.5 overflow-hidden rounded-full bg-[var(--track)]">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(q.km / 20) * 100}%`, background: M.sev[3], opacity: q.after ? 0.3 : 1 }}
                    />
                    {q.after && <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(q.after / 20) * 100}%`, background: M.sev[3] }} />}
                  </span>
                  <span className="num text-right text-[15px] font-semibold" style={{ color: M.sev[3] }}>
                    {q.after ? `${q.km} → ${q.after}` : q.km} km
                  </span>
                </button>
              );
            })}
          </div>
          <div className="queue-row !py-0 text-[10.5px] text-[var(--color-ink-3)]" aria-hidden>
            <span />
            <span className="flex justify-between">
              {[0, 5, 10, 15, 20].map((k) => (
                <span key={k}>{k} km</span>
              ))}
            </span>
            <span />
          </div>
        </div>
      </div>
    </section>
  );
}
