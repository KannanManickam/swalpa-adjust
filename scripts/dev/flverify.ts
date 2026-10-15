// Checks every call-out of the free-left story against the simulation. node scripts/dev/flverify.ts [seed] [secs]
import { freeLeft } from '../../src/sim/scenarios/freeLeft.ts';
import type { Annotation } from '../../src/sim/scenarios/types.ts';
const seed = Number(process.argv[2] ?? 13);
const secs = Number(process.argv[3] ?? 300);
for (const share of [0, 1]) {
  const b = freeLeft.build(seed, share);
  const w = b.world;
  w.run(freeLeft.warmup - 60);
  w.measureSince = w.t;
  w.run(60);
  const tags: Record<string, Record<string, number>> = {};
  const checks: Record<string, [number, number]> = {};
  const ok = (k: string, pass: boolean) => (checks[k] ??= [0, 0])[pass ? 0 : 1]++;
  const plugSec: boolean[] = [];
  const sums = { left: 0, straight: 0, blocked: 0, n: 0 };
  const lost0 = w.metrics.peopleSecLost;
  for (let k = 0; k < secs; k++) {
    for (let j = 0; j < 30; j++) {
      w.step();
    }
    const s = b.sample();
    sums.left += s.leftDelay;
    sums.straight += s.straightDelay;
    sums.blocked += s.blocked;
    sums.n++;
    let plugged = false;
    for (const mode of ['problems', 'cost', 'fix', 'after']) {
      for (const a of b.annotate!(mode) as Annotation[]) {
        if (a.kind !== 'tag') continue;
        const key = a.text.replace(/\d+/g, 'N');
        (tags[mode] ??= {})[key] = (tags[mode][key] ?? 0) + 1;
        const v = w.vehicles.find((x) => x.id === Number(a.id.slice(2)));
        const sl = v?.lane.stopLines[0];
        const isRed = !!sl && sl.signal.state(sl.group) !== 'G';
        if (mode === 'problems' && a.text.startsWith('Going straight')) {
          plugged = true;
          ok(
            'plug: straight-goer stopped in the free-left lane at red',
            !!v && v.moves[0] === 'S' && v.lane.index === 0 && !!v.lane.moves?.L?.legal && v.v < 0.5 && isRed,
          );
        }
        if (mode === 'problems' && a.text.startsWith('Turning left') && v) {
          const k2 = v.lane.vehicles;
          ok('victim: left-turner stopped right behind a straight-goer', v.moves[0] === 'L' && v.v < 0.5 && k2[k2.indexOf(v) + 1]?.moves[0] === 'S');
        }
        if (mode === 'fix' && a.text.startsWith('Turns left on red')) {
          // the label has a fixed id and moves between turners: find the vehicle it is pinned to
          const t = w.vehicles.find((x) => x.lane.connector && Math.hypot(x.pose().x - a.x, x.pose().y - a.y) < 0.5);
          const from = t && w.lanes.find((l) => l.moves?.L?.lane === t.lane);
          const fsl = from?.stopLines[0];
          ok('fix: left-turner moving through its turn while its approach is red', !!t && !!fsl && t.v > 2 && fsl.signal.state(fsl.group) !== 'G');
        }
        if (mode === 'fix' && a.text.startsWith('Going straight') && v)
          ok('fix: straight-goer waiting in a straight lane', v.lane.index > 0 && v.moves[0] === 'S' && v.v < 0.5);
      }
    }
    plugSec.push(plugged);
  }
  // 18-second windows (one zoomed step) in which a plug is labelled for at least 4 s
  let good = 0;
  let total = 0;
  for (let i = 0; i + 18 <= plugSec.length; i++) {
    total++;
    if (plugSec.slice(i, i + 18).filter(Boolean).length >= 4) good++;
  }
  console.log(`\n== share ${share} seed ${seed}, ${secs} s`);
  console.log(`people-minutes lost per minute ${((w.metrics.peopleSecLost - lost0) / 60 / (secs / 60)).toFixed(1)}`);
  console.log(
    `avg left-turn delay ${(sums.left / sums.n).toFixed(1)} s, straight delay ${(sums.straight / sums.n).toFixed(1)} s, free left blocked ${(sums.blocked / sums.n).toFixed(0)}% of the time`,
  );
  if (!share) console.log(`18-s windows showing a plugged free left for >= 4 s: ${Math.round((good / total) * 100)}%`);
  for (const [m, t] of Object.entries(tags))
    console.log(
      `  ${m}: ${Object.entries(t)
        .map(([k, n]) => `"${k}" ${n}s`)
        .join(', ')}`,
    );
  for (const [k, [p, f]] of Object.entries(checks)) console.log(`  check ${k}: ${p} pass, ${f} fail`);
}
