// Per junction (status quo): how often a side-street driver has green, room beyond, and still can't cross
// because main-road vehicles sit in the box. node scripts/dev/gridnodes.ts [seed]
import { gridlock } from '../../src/sim/scenarios/gridlock.ts';
import type { Lane } from '../../src/sim/core/world.ts';
const seed = Number(process.argv[2] ?? 12);
const b = gridlock.build(seed, 0);
const w = b.world;
w.run(gridlock.warmup);
const sig = w.signals;
void sig;
const names = ['TL', 'TR', 'BL', 'BR'];
// rebuild approach info from lanes: connectors know their node by position
const conns = w.lanes.filter((l) => l.connector);
const nodeOf = (c: Lane) => {
  const p = c.path.pose(c.length / 2);
  return (p.x > 0 ? 1 : 0) + (p.y > 0 ? 2 : 0);
};
const res = names.map(() => ({ clean: 0, blocked: 0, stuckMain: 0, fromNorth: 0, fromSouth: 0 }));
for (let k = 0; k < 150; k++) {
  w.run(1);
  for (const c of conns) {
    const n = nodeOf(c);
    const p0 = c.path.pose(0);
    const p1 = c.path.pose(c.length);
    const side = Math.abs(p1.y - p0.y) > Math.abs(p1.x - p0.x);
    if (!side) {
      res[n].stuckMain += c.vehicles.filter((v) => v.v < 0.6 && v.stoppedFor > 2 && v.s > 4.5 && v.s - v.len < 19.3).length;
      continue;
    }
  }
  for (const l of w.lanes) {
    const c = l.moves?.S?.lane;
    if (!c) continue;
    const n = nodeOf(c);
    const p0 = c.path.pose(0);
    const p1 = c.path.pose(c.length);
    if (Math.abs(p1.y - p0.y) < Math.abs(p1.x - p0.x)) continue; // side-street approaches only
    const f = l.vehicles[l.vehicles.length - 1];
    if (!f || f.s < l.length - 6 || f.v > 0.5) continue;
    const sl = l.stopLines[0];
    if (!sl || sl.signal.state(sl.group) !== 'G') continue;
    const room = w.exitSpace(c.next[0]).free > f.len + 3;
    const mainStuck = conns.some((cc) => nodeOf(cc) === n && cc !== c && cc.vehicles.some((v) => v.flags.road === 0 && v.v < 0.6 && v.stoppedFor > 2));
    if (room && mainStuck) {
      res[n].clean++;
      if (p1.y > p0.y) res[n].fromNorth++;
      else res[n].fromSouth++;
    } else res[n].blocked++;
  }
}
names.forEach((nm, i) => console.log(nm, JSON.stringify(res[i])));
