// Free left, status quo: share of seconds where at least one approach (or W+N) shows a plugged free left with victims
import { freeLeft } from '../../src/sim/scenarios/freeLeft.ts';
for (const seed of [13, 1, 2]) {
  const b = freeLeft.build(seed, 0);
  const w = b.world;
  w.run(freeLeft.warmup);
  const kerbs = w.lanes.filter((l) => l.moves?.L?.legal);
  let any = 0,
    wn = 0,
    anyBlock = 0;
  for (let k = 0; k < 300; k++) {
    w.run(1);
    const hit: string[] = [];
    let blk = false;
    for (const l of kerbs) {
      const p = l.path.pose(0);
      const name = p.x < -50 ? 'W' : p.x > 50 ? 'E' : p.y < -50 ? 'N' : 'S';
      const f = l.vehicles[l.vehicles.length - 1];
      if (!f || f.moves[0] !== 'S' || f.v > 0.5 || l.length - f.s > 6) continue;
      blk = true;
      if (l.vehicles.some((v) => v !== f && v.moves[0] === 'L' && v.v < 0.5)) hit.push(name);
    }
    if (hit.length) any++;
    if (hit.includes('W') || hit.includes('N')) wn++;
    if (blk) anyBlock++;
  }
  console.log(`seed ${seed}: any approach ${Math.round(any / 3)}%, W or N ${Math.round(wn / 3)}%, any plugged (victims or not) ${Math.round(anyBlock / 3)}%`);
}
