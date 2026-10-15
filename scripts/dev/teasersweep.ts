// Finds a warm-up time at which a short teaser shot shows its call-out from the first frame.
//   node scripts/dev/teasersweep.ts <scenario> <seed> <fromWarmup> <anno> <world a|b> <shotSeconds> <speedMul> <regex>
import { byId } from '../../src/sim/scenarios/index.ts';
const [id, seedS, w0S, anno, world, durS, mulS, re] = process.argv.slice(2);
const def = byId(id);
const seed = Number(seedS);
const w0 = Number(w0S);
const win = Number(durS) * def.speed * Number(mulS); // sim seconds the shot covers
const pat = new RegExp(re);
const a = def.build(seed, 0);
const b = def.build(seed, 1);
a.world.run(w0);
b.world.run(w0);
const seen: boolean[] = [];
const dt = a.world.dt;
const total = 90; // look 90 sim seconds ahead
for (let k = 0; k < total / dt; k++) {
  a.world.step();
  b.world.step();
  const annos = (world === 'a' ? a : b).annotate!(anno);
  seen.push(annos.some((x) => (x.kind === 'tag' || x.kind === 'bracket') && pat.test(x.text)));
}
const per = Math.round(win / dt);
const best: { off: number; cov: number; first: boolean }[] = [];
for (let s = 0; s + per < seen.length; s += Math.round(0.5 / dt)) {
  const slice = seen.slice(s, s + per);
  const cov = slice.filter(Boolean).length / per;
  best.push({ off: s * dt, cov, first: slice.slice(0, Math.round(0.3 / dt)).every(Boolean) });
}
best.sort((x, y) => Number(y.first) - Number(x.first) || y.cov - x.cov);
console.log(`${id} seed ${seed}: shot covers ${win.toFixed(1)} sim s`);
for (const x of best.slice(0, 4)) console.log(`  warmup ${(w0 + x.off).toFixed(1)}: on screen ${Math.round(x.cov * 100)}%, from the first frame: ${x.first}`);
