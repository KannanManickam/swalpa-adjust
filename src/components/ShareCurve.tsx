// "How many of us need to adjust?": the chapter's headline number at every slider position,
// from measured runs (src/data/curves.json, written by scripts/sharecurve.ts). Sits right under
// the slider with the same x scale, so the dot lines up with the slider's thumb.
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import curvesJson from '../data/curves.json';
import type { MetricDef } from '../sim/scenarios/types.ts';
import { compare, fmtValue } from '../lib/format.ts';
import { curveHeadline, type CurveWords, type ShareCurve as Curve } from '../lib/curve.ts';

const DATA = curvesJson as unknown as { seeds: number; secs: number; curves: Record<string, Curve> };
const THUMB = 11; // half the slider thumb: the plot spans exactly where the thumb's centre can go

/** Headroom above the highest run, and two or three round gridlines below it. */
function axis(maxVal: number) {
  const top = Math.max(maxVal, 1e-6) * 1.05;
  const raw = top / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const ticks: number[] = [];
  for (let v = step; v < top; v += step) ticks.push(v);
  return { top, ticks };
}

export function ShareCurve({
  id,
  metrics,
  words,
  label,
  share,
  onPick,
}: {
  id: string;
  metrics: MetricDef[];
  words: CurveWords;
  /** what the y axis measures, e.g. "queue behind the barricade" */
  label: string;
  share: number;
  onPick: (x: number) => void;
}) {
  const c = DATA.curves[id];
  const metric = metrics.find((m) => m.key === c?.metric);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0); // measured: the svg must never set the column's width itself
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!c || !metric) return null;

  const n = c.mean.length;
  const last = n - 1;
  const H = w < 420 ? 132 : 150;
  const top = 10;
  const base = H - 20;
  const { top: yTop, ticks } = axis(Math.max(...c.max, ...c.mean));
  // gridline labels go on the side where the curve is low, and are left out where they would touch it
  const left = metric.better === 'higher';
  const x = (i: number) => THUMB + (i / last) * (w - 2 * THUMB);
  const y = (v: number) => base - (v / yTop) * (base - top);
  const line = c.mean.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const band =
    c.max.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('') +
    c.min
      .map((v, i) => [i, v] as const)
      .reverse()
      .map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
      .join('') +
    'Z';
  const near = (v: number, t: number) => y(v) > y(t) - 22 && y(v) < y(t) + 7;
  const labelHits = (t: number) => near(c.mean[0], t) || c.mean.some((v, i) => Math.abs(x(i) - (left ? 0 : w)) < 44 && near(v, t)); // today's line spans the width
  const labelled = ticks.filter((t) => !labelHits(t)); // the highest one carries the unit
  const at = Math.round(share * last);
  const shown = hover ?? at;
  const idxAt = (e: MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(last, Math.round(((e.clientX - r.left - THUMB) / (r.width - 2 * THUMB)) * last)));
  };
  const val = (v: number) => {
    const s = fmtValue(metric, v);
    return !metric.unit ? s : metric.unit === '%' || metric.unit.startsWith('/') ? `${s}${metric.unit}` : `${s} ${metric.unit}`;
  };
  const change = compare(metric, c.mean[0], c.mean[shown]);
  const headline = curveHeadline(c, metric, words);
  const grad = `curve-grad-${id}`;

  return (
    <figure className="share-curve mt-7" aria-labelledby={`${id}-curve-head`}>
      <figcaption>
        <div className="panel-eyebrow">How many of us need to adjust?</div>
        <p id={`${id}-curve-head`} className="mt-1.5 text-[15px] font-medium leading-snug tracking-tight">
          {headline}
        </p>
      </figcaption>
      <div ref={wrap} className="mt-3 w-full min-w-0" style={{ height: H }}>
        {w > 0 && (
          <svg width="100%" height={H} viewBox={`0 0 ${w} ${H}`} className="block overflow-visible" aria-hidden="true">
            <defs>
              <linearGradient id={grad} gradientUnits="userSpaceOnUse" x1={x(0)} x2={x(last)} y1={0} y2={0}>
                <stop offset="0%" style={{ stopColor: 'var(--bad)' }} />
                <stop offset="50%" style={{ stopColor: 'var(--warn)' }} />
                <stop offset="100%" style={{ stopColor: 'var(--good)' }} />
              </linearGradient>
            </defs>
            <line x1={0} x2={w} y1={base} y2={base} className="curve-grid" />
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={w} y1={y(t)} y2={y(t)} className="curve-grid" />
                {labelled.includes(t) && (
                  <text x={left ? 0 : w} y={y(t) - 4} textAnchor={left ? 'start' : 'end'} className="curve-tick">
                    {t === labelled[labelled.length - 1] ? val(t) : fmtValue({ ...metric, digits: t % 1 ? 1 : 0 }, t)}
                  </text>
                )}
              </g>
            ))}
            <path d={band} className="curve-band" />
            <line x1={x(0)} x2={x(last)} y1={y(c.mean[0])} y2={y(c.mean[0])} className="curve-today" />
            <path d={line} fill="none" stroke={`url(#${grad})`} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null && hover !== at && <line x1={x(hover)} x2={x(hover)} y1={top} y2={base} className="curve-hover" />}
            <line x1={x(at)} x2={x(at)} y1={y(c.mean[at])} y2={base} className="curve-guide" />
            <circle cx={x(0)} cy={y(c.mean[0])} r={4.5} className="curve-end" style={{ fill: 'var(--bad)' }} />
            <circle cx={x(last)} cy={y(c.mean[last])} r={4.5} className="curve-end" style={{ fill: 'var(--good)' }} />
            {hover !== null && hover !== at && <circle cx={x(hover)} cy={y(c.mean[hover])} r={4} className="curve-ghost" />}
            <circle cx={x(at)} cy={y(c.mean[at])} r={6} className="curve-dot" />
            {(['nobody', 'half', 'everybody'] as const).map((l, k) => (
              <text
                key={l}
                x={x((k * last) / 2)}
                y={H - 4}
                className="curve-tick"
                textAnchor={k === 0 ? 'start' : k === 1 ? 'middle' : 'end'}
                dx={k === 0 ? -THUMB : k === 2 ? THUMB : 0}
              >
                {l}
              </text>
            ))}
            <rect
              x={0}
              y={0}
              width={w}
              height={base}
              fill="transparent"
              className="cursor-pointer"
              onPointerMove={(e) => e.pointerType === 'mouse' && setHover(idxAt(e))}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => onPick(idxAt(e) / last)}
            />
          </svg>
        )}
      </div>
      <div className="curve-key mt-2">
        <div>
          <span className="curve-key-label">
            <i style={{ background: 'var(--bad)' }} /> Today
          </span>
          <span className="num">{val(c.mean[0])}</span>
        </div>
        <div className="text-center">
          <span className="curve-key-label justify-center">
            <i className="is-dot" /> {Math.round((shown / last) * 100)}% adjust
          </span>
          <span className="num">
            {val(c.mean[shown])}
            {shown > 0 && change.good !== null && (
              <span className={`curve-change ${change.good ? 'text-[var(--good)]' : 'text-[var(--bad)]'}`}>{change.text}</span>
            )}
          </span>
        </div>
        <div className="text-right">
          <span className="curve-key-label justify-end">
            <i style={{ background: 'var(--good)' }} /> Everybody
          </span>
          <span className="num">{val(c.mean[last])}</span>
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-[var(--ink-3)]">
        {label[0].toUpperCase() + label.slice(1)} · average of {DATA.seeds} simulated runs at every setting · band: lowest to highest run
      </p>
      {/* a table can't shrink to sr-only's 1px, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>{metric.label} by share who adjust, measured</caption>
          <thead>
            <tr>
              <th>Share</th>
              <th>Average</th>
              <th>Lowest run</th>
              <th>Highest run</th>
            </tr>
          </thead>
          <tbody>
            {c.mean.map((v, i) =>
              i % 2 ? null : (
                <tr key={i}>
                  <td>{Math.round((i / last) * 100)}%</td>
                  <td>{val(v)}</td>
                  <td>{val(c.min[i])}</td>
                  <td>{val(c.max[i])}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
