// Civic vehicles stopped in a box with a full exit: where are they and how long do they stay?
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
const seed = Number(process.argv[2] ?? 12);
const b = gridlock.build(seed, 1);
const w = b.world;
w.run(gridlock.warmup);
const conn = w.lanes.filter((l) => l.connector);
const stuckSince = new Map<number, number>();
const durations: number[] = [];
const where: Record<string, number> = {};
for (let k = 0; k < 300 * 30; k++) {
  w.step();
  const now = new Set<number>();
  for (const c of conn)
    for (const v of c.vehicles) {
      if (v.v >= 0.6) continue;
      now.add(v.id);
      if (!stuckSince.has(v.id)) {
        stuckSince.set(v.id, w.t);
        const p = c.path.pose(v.s);
        const tag = `${Math.abs(p.h % Math.PI) < 0.5 || Math.abs(p.h % Math.PI) > 2.6 ? 'E-W' : 'N-S'} s=${v.s.toFixed(0)}/${c.length.toFixed(0)} type=${v.type}`;
        where[tag.split(' type')[0].replace(/s=\d+/, (m) => `s~${Math.round(Number(m.slice(2)) / 5) * 5}`)] =
          (where[tag.split(' type')[0].replace(/s=\d+/, (m) => `s~${Math.round(Number(m.slice(2)) / 5) * 5}`)] ?? 0) + 1;
      }
    }
  for (const [id, t0] of stuckSince)
    if (!now.has(id)) {
      durations.push(w.t - t0);
      stuckSince.delete(id);
    }
}
durations.sort((a, b) => a - b);
const q = (p: number) => durations[Math.floor(p * (durations.length - 1))]?.toFixed(1);
console.log(`civic stops inside boxes: ${durations.length} in 300 s; duration median ${q(0.5)} s, p90 ${q(0.9)} s, max ${q(1)} s`);
console.log(where);
