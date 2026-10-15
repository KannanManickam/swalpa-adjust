import { buildGrid } from '../../src/sim/scenarios/gridlock.ts';
const rate = Number(process.argv[2] ?? 0.12);
const gg = Number(process.argv[3] ?? 10);
for (const share of [0, 1]) {
  const row: string[] = [];
  for (const seed of [22, 5, 12]) {
    const g = buildGrid(seed, share, rate, 'g', gg, Number(process.argv[4] ?? 0.8));
    const w = g.w;
    w.run(60);
    const n0 = w.metrics.totalExited;
    let lockedAt = -1;
    for (let t = 0; t < 640; t += 5) {
      w.run(10);
      if (w.metrics.gridlocked && lockedAt < 0) lockedAt = Math.round(w.t);
    }
    const thr = (w.metrics.totalExited - n0) / 10;
    let inbox = 0;
    for (const n of g.nodes) for (const c of n.connectors) inbox += c.vehicles.length;
    let pend = 0;
    for (const s of w.sources) pend += s.queue.length;
    row.push(`thr ${thr.toFixed(0)} lock@${lockedAt} box ${inbox} veh ${w.vehicles.length} pend ${pend}`);
  }
  console.log(`rate ${rate} gate ${gg} share ${share}: ` + row.join(' | '));
}
