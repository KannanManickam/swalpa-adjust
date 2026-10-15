// What the box scenario does over time: node scripts/dev/gridprobe.ts [share] [seed] [secs]
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
const share = Number(process.argv[2] ?? 0);
const seed = Number(process.argv[3] ?? 12);
const secs = Number(process.argv[4] ?? 240);
const b = gridlock.build(seed, share);
const w = b.world;
let t0 = 0;
for (let t = 0; t < gridlock.warmup + secs; t += 20) {
  w.run(20);
  const s = b.sample();
  const conn = w.lanes.filter((l) => l.connector);
  let inbox = 0;
  for (const c of conn) for (const v of c.vehicles) if (v.v < 0.6) inbox++;
  if (w.t >= gridlock.warmup - 1 || t % 60 === 0)
    console.log(
      `t=${w.t.toFixed(0).padStart(4)} veh=${String(w.vehicles.length).padStart(3)} inbox=${String(inbox).padStart(2)} frozen=${s.frozen.toFixed(0).padStart(3)} thru=${s.thru.toFixed(1).padStart(5)} trip=${s.trip.toFixed(0).padStart(4)} stopped=${w.metrics.stoppedNow}`,
    );
  void t0;
}
