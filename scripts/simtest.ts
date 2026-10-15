// Headless check that each scenario shows the intended difference.
// Usage: node scripts/simtest.ts [scenarioId] [seconds]
import { SCENARIOS } from '../src/sim/scenarios/index.ts';

const only = process.argv[2];
const secs = Number(process.argv[3] ?? 240);
for (const def of SCENARIOS) {
  if (only && def.id !== only) continue;
  const rows: string[] = [];
  const t0 = performance.now();
  const res: Record<string, Record<string, number>[]> = {};
  for (const share of [0, 0.5, 1]) {
    const b = def.build(42, share);
    const w = b.world;
    const snaps: Record<string, number>[] = [];
    const total = def.warmup + secs;
    for (let t = 0; t < total; t += 30) {
      w.run(30);
      const s = b.sample();
      snaps.push({
        t: Math.round(w.t),
        ...s,
        veh: w.vehicles.length,
        stop: w.metrics.stoppedNow,
        spd: w.metrics.meanSpeed * 3.6,
        grid: w.metrics.gridlocked ? 1 : 0,
      });
    }
    res[share] = snaps;
  }
  const ms = performance.now() - t0;
  console.log(`\n=== ${def.id}  (${ms.toFixed(0)} ms for 3 runs) ===`);
  const keys = Object.keys(res[0][0]);
  for (const share of [0, 0.5, 1]) {
    console.log(`-- civic share ${share}`);
    console.log(keys.map((k) => k.padStart(8)).join(''));
    for (const s of res[share]) console.log(keys.map((k) => (Number.isInteger(s[k]) ? String(s[k]) : s[k].toFixed(1)).padStart(8)).join(''));
  }
  void rows;
}
