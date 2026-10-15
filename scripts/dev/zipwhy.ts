// Find moments where the through lane sends 3 in a row while the ending lane is waiting close by.
import { zipper } from '../../src/sim/scenarios/zipper.ts';
const b = zipper.build(Number(process.argv[2] ?? 12), 1);
const w = b.world as any;
w.run(zipper.warmup);
const A = w.lanes[0],
  B = w.lanes[1];
const line = B.length - 3;
let run = 0,
  last = '',
  shown = 0;
const seen = new Set<number>();
for (let k = 0; k < 30 * 240 && shown < 3; k++) {
  w.step();
  for (const v of A.vehicles) {
    if (v.flags.bg || seen.has(v.id) || v.s < line) continue;
    seen.add(v.id);
    const o = v.flags.fromB ? 'o' : 'b';
    run = o === last ? run + 1 : 1;
    last = o;
    const bNear = B.vehicles.filter((x: any) => x.s > B.length - 20);
    if (o === 'b' && run >= 3 && bNear.length) {
      shown++;
      console.log(`t=${w.t.toFixed(1)} run=${run} passed b${v.id}; zipLast=${B.zipLast}`);
      console.log(
        '  seq:',
        B.zipSeq
          .map(
            (x: any) =>
              `${x.lane === B ? 'B' : x.flags.fromB ? 'A*' : 'A'}${x.id}@${x.s.toFixed(0)}:${x.v.toFixed(1)}${x.zipGap < 99 ? ' z' + x.zipGap.toFixed(1) : ''}${x.lcActive ? '~' : ''}`,
          )
          .join('  '),
      );
      console.log(
        '  B near end:',
        bNear
          .map(
            (x: any) =>
              `${x.type}${x.id}@${x.s.toFixed(1)} v${x.v.toFixed(1)} a${x.acc.toFixed(1)} civic=${x.civic} lcCool=${x.lcCooldown.toFixed(1)} need=${JSON.stringify(w.mandatoryNeed(x))}`,
          )
          .join(' | '),
      );
    }
  }
}
