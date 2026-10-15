import { zipper } from '../../src/sim/scenarios/zipper.ts';
const b = zipper.build(11, 1);
const w = b.world as any;
const A = w.lanes[0],
  B = w.lanes[1];
let t = 0;
for (const T of [200, 260, 300, 301, 302]) {
  w.run(T - t);
  t = T;
  console.log(`t=${T} zipLast=${B.zipLast} seq=${B.zipSeq.map((v: any) => `${v.lane === B ? 'B' : 'A'}${v.id}${v.flags.fromB ? '*' : ''}`).join(' ')}`);
  const f = (v: any) =>
    `${v.type[0]}${v.id}@${v.s.toFixed(1)} v${v.v.toFixed(1)} a${v.acc.toFixed(1)} z${v.zipGap === Infinity ? '-' : v.zipGap.toFixed(1)}${v.lcActive ? '~' : ''}${v.flags.fromB ? '*' : ''}`;
  console.log(
    ' A:',
    A.vehicles
      .filter((v: any) => v.s > B.length - 50 && v.s < B.length + 10)
      .map(f)
      .join(' | '),
  );
  console.log(
    ' B:',
    B.vehicles
      .filter((v: any) => v.s > B.length - 50)
      .map(f)
      .join(' | '),
  );
}
