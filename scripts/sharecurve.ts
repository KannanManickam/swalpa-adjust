// "How many of us need to adjust?": each chapter's headline metric against the share of
// drivers who adjust, measured the same way as scripts/simcompare.ts (warm up, then sample
// at the end of a fixed window), for every slider position and several seeds.
// Writes src/data/curves.json: mean, min and max across seeds, plus every seed's value.
// Usage: node scripts/sharecurve.ts [seeds=10] [seconds=300] [scenarioId ...]
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { SCENARIOS } from '../src/sim/scenarios/index.ts';

const nSeeds = Number(process.argv[2] ?? 10);
const secs = Number(process.argv[3] ?? 300);
const only = process.argv.slice(4);
const shares = Array.from({ length: 21 }, (_, i) => i / 20); // the slider moves in 5% steps
const out = new URL('../src/data/curves.json', import.meta.url);
const r2 = (x: number) => Math.round(x * 100) / 100;

type Curve = { metric: string; better: 'lower' | 'higher'; warmup: number; mean: number[]; min: number[]; max: number[]; seeds: number[][] };
const curves: Record<string, Curve> = {};

for (const def of SCENARIOS) {
  if (only.length && !only.includes(def.id)) continue;
  const hero = def.metrics.find((m) => m.hero) ?? def.metrics[0];
  const t0 = performance.now();
  const bySeed: number[][] = [];
  for (let seed = 1; seed <= nSeeds; seed++) {
    const row: number[] = [];
    for (const share of shares) {
      const b = def.build(seed, share);
      b.world.run(def.warmup);
      b.world.measureSince = b.world.t;
      b.world.run(secs);
      row.push(b.sample()[hero.key]);
    }
    bySeed.push(row);
  }
  const col = (i: number) => bySeed.map((r) => r[i]);
  const c: Curve = {
    metric: hero.key,
    better: hero.better,
    warmup: def.warmup,
    mean: shares.map((_, i) => r2(col(i).reduce((a, b) => a + b, 0) / nSeeds)),
    min: shares.map((_, i) => r2(Math.min(...col(i)))),
    max: shares.map((_, i) => r2(Math.max(...col(i)))),
    seeds: bySeed.map((r) => r.map(r2)),
  };
  curves[def.id] = c;
  console.log(`\n${def.id} · ${hero.key} (${hero.unit || 'count'}, ${hero.better} is better) · ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  for (let i = 0; i < shares.length; i += 2)
    console.log(`  ${String(Math.round(shares[i] * 100)).padStart(3)}%  mean ${c.mean[i].toFixed(1).padStart(7)}   range ${c.min[i].toFixed(1)}–${c.max[i].toFixed(1)}`);
}

// keep other scenarios' curves from an earlier run with the same settings (lets scenarios run in parallel)
const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
if (prev && prev.seeds === nSeeds && prev.secs === secs) for (const id in prev.curves) curves[id] ??= prev.curves[id];
const order = SCENARIOS.map((d) => d.id).filter((id) => curves[id]);
const data = {
  method: `civic share 0–100% in 5% steps; each run warms up for the scenario's warmup, then runs ${secs} s and samples the headline metric at the end (as scripts/simcompare.ts); seeds 1–${nSeeds}`,
  seeds: nSeeds,
  secs,
  shares,
  curves: Object.fromEntries(order.map((id) => [id, curves[id]])),
};
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`\nwrote ${out.pathname}`);
