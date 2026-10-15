import { byId } from '../../src/sim/scenarios/index.ts';
const b = byId(process.argv[2] ?? 'zebra').build(1, 1);
console.log('zebras', JSON.stringify(b.vis.zebras), 'bounds', JSON.stringify(b.vis.bounds), 'signals', b.vis.signals.length, 'peds', b.world.peds.length);
b.world.run(60);
console.log(
  'peds after 60s',
  b.world.peds.length,
  b.world.peds.slice(0, 3).map((p) => `${p.state}@${p.x.toFixed(1)},${p.y.toFixed(1)}`),
);
