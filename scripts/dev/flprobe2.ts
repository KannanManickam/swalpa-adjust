// Free left, status quo: during red, what is at the front of each kerb lane?
import { freeLeft } from '../../src/sim/scenarios/freeLeft.ts';
const seed = Number(process.argv[2] ?? 13);
const b = freeLeft.build(seed, 0);
const w = b.world;
w.run(freeLeft.warmup);
const kerbs = w.lanes.filter((l) => l.moves?.L?.legal);
const t: Record<string, Record<string, number>> = {};
let spawnKerbS = 0,
  lcOut = 0;
const exec = w.executeLC.bind(w);
w.executeLC = (v, link, dir, forced) => {
  if (kerbs.includes(v.lane) && v.moves[0] === 'S') lcOut++;
  exec(v, link, dir, forced);
};
const seen = new Set<number>();
for (let k = 0; k < 300 * 30; k++) {
  w.step();
  for (const l of kerbs)
    for (const v of l.vehicles)
      if (!seen.has(v.id)) {
        seen.add(v.id);
        if (v.moves[0] === 'S') spawnKerbS++;
      }
  if (k % 30) continue;
  for (const l of kerbs) {
    const p = l.path.pose(0);
    const name = p.x < -50 ? 'W' : p.x > 50 ? 'E' : p.y < -50 ? 'N' : 'S';
    const sl = l.stopLines[0];
    const st = sl.signal.state(sl.group);
    if (st === 'G') continue;
    const f = l.vehicles[l.vehicles.length - 1];
    const what = !f
      ? 'empty'
      : f.moves[0] === 'S' && f.v < 0.5 && l.length - f.s < 6
        ? 'straight-goer stopped at line'
        : f.moves[0] === 'L'
          ? 'left-turner'
          : 'straight-goer approaching';
    (t[name] ??= {})[what] = (t[name][what] ?? 0) + 1;
  }
}
console.log(t);
console.log({ straightGoersSeenInKerbLanes: spawnKerbS, leftKerbLaneByLC: lcOut });
