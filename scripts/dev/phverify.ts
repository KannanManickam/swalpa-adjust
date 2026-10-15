// Checks every call-out of the lane & gap story against the simulation. node scripts/dev/phverify.ts [seed] [secs]
import { phantom } from '../../src/sim/scenarios/phantom.ts';
import type { Annotation } from '../../src/sim/scenarios/types.ts';
const seed = Number(process.argv[2] ?? 14);
const secs = Number(process.argv[3] ?? 240);
for (const share of [0, 1]) {
  const b = phantom.build(seed, share);
  const w = b.world;
  w.run(phantom.warmup);
  const tags: Record<string, Record<string, number>> = {};
  const checks: Record<string, [number, number]> = {};
  const ok = (k: string, pass: boolean) => (checks[k] ??= [0, 0])[pass ? 0 : 1]++;
  const follow: { id: number; lane: number; until: number; minAcc: number }[] = [];
  const waveC: { t: number; c: number }[] = [];
  const cutMin = new Map<number, number>();
  const sums = { speed: 0, stopped: 0, brakes: 0, lcs: 0, n: 0 };
  for (let k = 0; k < secs * 2; k++) {
    w.run(0.5);
    const s = b.sample();
    for (const key of ['speed', 'stopped', 'brakes', 'lcs'] as const) sums[key] += s[key];
    sums.n++;
    for (const mode of share ? ['fix', 'after'] : ['problems', 'wave']) {
      for (const a of b.annotate!(mode) as Annotation[]) {
        const key = a.kind === 'bracket' ? a.text.replace(/\d+/g, 'N') : a.kind === 'tag' ? a.text.replace(/\d+/g, 'N') : a.kind;
        (tags[mode] ??= {})[key] = (tags[mode][key] ?? 0) + 0.5;
        if (a.kind === 'bracket') {
          waveC.push({ t: w.t, c: (a.x0 + a.x1) / 2 });
          const n = w.vehicles.filter((v) => v.v < 1.5 && Math.abs(v.pose().x - (a.x0 + a.x1) / 2) <= (a.x1 - a.x0) / 2 + 1).length;
          ok('wave bracket covers >= 4 stopped vehicles', n >= 4);
          continue;
        }
        if (a.kind !== 'tag') continue;
        const v = w.vehicles.find((x) => x.id === Number(a.id.slice(2)));
        if (a.text.startsWith('Hops lanes')) ok('hop: careless driver changing lanes', !!v && !v.civic && (v.lcActive || v.lcCooldown > 0));
        if (a.text.startsWith('Brakes for the cut-in') && v) {
          const arr = v.lane.vehicles;
          const lead = arr[arr.indexOf(v) + 1] ?? arr[0];
          ok('cut-in: right behind a vehicle that is changing into its lane', !!lead && lead.lcActive);
          cutMin.set(v.id, Math.min(cutMin.get(v.id) ?? 0, v.acc));
        }
        if (a.text.startsWith('Holds its lane') && v) follow.push({ id: v.id, lane: v.lane.id, until: w.t + 10, minAcc: 0 });
        if (a.text.startsWith('Eases off') && v) ok('ease: gentle deceleration', v.acc < -0.2 && v.acc > -2.6);
      }
    }
    for (let i = follow.length - 1; i >= 0; i--) {
      const f = follow[i];
      const v = w.vehicles.find((x) => x.id === f.id);
      if (!v) continue;
      f.minAcc = Math.min(f.minAcc, v.acc);
      if (w.t >= f.until) {
        ok('holds its lane for the next 10 s without hard braking', v.lane.id === f.lane && f.minAcc > -4.5);
        follow.splice(i, 1);
      }
    }
  }
  for (const m of cutMin.values()) ok('cut-in: the tagged driver braked at 2.5 m/s² or more', m <= -2.5);
  // wave drift: least-squares slope of the bracket centre over continuous stretches
  let num = 0,
    den = 0;
  for (let i = 1; i < waveC.length; i++) {
    const dt = waveC[i].t - waveC[i - 1].t;
    const dc = waveC[i].c - waveC[i - 1].c;
    if (dt < 0.6 && Math.abs(dc) < 10) {
      num += dc;
      den += dt;
    }
  }
  console.log(`\n== share ${share} seed ${seed}, ${secs} s from t=${phantom.warmup}`);
  console.log(
    `avg speed ${(sums.speed / sums.n).toFixed(1)} km/h, at a standstill ${(sums.stopped / sums.n).toFixed(1)}%, hard brakes ${(sums.brakes / sums.n).toFixed(1)}/min, lane changes ${(sums.lcs / sums.n).toFixed(0)}/min`,
  );
  if (den) console.log(`wave bracket centre drifts ${((num / den) * 3.6).toFixed(1)} km/h (negative = backwards, against traffic)`);
  for (const [m, t] of Object.entries(tags))
    console.log(
      `  ${m}: ${Object.entries(t)
        .map(([k, n]) => `"${k}" ${n}s`)
        .join(', ')}`,
    );
  for (const [k, [p, f]] of Object.entries(checks)) console.log(`  check ${k}: ${p} pass, ${f} fail`);
}
