// The headline numbers published about each habit (habit cards, teaser, posts): nobody adjusting
// vs everybody adjusting, read from the measured curves in curves.json (scripts/sharecurve.ts),
// so the cards, the charts and the teaser can never disagree.
import curves from './curves.json' with { type: 'json' };
import { CHAPTERS } from './chapters.ts';
import { compare } from '../lib/format.ts';

type Curves = { seeds: number; secs: number; curves: Record<string, { mean: number[] }> };
const DATA = curves as unknown as Curves;

export interface Result {
  today: number;
  fix: number;
  /** "83% shorter", "5.6× more", "none at all" */
  change: string;
  /** runs averaged per number */
  runs: number;
}

export function resultOf(id: string): Result {
  const c = DATA.curves[id];
  const r = CHAPTERS.find((x) => x.id === id)!.result;
  const today = c.mean[0];
  const fix = c.mean[c.mean.length - 1];
  const change = compare({ key: id, label: r.label, unit: r.unit, better: r.better, time: r.time, down: r.down, up: r.up }, today, fix).text;
  return { today, fix, change, runs: DATA.seeds };
}
