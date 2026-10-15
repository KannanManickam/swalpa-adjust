// Checks every call-out of the bus bay story against the simulation. node scripts/dev/bbverify.ts [seed] [secs]
import { busBay } from '../../src/sim/scenarios/busBay.ts';
import type { Annotation } from '../../src/sim/scenarios/types.ts';
const seed = Number(process.argv[2] ?? 15);
const secs = Number(process.argv[3] ?? 300);
for (const share of [0, 1]) {
  const b = busBay.build(seed, share);
  const w = b.world;
  w.run(busBay.warmup - 60);
  w.measureSince = w.t;
  w.run(60);
  const bay = w.lanes.find((l) => l.tag === 'bay')!;
  const tags: Record<string, Record<string, number>> = {};
  const checks: Record<string, [number, number]> = {};
  const ok = (k: string, pass: boolean) => (checks[k] ??= [0, 0])[pass ? 0 : 1]++;
  const sums: Record<string, number> = {};
  let n = 0;
  for (let k = 0; k < secs; k++) {
    w.run(1);
    const s = b.sample();
    for (const key in s) sums[key] = (sums[key] ?? 0) + s[key];
    n++;
    for (const mode of share ? ['fix', 'after'] : ['problems', 'cost']) {
      for (const a of b.annotate!(mode) as Annotation[]) {
        if (a.kind !== 'tag' && a.kind !== 'bracket') continue;
        const key = a.text.replace(/\d+/g, 'N');
        (tags[mode] ??= {})[key] = (tags[mode][key] ?? 0) + 1;
        if (a.kind !== 'tag') continue;
        const v = w.vehicles.find((x) => x.id === Number(a.id.slice(2)));
        if (a.text.includes('stopped in a running lane') || a.text === 'Lane blocked')
          ok('stopped in a running lane: dwelling, not in the bay', !!v && v.stopPlan?.state === 'dwell' && v.lane !== bay && v.v < 0.5);
        if (a.text === 'Swerves around it') ok('swerve: changing lanes away from a stopped bus/auto just ahead', !!v && v.lcActive && v.lcFrom !== bay);
        if (a.text.includes('pulled into the bay')) ok('in the bay: dwelling there', !!v && v.lane === bay && v.stopPlan?.state === 'dwell');
        if (a.text.startsWith('Let back in') && v) {
          const arr = v.lane.vehicles;
          const fol = arr[arr.indexOf(v) - 1];
          ok('let back in: leaving the bay without forcing, follower not braking hard', !v.forced && (!fol || fol.acc > -3));
        }
      }
    }
  }
  console.log(`\n== share ${share} seed ${seed}, ${secs} s`);
  console.log(
    '  averages: ' +
      Object.entries(sums)
        .map(([k, v]) => `${k} ${(v / n).toFixed(1)}`)
        .join(', '),
  );
  for (const [m, t] of Object.entries(tags))
    console.log(
      `  ${m}: ${Object.entries(t)
        .map(([k, c]) => `"${k}" ${c}s`)
        .join(', ')}`,
    );
  for (const [k, [p, f]] of Object.entries(checks)) console.log(`  check ${k}: ${p} pass, ${f} fail`);
}
