// Bus bay: who stops where, and what it does to the lane. node scripts/dev/bbprobe.ts [seed] [secs]
import { busBay } from '../../src/sim/scenarios/busBay.ts';
const seed = Number(process.argv[2] ?? 15);
const secs = Number(process.argv[3] ?? 300);
for (const share of [0, 1]) {
  const b = busBay.build(seed, share);
  const w = b.world;
  w.run(busBay.warmup);
  const bay = w.lanes.find((l) => l.tag === 'bay')!;
  const stops: Record<string, number> = {};
  let dwellInLane = 0,
    dwellInBay = 0,
    queueBehind = 0,
    qn = 0,
    maxQ = 0;
  const seen = new Set<number>();
  for (let k = 0; k < secs; k++) {
    w.run(1);
    for (const v of w.vehicles) {
      const p = v.stopPlan;
      if (!p || p.state !== 'dwell') continue;
      if (v.lane === bay) dwellInBay++;
      else {
        dwellInLane++;
        // stopped vehicles queued directly behind in the same lane
        const arr = v.lane.vehicles;
        let q = 0;
        for (let i = arr.indexOf(v) - 1; i >= 0 && arr[i].v < 1; i--) q++;
        queueBehind += q;
        qn++;
        maxQ = Math.max(maxQ, q);
      }
      if (!seen.has(v.id)) {
        seen.add(v.id);
        const key = `${v.type} in ${v.lane === bay ? 'bay' : `lane ${v.lane.index}`}`;
        stops[key] = (stops[key] ?? 0) + 1;
      }
    }
  }
  const s = b.sample();
  console.log(
    `share ${share}: stops ${JSON.stringify(stops)}; dwell-seconds in a running lane ${dwellInLane}, in the bay ${dwellInBay}; queue behind a stopped vehicle avg ${(queueBehind / Math.max(1, qn)).toFixed(1)}, max ${maxQ}`,
  );
  console.log(`   trip ${s.trip.toFixed(0)} s, blocked ${s.blocked.toFixed(0)}%, thru ${s.thru.toFixed(0)}/min, speed ${s.speed.toFixed(1)} km/h`);
}
