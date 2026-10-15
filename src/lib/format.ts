import type { MetricDef } from '../sim/scenarios/types.ts';

export function fmtValue(def: MetricDef, v: number | undefined): string {
  if (v === undefined || !Number.isFinite(v)) return '—';
  if (def.clock) {
    if (v <= 0) return '0:00';
    const m = Math.floor(v / 60);
    const s = Math.floor(v % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  const d = def.digits ?? (Math.abs(v) < 10 ? 1 : 0);
  return v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });
}

/** "2 min 44 s" / "44 s" */
export function duration(x: number): string {
  if (!Number.isFinite(x)) return '—';
  return x >= 60 ? `${Math.floor(x / 60)} min ${String(Math.round(x % 60)).padStart(2, '0')} s` : `${Math.round(x)} s`;
}

const times = (r: number) => `${r.toFixed(r >= 10 ? 0 : 1)}×`;

/**
 * Plain-language change from A (status quo) to B (swalpa adjust): "99% shorter",
 * "3.8× faster", "47% more", "none at all". Decreases are always percentages (never
 * "66× less"); times read as a speed-up.
 */
export function compare(def: MetricDef, a: number | undefined, b: number | undefined): { text: string; good: boolean | null; factor: number } {
  if (a === undefined || b === undefined || !Number.isFinite(a) || !Number.isFinite(b)) return { text: '—', good: null, factor: 1 };
  const lowerBetter = def.better === 'lower';
  const good = lowerBetter ? b < a : b > a;
  if (Math.abs(a - b) < 1e-6 || (Math.abs(a) < 0.05 && Math.abs(b) < 0.05)) return { text: 'same', good: null, factor: 1 };
  const down = def.down ?? 'lower';
  const up = def.up ?? 'higher';
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const factor = lo > 1e-4 ? hi / lo : 99;
  if (b < a) {
    if (def.time && b > 1e-4 && a / b >= 1.5) return { text: `${times(a / b)} faster`, good, factor };
    if (b <= 1e-4 || b / a < 0.005) return { text: def.zero ?? 'none at all', good, factor };
    const pct = Math.min(99, Math.round((1 - b / a) * 100));
    return { text: `${Math.max(1, pct)}% ${down}`, good, factor };
  }
  if (a <= 1e-4) return { text: lowerBetter ? 'new problem' : 'from zero', good, factor };
  if (def.time && b / a >= 1.5) return { text: `${times(b / a)} slower`, good, factor };
  if (b / a >= 2) return { text: `${times(b / a)} ${up}`, good, factor };
  return { text: `${Math.max(1, Math.round((b / a - 1) * 100))}% ${up}`, good, factor };
}
