import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
for (const share of [0, 1]) {
  const b = gridlock.build(12, share);
  const row: string[] = [];
  b.world.run(380);
  b.world.measureSince = b.world.t;
  for (let k = 0; k < 6; k++) {
    b.world.run(30);
    const s = b.sample();
    row.push(`t${Math.round(b.world.t)} thru ${s.thru.toFixed(0)} box ${s.inbox} frozen ${s.frozen.toFixed(0)}`);
  }
  console.log(`share ${share}: ` + row.join(' | '));
}
