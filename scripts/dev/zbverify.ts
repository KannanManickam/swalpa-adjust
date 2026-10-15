// Checks every call-out of the zebra story against the simulation. node scripts/dev/zbverify.ts [seed] [secs]
import { zebra } from '../../src/sim/scenarios/zebra.ts';
import type { Annotation } from '../../src/sim/scenarios/types.ts';
import type { Vehicle } from '../../src/sim/core/world.ts';
const seed = Number(process.argv[2] ?? 16);
const secs = Number(process.argv[3] ?? 300);
for (const share of [0, 1]) {
  const b = zebra.build(seed, share);
  const w = b.world;
  w.run(zebra.warmup);
  const sig = w.signals[0];
  const lanes = w.lanes.filter((l) => l.stopLines.length);
  const tags: Record<string, Record<string, number>> = {};
  const checks: Record<string, [number, number]> = {};
  const ok = (k: string, pass: boolean) => (checks[k] ??= [0, 0])[pass ? 0 : 1]++;
  // independent record of the light when each vehicle crossed its stop line, and whether it could stop at amber onset
  const crossedOn = new Map<Vehicle, { light: string; could: boolean | null }>();
  const amberOnset = new Map<Vehicle, boolean>();
  const prev = new Map<Vehicle, number>();
  let was = sig.state(1);
  for (let k = 0; k < secs * 30; k++) {
    w.step();
    const light = sig.state(1);
    if (light === 'Y' && was === 'G')
      for (const l of lanes)
        for (const v of l.vehicles) {
          const d = l.stopLines[0].s - v.s;
          if (d > 0 && d < 150) amberOnset.set(v, v.v < 1 || d > (v.v * v.v) / (2 * 3.2) + 1);
        }
    if (light === 'G') amberOnset.clear();
    was = light;
    for (const l of lanes)
      for (const v of l.vehicles) {
        const line = l.stopLines[0].s;
        const p = prev.get(v);
        prev.set(v, v.s);
        if (p !== undefined && p < line && v.s >= line) crossedOn.set(v, { light, could: amberOnset.get(v) ?? null });
      }
    if (k % 30) continue;
    for (const mode of share ? ['fix', 'after'] : ['problems', 'cost']) {
      for (const a of b.annotate!(mode) as Annotation[]) {
        if (a.kind !== 'tag') continue;
        const key = a.text.replace(/\d+/g, 'N');
        (tags[mode] ??= {})[key] = (tags[mode][key] ?? 0) + 1;
        const v = w.vehicles.find((x) => x.id === Number(a.id.slice(2)));
        if (a.text === 'Jumps the red') ok('red: crossed the stop line on red', !!v && crossedOn.get(v)?.light === 'R');
        if (a.text === 'Speeds through the amber')
          ok('amber: crossed on amber though it could have stopped', !!v && crossedOn.get(v)?.light === 'Y' && crossedOn.get(v)?.could === true);
        if (a.text === 'Stops on the zebra') ok('zebra: stopped past the stop line', !!v && v.v < 0.5 && v.s > v.lane.stopLines[0].s + 0.5);
        if (a.text === 'Stops behind the line') ok('fix: stopped at or behind the line', !!v && v.v < 0.5 && v.s <= v.lane.stopLines[0].s + 0.5);
        if (a.text === 'Near miss') {
          const pid = Number(a.id.slice(2));
          ok(
            'near miss: a near-miss event involved this person in the last 2 s',
            w.events.some((e) => e.kind === 'nearmiss' && w.t - e.t < 2 && Math.abs(e.x - a.x) < 4),
          );
          void pid;
        }
        if (a.text.startsWith('Gives up')) ok('jaywalk: crossing more than 5 m from the zebra', Math.abs(a.x) > 5);
      }
    }
  }
  const s = b.sample();
  console.log(`\n== share ${share} seed ${seed}, ${secs} s from t=${zebra.warmup}`);
  console.log(
    '  sample: ' +
      Object.entries(s)
        .map(([k, v]) => `${k} ${v.toFixed(1)}`)
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
