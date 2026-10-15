// Checks every call-out of the box story against the simulation it points at.
// node scripts/dev/gridverify.ts [seed] [secs]
import { gridlock, GX, GY } from '../../src/sim/scenarios/gridlock.ts';
import type { Annotation } from '../../src/sim/scenarios/types.ts';
const seed = Number(process.argv[2] ?? 12);
const secs = Number(process.argv[3] ?? 150);
for (const share of [0, 1]) {
  const b = gridlock.build(seed, share);
  const w = b.world;
  w.run(gridlock.warmup - 60);
  w.measureSince = w.t;
  w.run(60);
  const byMode: Record<string, Record<string, number>> = {};
  const checks: Record<string, [number, number]> = {};
  const ok = (k: string, pass: boolean) => {
    checks[k] ??= [0, 0];
    checks[k][pass ? 0 : 1]++;
  };
  const pending: { id: number; t: number; s0: number; laneId: number }[] = [];
  let sum = { thru: 0, side: 0, inbox: 0, n: 0, frozenMax: 0 };
  for (let k = 0; k < secs; k++) {
    w.run(1);
    const s = b.sample();
    sum.thru += s.thru;
    sum.side += s.sideThru;
    sum.inbox += s.inbox;
    sum.n++;
    sum.frozenMax = Math.max(sum.frozenMax, s.frozen);
    for (const mode of ['problems', 'cost', 'fix', 'after']) {
      const out = b.annotate!(mode) as Annotation[];
      byMode[mode] ??= {};
      for (const a of out) {
        if (a.kind !== 'tag') continue;
        const key = a.text.replace(/\d+:\d+/, 'm:ss').replace(/\d+ (stuck|in the box)/, 'N $1');
        byMode[mode][key] = (byMode[mode][key] ?? 0) + 1;
        const vid = Number(a.id.slice(2));
        const v = w.vehicles.find((x) => x.id === vid);
        if (a.text === 'Stuck in the box') {
          // the tag sits inside the hatched square of a junction and the vehicle is stopped
          const inSquare = [-GX, GX].some((nx) => [-GY, GY].some((ny) => Math.abs(a.x - nx) < 7.4 + 2 && Math.abs(a.y - ny) < 7.4 + 2));
          ok('stuck: stopped inside a box', !!v && v.v < 0.6 && inSquare);
        }
        if (a.text.startsWith('Green light') && v) pending.push({ id: v.id, t: w.t, s0: v.s, laneId: v.lane.id });
        if (a.text.startsWith('Waits') && v) ok('waits: careful driver, stopped', v.civic && v.v < 0.5);
      }
    }
    // a "can't cross" vehicle should still be short of the box 3 s later
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (w.t - p.t < 3) continue;
      const v = w.vehicles.find((x) => x.id === p.id);
      ok('green but blocked: still not across 3 s later', !!v && v.lane.id === p.laneId);
      pending.splice(i, 1);
    }
  }
  console.log(`\n== share ${share} seed ${seed}: ${secs} s from t=${gridlock.warmup}`);
  console.log(
    `avg out/min ${(sum.thru / sum.n).toFixed(1)}, side-street across/min ${(sum.side / sum.n).toFixed(1)}, stuck in boxes ${(sum.inbox / sum.n).toFixed(1)}, longest gridlock ${sum.frozenMax.toFixed(0)} s`,
  );
  for (const [m, t] of Object.entries(byMode))
    console.log(
      `  ${m}: ${
        Object.entries(t)
          .map(([k, n]) => `"${k}" ${n}s`)
          .join(', ') || '(nothing)'
      }`,
    );
  for (const [k, [p, f]] of Object.entries(checks)) console.log(`  check ${k}: ${p} pass, ${f} fail`);
}
