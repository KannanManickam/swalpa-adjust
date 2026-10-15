// "How many of us need to adjust?": reads a measured share curve (src/data/curves.json,
// written by scripts/sharecurve.ts) and says in one line what shape it has.
import type { MetricDef } from '../sim/scenarios/types.ts';
import { compare } from './format.ts';

export interface ShareCurve {
  metric: string;
  better: 'lower' | 'higher';
  warmup: number;
  /** average over seeds at each share (0, 0.05, … 1) */
  mean: number[];
  min: number[];
  max: number[];
}

/** How a chapter talks about its curve. */
export interface CurveWords {
  /** "drivers zip": "little changes until about 7 in 10 drivers zip" */
  who: string;
  /** "drivers zipping": "with 3 in 10 drivers zipping, …" */
  whoIng: string;
  /** the gain, e.g. "the queue is {already}{change}" */
  gain: string;
}

/** Share of the full (nobody → everybody) gain reached at each share. */
export function gainShare(c: ShareCurve): number[] {
  const v0 = c.mean[0];
  const v1 = c.mean[c.mean.length - 1];
  return c.mean.map((v) => (v1 === v0 ? 0 : (v - v0) / (v1 - v0)));
}

/** The mean at a whole number of tenths (k in 10). */
const atTenth = (c: ShareCurve, k: number) => c.mean[Math.round((k / 10) * (c.mean.length - 1))];

/**
 * One line from the data, anchored on what half of us adjusting achieves:
 * - 60%+ of the full gain at 5 in 10 → the earliest share with half the gain:
 *   "With 2 in 10 drivers zipping, the queue is already 56% shorter."
 * - under 30% of it at 5 in 10 → from where on every share has at least 30% of it:
 *   "This one needs most of us: little changes until about 7 in 10 drivers use the bay."
 * - otherwise → "It builds steadily: with 5 in 10 …, … 40% shorter."
 */
export function curveHeadline(c: ShareCurve, def: MetricDef, w: CurveWords): string {
  const g = gainShare(c);
  const tenth = (k: number) => g[Math.round((k / 10) * (g.length - 1))];
  const say = (k: number, already: boolean) =>
    w.gain.replace('{already}', already ? 'already ' : '').replace('{change}', compare(def, c.mean[0], atTenth(c, k)).text);
  if (!compare(def, c.mean[0], c.mean[c.mean.length - 1]).good) return 'In these runs, adjusting made little difference to this number.';
  if (tenth(5) >= 0.6) {
    let k = 1;
    while (tenth(k) < 0.5) k++;
    return `With ${k} in 10 ${w.whoIng}, ${say(k, true)}.`;
  }
  if (tenth(5) < 0.3) {
    let k = 10;
    while (k > 1 && tenth(k - 1) >= 0.3) k--;
    return `This one needs most of us: little changes until about ${k} in 10 ${w.who}.`;
  }
  return `It builds steadily: with 5 in 10 ${w.whoIng}, ${say(5, false)}.`;
}
