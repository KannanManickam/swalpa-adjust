// Experiment: how strict should the civic exit-space check be? node scripts/dev/gridexp.ts <ahead> <feedAhead>
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
import type { Lane } from '../../src/sim/core/world.ts';
const ahead = Number(process.argv[2] ?? 2.5);
const feed = Number(process.argv[3] ?? 1.5);
let tot = { box: 0, thru: 0, trip: 0, side: 0 };
const seeds = [12, 1, 2, 3];
for (const seed of seeds) {
  const b = gridlock.build(seed, 1);
  const w = b.world;
  w.exitSpace = (out: Lane) => {
    let free: number;
    let tailMoving = true;
    const tail = out.vehicles[0];
    if (tail) {
      free = tail.s - tail.len + tail.v * ahead;
      tailMoving = tail.v > 2.5;
    } else free = out.length;
    for (const f of out.feeds) for (const c of f.vehicles) free -= c.len + c.s0 + 0.5 - c.v * feed;
    return { free, tailMoving };
  };
  w.run(gridlock.warmup);
  w.measureSince = w.t;
  const conn = w.lanes.filter((l) => l.connector);
  let inBoxSec = 0;
  for (let k = 0; k < 300 * 30; k++) {
    w.step();
    if (k % 30) continue;
    for (const c of conn)
      for (const v of c.vehicles) {
        // footprint overlaps the hatched box (connector: 4.5 m apron, 14.8 m box, 4.5 m apron)
        if (v.v < 0.6 && v.s > 4.5 && v.s - v.len < 19.3) inBoxSec++;
      }
  }
  const s = b.sample();
  tot.box += inBoxSec / 300 / seeds.length;
  tot.thru += s.thru / seeds.length;
  tot.trip += s.trip / seeds.length;
}
console.log(`ahead ${ahead} feed ${feed}: stopped-in-box avg ${tot.box.toFixed(2)}, thru ${tot.thru.toFixed(1)}/min, trip ${tot.trip.toFixed(0)} s`);
