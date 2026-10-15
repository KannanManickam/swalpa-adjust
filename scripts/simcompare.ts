// Multi-seed comparison of status quo (0% civic) vs swalpa adjust (100% civic).
// Usage: node scripts/simcompare.ts <scenarioId> [seconds] [seeds]
import { byId } from '../src/sim/scenarios/index.ts';

const def = byId(process.argv[2]);
const secs = Number(process.argv[3] ?? 300);
const nSeeds = Number(process.argv[4] ?? 4);
const shares = [0, 0.5, 1];
const acc: Record<number, Record<string, number>> = {};
for (const share of shares) {
  acc[share] = {};
  for (let seed = 1; seed <= nSeeds; seed++) {
    const b = def.build(seed, share);
    b.world.run(def.warmup);
    b.world.measureSince = b.world.t;
    const l0 = b.world.metrics.peopleSecLost;
    b.world.run(secs);
    const s = b.sample();
    s.lostWin = (b.world.metrics.peopleSecLost - l0) / 60;
    s.honks = b.world.metrics.honks;
    s.spd = b.world.metrics.meanSpeed * 3.6;
    for (const k in s) acc[share][k] = (acc[share][k] ?? 0) + s[k] / nSeeds;
  }
}
const keys = Object.keys(acc[0]);
console.log(`${def.id}: ${nSeeds} seeds, ${secs}s after ${def.warmup}s warmup`);
console.log('share'.padEnd(8) + keys.map((k) => k.padStart(13)).join(''));
for (const share of shares) console.log(String(share).padEnd(8) + keys.map((k) => acc[share][k].toFixed(1).padStart(13)).join(''));
