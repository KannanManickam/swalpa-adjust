// How full are the exit lanes beyond the junctions? (status quo vs careful), metres of queue per lane
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
for (const share of [0, 1]) {
  const b = gridlock.build(12, share);
  const w = b.world;
  w.run(gridlock.warmup);
  const out: Record<string, number[]> = {};
  for (let k = 0; k < 60; k++) {
    w.run(1);
    for (const l of w.lanes) {
      if (!l.exit) continue;
      const p0 = l.path.pose(0);
      const p1 = l.path.pose(l.length);
      const side = Math.abs(p1.y - p0.y) > Math.abs(p1.x - p0.x);
      const key = `${side ? 'side' : 'main'} exit ${side ? (p1.y > 0 ? 'S' : 'N') : p1.x > 0 ? 'E' : 'W'}`;
      const occ = l.vehicles.reduce((a, v) => a + v.len + 1.5, 0) / l.length;
      (out[key] ??= []).push(occ);
    }
  }
  console.log(
    `share ${share}:`,
    Object.entries(out)
      .map(([k, v]) => `${k} ${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100)}% full`)
      .join(', '),
  );
}
