// 05 · The Bay — a BMTC stop on a busy 3-lane arterial.
// Status quo: buses halt wherever they are, autos stop mid-lane for a fare;
// every stop deletes a lane and forces a scramble of lane changes.
// Swalpa adjust: pull fully into the bay, and let the bus back out.

import { Path } from '../core/geom.ts';
import { Rng } from '../core/rng.ts';
import { BLR_MIX } from '../core/types.ts';
import type { Pose } from '../core/geom.ts';
import { World, type Vehicle } from '../core/world.ts';
import { Net, decorate } from '../net.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE, GREY, ORANGE } from './palette.ts';

const X0 = -200;
const X1 = 185;
const BAY0 = -15;
const BAY1 = 45;
const STOP_X = BAY1 - 8;

export const busBay: ScenarioDef = {
  id: 'busbay',
  warmup: 140,
  split: 'v',
  view: 'split',
  aspect: '16/8.5',
  speed: 2,
  camera: { pitch: 1.12 },
  metrics: [
    { key: 'zone', label: 'Speed past the stop', unit: 'km/h', better: 'higher', hero: true, digits: 0, up: 'faster', down: 'slower' },
    { key: 'blocked', label: 'Time a running lane is blocked', unit: '%', better: 'lower', digits: 0, down: 'less', up: 'more' },
    { key: 'lcs', label: 'Lane changes near the stop, per minute', unit: '/min', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'trip', label: 'Average time to pass the stop', unit: 's', better: 'lower', time: true, down: 'quicker', up: 'slower' },
    { key: 'thru', label: 'Vehicles through per minute', unit: '/min', better: 'higher', digits: 0, up: 'more', down: 'fewer' },
    { key: 'speed', label: 'Average speed, whole road', unit: 'km/h', better: 'higher', digits: 0, up: 'faster', down: 'slower' },
    { key: 'lost', label: 'People-minutes lost', unit: 'min', better: 'lower', down: 'less', up: 'more' },
  ],
  build(seed, civicShare) {
    const w = new World({ seed, civicShare, name: 'busbay' });
    const net = new Net(w);
    const road = net.road({ x: X0, y: 0 }, { x: X1, y: 0 }, { lanes: 3, lanesBack: 2, median: 1.2, vLimit: 13 });
    net.build();
    const lanes = road.fwd!.lanes;
    const kerb = lanes[0];
    const kp = kerb.path.pose(0);
    const yBay = kp.y - 3.2;
    const bay = w.addLane(Path.line({ x: BAY0, y: yBay }, { x: BAY1, y: yBay }), 3.2);
    bay.endWall = true;
    bay.tag = 'bay';
    bay.vLimit = 8;
    const off = BAY0 - X0;
    w.neighbours(kerb, bay, 'left', off + 3, off + bay.length - 6, -off);
    bay.right[0].from = 0;
    bay.right[0].to = bay.length;

    const src = net.source(road, 'fwd', 0.95, BLR_MIX);
    src.pickLane = (p) => lanes[Math.floor(p.laneU * 3)];
    const bg = net.source(road, 'back', 0.35, BLR_MIX);
    bg.bg = true;

    // who stops at the bus stop: every bus, and some autos picking up a fare
    const isStopper = (v: Vehicle) => !v.flags.bg && (v.type === 'bus' || (v.type === 'auto' && v.traits[4] < 0.35));
    const dwellFor = (v: Vehicle) => (v.type === 'bus' ? 14 + v.traits[3] * 10 : 5 + v.traits[3] * 5);
    const stopS = STOP_X - X0;

    w.hooks.mandatory = (_w, v) => {
      if (!isStopper(v)) return undefined;
      const plan = v.stopPlan;
      if (v.lane === bay) {
        if (plan && plan.state !== 'done') return null; // dwelling: stay put
        return undefined; // default: merge back out of the bay
      }
      if (plan && plan.state === 'done') return undefined;
      if (!v.civic) return null; // stops wherever it is
      const x = X0 + v.s;
      if (x > BAY1 - 10) return null;
      if (v.lane.index > 0) {
        const dEnd = BAY0 + 15 - x;
        return { dir: -1, urgency: Math.max(0.2, Math.min(1, 1 - dEnd / 140)), dEnd: Math.max(dEnd, 1), atWall: false };
      }
      if (x > BAY0 + 2) return { dir: -1, urgency: 1, dEnd: 5, atWall: false };
      return null;
    };
    w.hooks.mergeZone = (_w, v) => (v.lane === bay ? 200 : v.civic ? 30 : 10);

    w.hooks.afterStep = (world) => {
      const dt = world.dt;
      let blockedNow = 0;
      for (const v of world.vehicles) {
        if (!isStopper(v)) continue;
        const plan = v.stopPlan;
        if (!plan) {
          const x = X0 + v.s;
          if (v.lane === bay && v.civic) {
            v.stopPlan = { lane: bay, s: bay.length - 3, time: dwellFor(v), state: 'approach', t: 0 };
          } else if (!v.civic && v.lane !== bay && v.lane.group === kerb.group && x > STOP_X - 70 && x < STOP_X - 5) {
            v.stopPlan = { lane: v.lane, s: stopS - v.traits[5] * 10, time: dwellFor(v), state: 'approach', t: 0 };
          }
          continue;
        }
        if (plan.state === 'approach') {
          if (plan.lane !== v.lane && v.lane !== bay && !v.civic) plan.lane = v.lane;
          if (v.lane === plan.lane && Math.abs(plan.s - v.s) < 2.5 && v.v < 0.4) plan.state = 'dwell';
          // stopped anywhere in the bay (say behind another bus): board right there
          if (v.lane === bay && v.v < 0.4 && v.s > 6) plan.state = 'dwell';
          if (v.s > plan.s + 4 && v.lane === plan.lane) plan.state = 'done';
        } else if (plan.state === 'dwell') {
          plan.t += dt;
          if (v.lane !== bay) blockedNow = 1;
          if (plan.t >= plan.time) plan.state = 'done';
        }
      }
      blockedEma += (blockedNow * 100 - blockedEma) * (dt / 60);
      speedEma += (world.metrics.meanSpeed * 3.6 - speedEma) * (dt / 15);
    };
    let blockedEma = 0;
    let speedEma = 0;

    // ---- visuals ----
    const vis = net.vis;
    const yEdge = kp.y - 3.3 / 2;
    vis.asphalt.push([
      { x: BAY0 - 12, y: yEdge },
      { x: BAY0, y: yBay - 1.6 },
      { x: BAY1, y: yBay - 1.6 },
      { x: BAY1 + 10, y: yEdge },
    ]);
    vis.lines.push({
      pts: [
        { x: BAY0, y: yEdge },
        { x: BAY1, y: yEdge },
      ],
      color: 'yellow',
      width: 0.15,
      dash: [1.5, 1.5],
    });
    vis.texts.push({ x: (BAY0 + BAY1) / 2 - 8, y: yBay, h: 0, text: 'BUS', color: 'yellow' });
    vis.busStops.push({ x: STOP_X - 6, y: yBay - 4.4, h: 0, len: 12 });
    vis.labels.push({ x: STOP_X - 6, y: yBay - 9, text: 'BMTC stop', kind: 'place' });
    // footpath strip shifts back around the bay
    vis.footpaths = vis.footpaths.filter((poly) => !poly.some((p) => p.y < yEdge - 0.5 && p.y > yEdge - 4));
    vis.footpaths.push([
      { x: X0, y: yEdge - 2.6 },
      { x: BAY0 - 12, y: yEdge - 2.6 },
      { x: BAY0 - 12, y: yEdge },
      { x: X0, y: yEdge },
    ]);
    vis.footpaths.push([
      { x: BAY0 - 12, y: yBay - 1.6 - 3.4 },
      { x: BAY1 + 10, y: yBay - 1.6 - 3.4 },
      { x: BAY1 + 10, y: yEdge },
      { x: BAY1, y: yBay - 1.6 },
      { x: BAY0, y: yBay - 1.6 },
      { x: BAY0 - 12, y: yEdge },
    ]);
    vis.footpaths.push([
      { x: BAY1 + 10, y: yEdge - 2.6 },
      { x: X1, y: yEdge - 2.6 },
      { x: X1, y: yEdge },
      { x: BAY1 + 10, y: yEdge },
    ]);
    vis.kerbs = vis.kerbs.filter((k) => !(k[0].y < yEdge + 0.1 && k[0].y > yEdge - 0.1));
    vis.kerbs.push([
      { x: X0, y: yEdge },
      { x: BAY0 - 12, y: yEdge },
    ]);
    vis.kerbs.push([
      { x: BAY0 - 12, y: yEdge },
      { x: BAY0, y: yBay - 1.6 },
    ]);
    vis.kerbs.push([
      { x: BAY0, y: yBay - 1.6 },
      { x: BAY1, y: yBay - 1.6 },
    ]);
    vis.kerbs.push([
      { x: BAY1, y: yBay - 1.6 },
      { x: BAY1 + 10, y: yEdge },
    ]);
    vis.kerbs.push([
      { x: BAY1 + 10, y: yEdge },
      { x: X1, y: yEdge },
    ]);
    vis.trees = vis.trees.filter((t) => !(t.x > BAY0 - 14 && t.x < BAY1 + 12 && t.y < yEdge && t.y > yBay - 9));
    vis.lamps = vis.lamps.filter((t) => !(t.x > BAY0 - 14 && t.x < BAY1 + 12 && t.y < yEdge && t.y > yBay - 9));
    vis.bounds = { minX: -100, maxX: 92, minY: -24, maxY: 14 };
    decorate(vis, new Rng(seed + 7), [...net.corridors(), { a: { x: BAY0, y: yBay - 4 }, b: { x: BAY1, y: yBay - 4 }, r: 7 }], { density: 0.55, maxH: 22 });

    // ---- around the stop: lane changes and the speed of through traffic ----
    const ZONE = { x0: -25, x1: STOP_X + 4 };
    const pose: Pose = { x: 0, y: 0, h: 0 };
    let lcTimes: number[] = [];
    const exec = w.executeLC.bind(w);
    w.executeLC = (v, link, dir, forced) => {
      const x = v.pose(pose).x;
      if (!v.flags.bg && v.lane !== bay && link.lane !== bay && x > ZONE.x0 - 35 && x < ZONE.x1) lcTimes.push(w.t);
      exec(v, link, dir, forced);
    };
    let zoneSpeed = 0;
    const after0 = w.hooks.afterStep!;
    w.hooks.afterStep = (world) => {
      after0(world);
      let sum = 0;
      let n = 0;
      for (const v of world.vehicles) {
        if (v.flags.bg || v.lane === bay || v.stopPlan) continue;
        const x = v.pose(pose).x;
        if (x > ZONE.x0 && x < ZONE.x1) {
          sum += v.v * 3.6;
          n++;
        }
      }
      if (n) zoneSpeed += (sum / n - zoneSpeed) * Math.min(1, world.dt / 8);
      if (lcTimes.length && lcTimes[0] < world.t - 60) lcTimes = lcTimes.filter((t) => t >= world.t - 60);
    };
    const lcRate = () => (lcTimes.length / Math.max(1, Math.min(60, w.t - w.measureSince))) * 60;

    // ---- explanation: colours and call-outs ----
    const colorBy = (v: Vehicle) => (v.flags.bg ? GREY : isStopper(v) ? ORANGE : BLUE);
    const at = (v: Vehicle) => (v.pose(pose), { x: pose.x, y: pose.y });
    const dwelling = (v: Vehicle) => v.stopPlan?.state === 'dwell';
    const what = (v: Vehicle) => (v.type === 'bus' ? 'Bus' : 'Auto');
    const annotate = (mode: string): Annotation[] => {
      const out: Annotation[] = [];
      if (mode === 'setup') {
        out.push({ kind: 'tag', id: 'bay', x: (BAY0 + BAY1) / 2, y: yBay, text: 'Bus bay: room to stop off the road', tone: 'good', h: 0.4 });
        out.push({ kind: 'tag', id: 'lanes', x: -60, y: kp.y + 3.3, text: 'Three running lanes', tone: 'info', side: 'down', h: 0.4 });
      } else if (mode === 'problems' || mode === 'cost') {
        const stopped = w.vehicles.filter((v) => dwelling(v) && v.lane !== bay && isStopper(v));
        stopped.sort((p, q) => q.s - p.s);
        stopped.slice(0, mode === 'cost' ? 3 : 2).forEach((v) =>
          out.push({
            kind: 'tag',
            id: `sl${v.id}`,
            ...at(v),
            text: mode === 'cost' ? 'Lane blocked' : `${what(v)} stopped in a running lane`,
            tone: 'bad',
            ring: v.type === 'bus' ? 6.5 : 2.6,
          }),
        );
        if (mode === 'problems') {
          // someone swerving out from behind a stopped bus or auto
          const swerve = w.vehicles.find(
            (v) =>
              v.lcActive &&
              !v.flags.bg &&
              v.lcFrom &&
              v.lcFrom !== bay &&
              v.lane !== bay &&
              v.lcFrom.vehicles.some((o) => dwelling(o) && o.s - (v.s + v.lcFromOffset) > 0 && o.s - (v.s + v.lcFromOffset) < 30),
          );
          if (swerve) out.push({ kind: 'tag', id: `sw${swerve.id}`, ...at(swerve), text: 'Swerves around it', tone: 'warn', ring: 2.4, side: 'down' });
        } else {
          out.push({
            kind: 'bracket',
            id: 'zone',
            x0: ZONE.x0,
            x1: ZONE.x1,
            y: kp.y + 3.3 * 2.6,
            text: `Near the stop: ${Math.round(zoneSpeed)} km/h · ${Math.round(lcRate())} lane changes a minute`,
            tone: 'bad',
          });
        }
      } else if (mode === 'fix') {
        const inBay = w.vehicles.filter((v) => v.lane === bay && dwelling(v));
        inBay
          .slice(0, 2)
          .forEach((v) =>
            out.push({ kind: 'tag', id: `ib${v.id}`, ...at(v), text: `${what(v)} pulled into the bay`, tone: 'good', ring: v.type === 'bus' ? 6.5 : 2.6 }),
          );
        const rejoin = w.vehicles.find((v) => v.lcActive && v.lcFrom === bay && !v.forced);
        if (rejoin) out.push({ kind: 'tag', id: `rj${rejoin.id}`, ...at(rejoin), text: 'Let back in, one at a time', tone: 'good', ring: 2.6, side: 'down' });
        if (!inBay.length && !rejoin)
          out.push({ kind: 'tag', id: 'clear', x: STOP_X - 20, y: kp.y + 3.3, text: 'All three lanes keep moving', tone: 'good', side: 'down', h: 0.4 });
      } else if (mode === 'after') {
        out.push({
          kind: 'bracket',
          id: 'zone',
          x0: ZONE.x0,
          x1: ZONE.x1,
          y: kp.y + 3.3 * 2.6,
          text: `Near the stop: ${Math.round(zoneSpeed)} km/h · ${Math.round(lcRate())} lane changes a minute`,
          tone: 'good',
        });
      }
      return out;
    };

    const sample = () => ({
      zone: zoneSpeed,
      lcs: lcRate(),
      trip: w.metrics.avgTrip(w.t, 120).travel,
      blocked: blockedEma,
      thru: w.metrics.throughputPerMin(w.t, 60, w.measureSince),
      speed: speedEma,
      lost: w.metrics.peopleSecLost / 60,
    });
    return { world: w, vis, sample, annotate, colorBy };
  },
};
