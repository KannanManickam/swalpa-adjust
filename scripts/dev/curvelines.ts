// Print each chapter's "how many of us need to adjust?" curve and the line it generates.
// Usage: node scripts/dev/curvelines.ts   (after node scripts/sharecurve.ts)
import { readFileSync } from 'node:fs';
import { byId } from '../../src/sim/scenarios/index.ts';
import { STORIES } from '../../src/data/stories.ts';
import { curveHeadline, gainShare, type ShareCurve } from '../../src/lib/curve.ts';

const data = JSON.parse(readFileSync(new URL('../../src/data/curves.json', import.meta.url), 'utf8'));
console.log(data.method);
for (const id in data.curves) {
  const c: ShareCurve = data.curves[id];
  const def = byId(id).metrics.find((m) => m.key === c.metric)!;
  const g = gainShare(c);
  console.log(`\n${id} · ${def.label} (${def.unit || 'count'})`);
  for (let i = 0; i < c.mean.length; i += 2)
    console.log(
      `  ${String(i * 5).padStart(3)}%  ${c.mean[i].toFixed(1).padStart(6)}  (${c.min[i].toFixed(1)}–${c.max[i].toFixed(1)})  gain ${Math.round(g[i] * 100)}%`,
    );
  console.log(`  → ${curveHeadline(c, def, STORIES[id].curve)}`);
}
