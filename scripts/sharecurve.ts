// "How many of us need to adjust?": each chapter's headline metric against the share of
// drivers who adjust, for every slider position and several seeds. Each run warms up, then the
// metric is averaged over a fixed window (sampled every 2 s), so a single unlucky moment (a bus
// stopped right at the end, a queue mid-surge) cannot swing it. Counts that accumulate (near
// misses) are taken at the end instead, i.e. over warm-up plus window.
// Every number published about the chapters (habit cards, teaser, posts) comes from this file.
// Writes src/data/curves.json: mean, min and max across seeds, plus every seed's value.
// Usage: node scripts/sharecurve.ts [seeds=10] [seconds=300] [scenarioId ...]
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { SCENARIOS } from '../src/sim/scenarios/index.ts';

const r2 = (x: number) => Math.round(x * 100) / 100;

// --merge a.json b.json …: combine per-scenario files written with OUT into src/data/curves.json
if (process.argv[2] === '--merge') {
  type Part = {
    method: string;
    seeds: number;
    secs: number;
    shares: number[];
    curves: Record<string, { metric: string; better: string; warmup: number; seeds: number[][] }>;
  };
  const files: Part[] = process.argv.slice(3).map((p) => JSON.parse(readFileSync(p, 'utf8')));
  if (files.some((f) => f.secs !== files[0].secs || f.method !== files[0].method)) throw new Error('files were measured differently');
  const curves: Record<string, unknown> = {};
  let total = 0;
  for (const id of SCENARIOS.map((d) => d.id)) {
    const parts = files.map((f) => f.curves[id]).filter(Boolean);
    if (!parts.length) continue;
    const rows = parts.flatMap((p) => p.seeds);
    total = Math.max(total, rows.length);
    const col = (k: number) => rows.map((r) => r[k]);
    curves[id] = {
      metric: parts[0].metric,
      better: parts[0].better,
      warmup: parts[0].warmup,
      mean: files[0].shares.map((_, k) => r2(col(k).reduce((a, b) => a + b, 0) / rows.length)),
      min: files[0].shares.map((_, k) => r2(Math.min(...col(k)))),
      max: files[0].shares.map((_, k) => r2(Math.max(...col(k)))),
      seeds: rows,
    };
    console.log(`${id}: ${rows.length} runs`);
  }
  const merged = { method: files[0].method.replace(/seeds 1–\d+/, `seeds 1–${total}`), seeds: total, secs: files[0].secs, shares: files[0].shares, curves };
  writeFileSync(new URL('../src/data/curves.json', import.meta.url), JSON.stringify(merged) + '\n');
  console.log('merged into src/data/curves.json');
  process.exit(0);
}
const nSeeds = Number(process.argv[2] ?? 10);
// SEEDS=a-b runs only seeds a…b (to split one heavy scenario across processes; --merge joins them)
const [seedFrom, seedTo] = (process.env.SEEDS ?? `1-${nSeeds}`).split('-').map(Number);
const secs = Number(process.argv[3] ?? 300);
const only = process.argv.slice(4);
const shares = Array.from({ length: 21 }, (_, i) => i / 20); // the slider moves in 5% steps
// OUT lets several scenarios run in parallel, each into its own file (merge afterwards with --merge)
const out = process.env.OUT ? new URL(`file://${process.env.OUT}`) : new URL('../src/data/curves.json', import.meta.url);
const CUMULATIVE = new Set(['near']);
const STEP = 2;

type Curve = { metric: string; better: 'lower' | 'higher'; warmup: number; mean: number[]; min: number[]; max: number[]; seeds: number[][] };
const curves: Record<string, Curve> = {};

for (const def of SCENARIOS) {
  if (only.length && !only.includes(def.id)) continue;
  const hero = def.metrics.find((m) => m.hero) ?? def.metrics[0];
  const t0 = performance.now();
  const bySeed: number[][] = [];
  for (let seed = seedFrom; seed <= seedTo; seed++) {
    const row: number[] = [];
    for (const share of shares) {
      const b = def.build(seed, share);
      b.world.run(def.warmup);
      b.world.measureSince = b.world.t;
      let sum = 0;
      let n = 0;
      for (let t = 0; t < secs; t += STEP) {
        b.world.run(STEP);
        sum += b.sample()[hero.key];
        n++;
      }
      row.push(CUMULATIVE.has(hero.key) ? b.sample()[hero.key] : sum / n);
    }
    bySeed.push(row);
  }
  const col = (i: number) => bySeed.map((r) => r[i]);
  const c: Curve = {
    metric: hero.key,
    better: hero.better,
    warmup: def.warmup,
    mean: shares.map((_, i) => r2(col(i).reduce((a, b) => a + b, 0) / bySeed.length)),
    min: shares.map((_, i) => r2(Math.min(...col(i)))),
    max: shares.map((_, i) => r2(Math.max(...col(i)))),
    seeds: bySeed.map((r) => r.map(r2)),
  };
  curves[def.id] = c;
  console.log(`\n${def.id} · ${hero.key} (${hero.unit || 'count'}, ${hero.better} is better) · ${((performance.now() - t0) / 1000).toFixed(0)} s`);
  for (let i = 0; i < shares.length; i += 2)
    console.log(
      `  ${String(Math.round(shares[i] * 100)).padStart(3)}%  mean ${c.mean[i].toFixed(1).padStart(7)}   range ${c.min[i].toFixed(1)}–${c.max[i].toFixed(1)}`,
    );
}

// keep other scenarios' curves from an earlier run with the same settings (lets scenarios run in parallel)
const prev = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
if (prev && prev.seeds === nSeeds && prev.secs === secs) for (const id in prev.curves) curves[id] ??= prev.curves[id];
const order = SCENARIOS.map((d) => d.id).filter((id) => curves[id]);
const data = {
  method: `civic share 0–100% in 5% steps; each run warms up for the scenario's warmup, then the headline metric is averaged over the next ${secs} s (sampled every ${STEP} s; near-miss counts are totals at the end); seeds 1–${nSeeds}`,
  seeds: nSeeds,
  secs,
  shares,
  curves: Object.fromEntries(order.map((id) => [id, curves[id]])),
};
writeFileSync(out, JSON.stringify(data) + '\n');
console.log(`\nwrote ${out.pathname}`);
