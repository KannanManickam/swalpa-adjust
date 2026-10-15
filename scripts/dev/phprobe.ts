// Phantom jams: where are the stopped clusters and how do they move? node scripts/dev/phprobe.ts [share] [seed]
import { phantom } from '../../src/sim/scenarios/phantom.ts';
const share = Number(process.argv[2] ?? 0);
const seed = Number(process.argv[3] ?? 14);
const b = phantom.build(seed, share);
const w = b.world;
w.run(phantom.warmup);
for (let k = 0; k < Number(process.argv[4] ?? 24); k++) {
  w.run(5);
  // stopped/slow vehicles binned by x (all lanes) in 10 m bins over the 440 m loop
  const bins = new Array(44).fill(0);
  for (const v of w.vehicles) {
    if (v.v > 2) continue;
    const x = v.pose().x;
    bins[Math.max(0, Math.min(43, Math.floor((x + 220) / 10)))]++;
  }
  const s = b.sample();
  console.log(
    `t=${w.t.toFixed(0).padStart(4)} ${bins.map((n) => (n === 0 ? '.' : n < 3 ? '-' : n < 6 ? '=' : '#')).join('')}  spd ${s.speed.toFixed(0)} stop ${s.stopped.toFixed(0)}% brakes ${s.brakes.toFixed(1)} lcs ${s.lcs.toFixed(0)}`,
  );
}
