// Records the order (by lane of origin) in which vehicles pass the merge point.
// node scripts/dev/zipalt.ts [share] [seed]
import { zipper } from '../../src/sim/scenarios/zipper.ts';
const share = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 11);
const b = zipper.build(seed, share);
const w = b.world;
w.run(zipper.warmup);
const A = w.lanes[0];
const B = w.lanes[1];
const line = B.length - 3;
const seen = new Set<number>();
let order = '';
let contested = 0; // passes where the other lane had a vehicle waiting within 25 m
let switched = 0;
for (let k = 0; k < 30 * 240; k++) {
  w.step();
  for (const v of A.vehicles) {
    if (v.flags.bg || seen.has(v.id) || v.s < line) continue;
    seen.add(v.id);
    const o = v.flags.origin === 1 ? 'o' : 'b';
    // was the other lane waiting?
    const otherWaiting =
      o === 'b' ? B.vehicles.some((x) => x.s > B.length - 25) : A.vehicles.some((x) => !seen.has(x.id) && x.s > line - 25 && x.flags.origin !== 1);
    if (otherWaiting && order.length) {
      contested++;
      if (order[order.length - 1] !== o) switched++;
    }
    order += o;
  }
}
const runs = order.match(/(b+|o+)/g) ?? [];
const hist: Record<number, number> = {};
for (const r of runs) hist[r.length] = (hist[r.length] ?? 0) + 1;
console.log(
  `share ${share} seed ${seed}: ${order.length} passed in 240 s; alternation when contested: ${contested ? Math.round((switched / contested) * 100) : 0}% (${switched}/${contested})`,
);
console.log('run lengths:', JSON.stringify(hist));
console.log(order.slice(0, 120));
const s = b.sample();
console.log(`queue ${s.queue.toFixed(0)} m, thru ${s.thru.toFixed(1)}/min`);
