import { zipper } from '../../src/sim/scenarios/zipper.ts';
const rate = Number(process.argv[2] ?? 0.44);
for (const share of [0, 1]) {
  const row: string[] = [];
  for (const seed of [11, 12]) {
    const b = zipper.build(seed, share);
    b.world.sources[0].rate = rate;
    const out: string[] = [];
    for (const T of [480, 600, 720]) {
      b.world.run(T - b.world.t);
      const s = b.sample();
      out.push(`${T}:${s.queue.toFixed(0)}m`);
    }
    row.push(out.join(' '));
  }
  console.log(`rate ${rate} share ${share}: ` + row.join(' | '));
}
