// Why are vehicles stopped inside junction boxes? node scripts/dev/gridwhy.ts [share] [seed]
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
const share = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 12);
const b = gridlock.build(seed, share);
const w = b.world;
w.run(gridlock.warmup);
const conn = w.lanes.filter((l) => l.connector);
const tally: Record<string, number> = {};
let samples = 0;
for (let k = 0; k < 300; k++) {
  w.run(1);
  samples++;
  for (const c of conn)
    for (const v of c.vehicles) {
      if (v.v >= 0.6) continue;
      const out = c.next[0];
      const tail = out.vehicles[0];
      const room = tail ? tail.s - tail.len : out.length;
      const why = room < v.len + 1.5 ? 'exit full' : 'waiting for cross traffic';
      const key = `${v.civic ? 'civic' : 'selfish'} · ${why} · entered ${v.s < 4 ? 'just' : 'deep'}`;
      tally[key] = (tally[key] ?? 0) + 1;
    }
}
console.log(`share ${share} seed ${seed}: avg stopped-in-box vehicles per second sample`);
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(`  ${(n / samples).toFixed(2).padStart(6)}  ${k}`);
