// 03 · Free Left — a signalised junction where the kerb lane may turn left on red.
// Status quo: two-wheelers and autos going straight squeeze into the free-left
// lane to get ahead, then sit at the stop line waiting for green — and every
// left-turner behind them waits too.
// Swalpa adjust: going straight? Stay out of the free-left lane.

import { Rng } from '../core/rng.ts';
import { BLR_MIX, type Move } from '../core/types.ts';
import type { Pose } from '../core/geom.ts';
import { World, type Lane, type Vehicle } from '../core/world.ts';
import { Net, decorate } from '../net.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE, ORANGE } from './palette.ts';

const ARM = 132;

export const freeLeft: ScenarioDef = {
  id: 'freeleft',
  warmup: 240,
  split: 'h',
  view: 'wipe',
  aspect: '16/10.5',
  speed: 2.2,
  camera: { pitch: 0.98 },
  metrics: [
    { key: 'leftDelay', label: 'Delay for left-turners', unit: 's', better: 'lower', hero: true, down: 'shorter', up: 'longer' },
    { key: 'blocked', label: 'Time a free left is blocked', unit: '%', better: 'lower', down: 'less', up: 'more' },
    { key: 'straightDelay', label: 'Delay going straight', unit: 's', better: 'lower', down: 'shorter', up: 'longer' },
    { key: 'thru', label: 'Vehicles through per minute', unit: '/min', better: 'higher', up: 'more', down: 'fewer' },
    { key: 'lost', label: 'People-minutes lost', unit: 'min', better: 'lower', down: 'less', up: 'more' },
  ],
  build(seed, civicShare) {
    const w = new World({ seed, civicShare, name: 'freeleft' });
    const net = new Net(w);
    const J = net.node(0, 0, { half: 10.8, freeLeft: true, zebra: true, signal: { greenNS: 16, greenEW: 30, amber: 3, allRed: 2 } });
    const ro = { lanes: 3, lanesBack: 3, median: 1.2, laneW: 3.3, vLimit: 12 };
    const rW = net.road({ x: -ARM, y: 0 }, J, ro);
    const rE = net.road(J, { x: ARM, y: 0 }, ro);
    const rN = net.road({ x: 0, y: -ARM }, J, ro);
    const rS = net.road(J, { x: 0, y: ARM }, ro);
    net.build();

    const moveGen = (r: Rng): Move[] => [r.next() < 0.55 ? 'L' : 'S'];
    // a busy main road (E–W) crossing a quieter street (N–S)
    const main = 0.42;
    const side = 0.2;
    const srcs = [
      net.source(rW, 'fwd', main, BLR_MIX, moveGen),
      net.source(rN, 'fwd', side, BLR_MIX, moveGen),
      net.source(rE, 'back', main, BLR_MIX, moveGen),
      net.source(rS, 'back', side, BLR_MIX, moveGen),
    ];
    const approaches: Lane[][] = [rW.fwd!.lanes, rN.fwd!.lanes, rE.back!.lanes, rS.back!.lanes];
    srcs.forEach((src, i) => {
      const lanes = approaches[i];
      src.pickLane = (p, world) => {
        if (p.moves[0] === 'L') return lanes[0];
        const civic = world.profileFor(p.u).name === 'civic';
        if (civic) return lanes[1 + Math.floor(p.laneU * 2)];
        // queue-jumpers: the kerb lane looks emptiest
        return p.laneU < 0.55 ? lanes[0] : lanes[1 + Math.floor(((p.laneU - 0.55) / 0.45) * 2)];
      };
    });
    // the "shortcut" lane looks attractive to the selfish
    w.hooks.lcBias = (_w, v, dir) => (!v.civic && v.move === 'S' && dir < 0 && v.lane.index === 1 ? 0.25 : 0);

    const vis = net.vis;
    vis.bounds = { minX: -92, maxX: 92, minY: -60, maxY: 60 };
    decorate(vis, new Rng(seed + 3), net.corridors(), { density: 0.6, maxH: 30 });

    // fraction of time free-left lanes are plugged by someone waiting to go straight (60 s window)
    let blockedEma = 0;
    w.hooks.afterStep = (world) => {
      let blocked = 0;
      for (const lanes of approaches) {
        const k = lanes[0];
        const front = k.vehicles[k.vehicles.length - 1];
        if (front && front.move === 'S' && front.v < 0.8 && k.length - front.s < 6) blocked++;
      }
      blockedEma += ((blocked / approaches.length) * 100 - blockedEma) * (world.dt / 60);
    };
    // ---- explanation: colours and call-outs ----
    const colorBy = (v: Vehicle) => (v.moves[0] === 'L' ? ORANGE : BLUE);
    const pose: Pose = { x: 0, y: 0, h: 0 };
    const at = (v: Vehicle) => (v.pose(pose), { x: pose.x, y: pose.y });
    const red = (l: Lane) => l.stopLines[0]?.signal.state(l.stopLines[0].group) !== 'G';
    /** a straight-goer sitting at the stop line of a free-left lane */
    const plug = (lanes: Lane[]) => {
      const k = lanes[0];
      const f = k.vehicles[k.vehicles.length - 1];
      return f && f.moves[0] === 'S' && f.v < 0.5 && k.length - f.s < 6 ? f : null;
    };
    const W = approaches[0];
    let lastTurner: Vehicle | undefined;
    const kerbAt = (lanes: Lane[], back: number) => lanes[0].path.pose(lanes[0].length - back);
    const annotate = (mode: string): Annotation[] => {
      const out: Annotation[] = [];
      if (mode === 'setup') {
        const p = kerbAt(W, 24);
        out.push({ kind: 'tag', id: 'fl', x: p.x, y: p.y, text: 'Free left: may turn on red', tone: 'good', h: 0.4 });
        const q = W[2].path.pose(W[2].length - 30);
        out.push({ kind: 'tag', id: 'st', x: q.x, y: q.y, text: 'Straight on: wait for green', tone: 'info', side: 'down', h: 0.4 });
      } else if (mode === 'problems') {
        let plugs = 0;
        let victims = 0;
        // the north approach sits at the top of the screen: label it last, and downwards
        for (const lanes of [approaches[0], approaches[2], approaches[3], approaches[1]]) {
          const f = plug(lanes);
          if (!f || !red(lanes[0]) || plugs >= 2) continue;
          const north = lanes === approaches[1];
          out.push({
            kind: 'tag',
            id: `pl${f.id}`,
            ...at(f),
            text: 'Going straight, parked in the free left',
            tone: 'bad',
            ring: 2.6,
            side: north ? 'down' : 'up',
          });
          plugs++;
          const k = lanes[0].vehicles;
          const next = k[k.indexOf(f) - 1];
          if (next && next.moves[0] === 'L' && next.v < 0.5 && victims < 1 && !north) {
            out.push({
              kind: 'tag',
              id: `lv${next.id}`,
              ...at(next),
              text: 'Turning left, waiting for a light it doesn’t need',
              tone: 'warn',
              ring: 2.4,
              side: 'down',
            });
            victims++;
          }
        }
      } else if (mode === 'cost') {
        for (const lanes of approaches) {
          const f = plug(lanes);
          const k = lanes[0].vehicles;
          const stuck = f ? k.filter((v) => v !== f && v.moves[0] === 'L' && v.v < 0.5).length : 0;
          if (f && red(lanes[0]))
            out.push({
              kind: 'tag',
              id: `cb${lanes[0].id}`,
              ...at(f),
              text: stuck ? `Free left blocked · ${stuck} stuck behind` : 'Free left blocked',
              tone: 'bad',
              ring: 2.6,
            });
        }
        const d = w.metrics.avgTrip(w.t, 150, 'L').delay;
        if (d > 0) out.push({ kind: 'tag', id: 'ld', x: 0, y: 0, text: `Left-turners lose ${Math.round(d)} s each`, tone: 'warn', h: 0.6 });
      } else if (mode === 'fix') {
        // one left-turner at a time, followed until it has made the turn
        const turning = (v: Vehicle | undefined) => {
          if (!v || !v.alive || v.v < 2 || !v.lane.connector || v.lane.tag !== 'L') return false;
          const from = approaches.find((l) => l[0].moves?.L?.lane === v.lane);
          return !!from && red(from[0]);
        };
        if (!turning(lastTurner)) {
          lastTurner = undefined;
          for (const lanes of approaches) {
            const v = lanes[0].moves?.L?.lane.vehicles.find((x) => turning(x));
            if (v) lastTurner = v;
          }
        }
        if (lastTurner)
          // one label that moves to the next turner, rather than two overlapping
          out.push({ kind: 'tag', id: 'tl', ...at(lastTurner), text: 'Turns left on red: the lane is free', tone: 'good', ring: 2.4 });
        let shown = 0;
        for (const lanes of approaches) {
          if (!red(lanes[1]) || shown) continue;
          for (const l of [lanes[1], lanes[2]]) {
            const f = l.vehicles[l.vehicles.length - 1];
            if (!f || f.v > 0.5 || l.length - f.s > 6 || shown) continue;
            out.push({ kind: 'tag', id: `sw${f.id}`, ...at(f), text: 'Going straight: waits in a straight lane', tone: 'info', ring: 2.4, side: 'down' });
            shown++;
          }
        }
      } else if (mode === 'after') {
        for (const lanes of [approaches[0], approaches[2]]) {
          const f = plug(lanes);
          const p = kerbAt(lanes, 24);
          out.push({
            kind: 'tag',
            id: `fa${lanes[0].id}`,
            x: p.x,
            y: p.y,
            text: f ? 'Free left blocked' : 'Free left: flowing',
            tone: f ? 'bad' : 'good',
            h: 0.4,
          });
        }
        const d = w.metrics.avgTrip(w.t, 150, 'L').delay;
        if (d > 0) out.push({ kind: 'tag', id: 'ld', x: 0, y: 0, text: `Left-turners lose ${Math.round(d)} s each`, tone: 'good', h: 0.6 });
      }
      return out;
    };

    const sample = () => {
      const m = w.metrics;
      return {
        leftDelay: m.avgTrip(w.t, 150, 'L').delay,
        straightDelay: m.avgTrip(w.t, 150, 'S').delay,
        blocked: blockedEma,
        thru: m.throughputPerMin(w.t, 60, w.measureSince),
        lost: m.peopleSecLost / 60,
      };
    };
    return { world: w, vis, sample, annotate, colorBy };
  },
};
