// Free left: what happens at the west (main-road) approach? node scripts/dev/flprobe.ts [seed] [secs]
import { freeLeft } from '../../src/sim/scenarios/freeLeft.ts';
const seed = Number(process.argv[2] ?? 13);
const secs = Number(process.argv[3] ?? 200);
for (const share of [0, 1]) {
  const b = freeLeft.build(seed, share);
  const w = b.world;
  w.run(freeLeft.warmup);
  // west approach kerb lane: the inbound lane with a legal L move whose path heads +x
  const kerbs = w.lanes.filter((l) => l.moves?.L?.legal);
  const west = kerbs.find((l) => l.path.pose(0).x < -50)!;
  let blockedSec = 0;
  let behind = 0;
  let maxBehind = 0;
  let redBlockedSec = 0;
  let kerbStraight = 0;
  let n = 0;
  for (let k = 0; k < secs; k++) {
    w.run(1);
    const sl = west.stopLines[0];
    const red = sl.signal.state(sl.group) !== 'G';
    const f = west.vehicles[west.vehicles.length - 1];
    const blocked = !!f && f.moves[0] === 'S' && f.v < 0.5 && west.length - f.s < 6;
    if (blocked) blockedSec++;
    if (blocked && red) redBlockedSec++;
    if (blocked) {
      const lefts = west.vehicles.filter((v) => v !== f && v.moves[0] === 'L' && v.v < 0.5).length;
      behind += lefts;
      maxBehind = Math.max(maxBehind, lefts);
    }
    kerbStraight += west.vehicles.filter((v) => v.moves[0] === 'S').length;
    n++;
  }
  const s = b.sample();
  console.log(
    `share ${share}: west kerb lane blocked by a straight-goer ${Math.round((blockedSec / n) * 100)}% of the time (${redBlockedSec} s during red); left-turners stuck behind: avg ${(behind / Math.max(1, blockedSec)).toFixed(1)}, max ${maxBehind}; straight-goers in the kerb lane avg ${(kerbStraight / n).toFixed(1)}`,
  );
  console.log(
    `   leftDelay ${s.leftDelay.toFixed(1)} s, straightDelay ${s.straightDelay.toFixed(1)} s, blocked ${s.blocked.toFixed(0)}%, thru ${s.thru.toFixed(0)}/min`,
  );
}
