// Free left, status quo: seconds in which a straight-goer plugs the kerb lane at red with left-turners stuck behind
import { freeLeft } from '../../src/sim/scenarios/freeLeft.ts';
for (const seed of [13, 1, 2, 3]) {
  const b = freeLeft.build(seed, 0);
  const w = b.world;
  w.run(freeLeft.warmup);
  const kerbs = w.lanes.filter((l) => l.moves?.L?.legal);
  const t: Record<string, number> = {};
  for (let k = 0; k < 300; k++) {
    w.run(1);
    for (const l of kerbs) {
      const p = l.path.pose(0);
      const name = p.x < -50 ? 'W' : p.x > 50 ? 'E' : p.y < -50 ? 'N' : 'S';
      const f = l.vehicles[l.vehicles.length - 1];
      if (!f || f.moves[0] !== 'S' || f.v > 0.5 || l.length - f.s > 6) continue;
      const lefts = l.vehicles.filter((v) => v !== f && v.moves[0] === 'L' && v.v < 0.5).length;
      if (lefts) t[name] = (t[name] ?? 0) + 1;
    }
  }
  console.log(`seed ${seed}: ${JSON.stringify(t)} (of 300 s)`);
}
