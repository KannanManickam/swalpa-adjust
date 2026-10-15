// For each pass, was it "fair"? Count passes where the same lane went twice while the other lane
// had a vehicle within 10 m of the merge point (i.e. clearly waiting its turn).
import { zipper } from '../../src/sim/scenarios/zipper.ts';
for (const seed of [11, 12, 13]) {
  const b = zipper.build(seed, 1);
  const w = b.world as any;
  w.run(zipper.warmup);
  const A = w.lanes[0],
    B = w.lanes[1];
  const line = B.length - 3;
  let last = '';
  let unfair = 0,
    fair = 0,
    free = 0;
  for (let k = 0; k < 30 * 240; k++) {
    w.step();
    for (const v of A.vehicles) {
      if (v.flags.bg || v.flags.zp2 || v.s < line) continue;
      v.flags.zp2 = 1;
      const o = v.flags.fromB ? 'o' : 'b';
      const otherWaiting =
        o === 'b' ? B.vehicles.some((x: any) => x.s > line - 10) : A.vehicles.some((x: any) => !x.flags.zp2 && !x.flags.fromB && x.s > line - 10);
      if (!otherWaiting) free++;
      else if (o === last) unfair++;
      else fair++;
      last = o;
    }
  }
  console.log(`seed ${seed}: took turns ${fair}, same lane twice while other waited ${unfair}, no one else waiting ${free}`);
}
