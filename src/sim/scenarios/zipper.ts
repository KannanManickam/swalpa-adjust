// 01 · The Zipper — a lane drop at Namma Metro barricades.
// Status quo: some merge early, the rest race to the end and nose in; the
// through lane refuses to open gaps, so the merge point keeps stalling.
// Swalpa adjust: use both lanes to the end, then one-by-one at speed.

import { Rng } from '../core/rng.ts';
import { BLR_MIX, CIVIC, SELFISH } from '../core/types.ts';
import type { Pose } from '../core/geom.ts';
import { World, type Vehicle } from '../core/world.ts';
import { Net, decorate } from '../net.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE, GREY, ORANGE } from './palette.ts';

const MERGE_X = 25;
const X0 = -205;
const X1 = 175;

const LANE_BLUE = BLUE;
const LANE_ORANGE = ORANGE;
const BG_GREY = GREY;

export const zipper: ScenarioDef = {
  id: 'zipper',
  warmup: 480,
  split: 'v',
  view: 'split',
  aspect: '16/8',
  speed: 2.2,
  camera: { pitch: 1.12 },
  metrics: [
    { key: 'queue', label: 'Queue behind the barricade', unit: 'm', better: 'lower', hero: true, down: 'shorter', up: 'longer' },
    { key: 'thru', label: 'Vehicles through per minute', unit: '/min', better: 'higher', digits: 1, up: 'more', down: 'fewer' },
    { key: 'trip', label: 'Average time to pass', unit: 's', better: 'lower', time: true, down: 'quicker', up: 'slower' },
    { key: 'forced', label: 'Stand-offs & forced nose-ins', unit: '', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'lost', label: 'People-minutes lost', unit: 'min', better: 'lower', down: 'less', up: 'more' },
  ],
  build(seed, civicShare) {
    // Same car-following for both worlds: only the merging behaviour differs.
    const w = new World({
      seed,
      civicShare,
      name: 'zipper',
      selfish: { ...SELFISH, Tmul: 0.85, s0mul: 0.85, react: 0.95 },
      civic: { ...CIVIC, Tmul: 0.85, s0mul: 0.85, react: 0.95 },
    });
    const net = new Net(w);
    const road = net.road({ x: X0, y: 0 }, { x: X1, y: 0 }, { lanes: 2, lanesBack: 2, median: 1.2, vLimit: 12.5 });
    net.build();
    const [A, B] = road.fwd!.lanes; // A = kerb lane (continues), B = median lane (ends)
    const mergeS = MERGE_X - X0;
    B.path = B.path.slice(0, mergeS);
    B.length = B.path.length;
    B.endWall = true;
    B.exit = false;
    B.left[0].to = B.length;
    A.right[0].to = B.length;

    // traffic
    const src = net.source(road, 'fwd', 0.55, BLR_MIX);
    src.pickLane = (p) => (p.laneU < 0.5 ? A : B);
    // remember which lane each vehicle started in, so it can be coloured by it
    src.onSpawn = (v) => {
      v.flags.origin = v.lane === A ? 0 : 1;
    };
    const bg = net.source(road, 'back', 0.32, BLR_MIX);
    bg.bg = true;

    w.hooks.mergeZone = (_w, v) => (v.civic ? 22 : v.traits[5] < 0.3 ? 240 : 9);

    // ---- visuals ----
    const vis = net.vis;
    // barricade taper + run along the lane boundary
    const yMed = -0.6;
    const yBound = -3.9;
    const taper0 = MERGE_X - 12;
    vis.barricades.push({ a: { x: taper0, y: yMed - 0.2 }, b: { x: MERGE_X + 2, y: yBound } });
    vis.barricades.push({ a: { x: MERGE_X + 2, y: yBound }, b: { x: X1 + 2, y: yBound } });
    for (let x = taper0 - 26; x < taper0; x += 4.5) vis.cones.push({ x, y: -2.25 + (x - taper0) * 0.0 });
    vis.metro = {
      pts: [
        { x: MERGE_X + 22, y: -2.0 },
        { x: X1 + 20, y: -2.0 },
      ],
      height: 0,
      pillarEvery: 34,
      color: 0x7c3aed,
    };
    vis.texts.push({ x: MERGE_X - 70, y: -2.25, h: 0, text: 'MERGE AHEAD', color: 'yellow' });
    vis.bounds = { minX: -112, maxX: 68, minY: -19, maxY: 14 };
    decorate(vis, new Rng(seed + 5), net.corridors(), { density: 0.55, maxH: 22 });

    let queueEma = 0;
    let waiting = 0;
    w.hooks.afterStep = (world) => {
      let minS = Infinity;
      let n = 0;
      for (const lane of [A, B]) {
        for (const v of lane.vehicles) {
          if (v.s < mergeS - 1 && v.v < 2.5) {
            n++;
            if (v.s < minS) minS = v.s;
          }
        }
      }
      const q = (minS === Infinity ? 0 : mergeS - minS) + src.queue.length * 5.2;
      queueEma += (q - queueEma) * Math.min(1, world.dt / 4);
      waiting += (n + src.queue.length - waiting) * Math.min(1, world.dt / 2);
    };

    // ---- explanation: colours and call-outs ----
    const colorBy = (v: Vehicle) => (v.flags.bg ? BG_GREY : v.flags.origin === 1 ? LANE_ORANGE : LANE_BLUE);
    const pose: Pose = { x: 0, y: 0, h: 0 };
    let shortQ = false;
    const annotate = (mode: string): Annotation[] => {
      const out: Annotation[] = [];
      const good = w.civicShare >= 0.5;
      if (mode === 'setup') {
        out.push({ kind: 'tag', id: 'ends', x: MERGE_X - 1, y: -2.25, text: 'Lane closes here', tone: 'warn', ring: 3.4 });
        out.push({ kind: 'tag', id: 'laneA', x: -62, y: -5.55, text: 'Blue lane carries on', tone: 'info', h: 0.4 });
        out.push({ kind: 'tag', id: 'laneB', x: -62, y: -2.25, text: 'Orange lane has to merge', tone: 'warn', side: 'down', h: 0.4 });
      } else if (mode === 'problems') {
        out.push({ kind: 'tag', id: 'mp', x: MERGE_X - 4, y: -8.6, text: 'Merge point', tone: 'info', h: 0 });
        let so = 0;
        let fo = 0;
        let early = 0;
        let brake: Vehicle | null = null;
        for (const lane of [A, B]) {
          for (const v of lane.vehicles) {
            if (v.flags.bg) continue;
            if (v.standoff > 0 && so < 2) {
              v.pose(pose);
              out.push({ kind: 'tag', id: `so${v.id}`, x: pose.x, y: pose.y, text: 'Stand-off: both stop', tone: 'bad', ring: 3.8 });
              so++;
            } else if (v.lcActive && v.forced && fo < 2) {
              v.pose(pose);
              out.push({ kind: 'tag', id: `fo${v.id}`, x: pose.x, y: pose.y, text: 'Forces its way in', tone: 'warn', ring: 3.2 });
              fo++;
            } else if (v.lcActive && v.lcFrom === B && !v.forced && mergeS - (v.s + v.lcFromOffset) > 45 && early < 1) {
              v.pose(pose);
              out.push({ kind: 'tag', id: `ea${v.id}`, x: pose.x, y: pose.y, text: 'Merges early, leaves a lane empty', tone: 'info', side: 'down' });
              early++;
            } else if (lane === A && v.acc < -3 && v.s > mergeS - 70 && v.s < mergeS + 5 && (!brake || v.acc < brake.acc)) brake = v;
          }
        }
        if (brake) {
          brake.pose(pose);
          out.push({ kind: 'tag', id: `hb${brake.id}`, x: pose.x, y: pose.y, text: 'Slams the brakes', tone: 'bad', ring: 2.6, side: 'down' });
        }
      } else if (mode === 'queue') {
        const len = Math.round(queueEma);
        shortQ = shortQ ? len < 14 : len < 8;
        if (shortQ) out.push({ kind: 'tag', id: 'noq', x: MERGE_X - 20, y: -8.6, text: 'Barely any queue', tone: 'good', h: 0 });
        else {
          const tail = MERGE_X - queueEma;
          const x0 = Math.max(tail, vis.bounds.minX + 1.5);
          const more = tail < vis.bounds.minX ? ' and growing off-screen' : '';
          out.push({
            kind: 'bracket',
            id: 'q',
            x0,
            x1: MERGE_X,
            y: -8.8,
            text: `Queue ${len} m · ${Math.round(waiting)} ${Math.round(waiting) === 1 ? 'vehicle' : 'vehicles'} waiting${more}`,
            tone: good ? 'good' : 'bad',
          });
        }
      } else if (mode === 'zipper') {
        // badges follow the merge order the drivers have agreed on: one from each lane, in turn
        const chain: { x: number; y: number }[] = [];
        B.zipSeq
          .filter((v) => !v.flags.bg)
          .slice(0, 8)
          .forEach((v, i) => {
            v.pose(pose);
            chain.push({ x: pose.x, y: pose.y });
            out.push({ kind: 'badge', id: `z${v.id}`, x: pose.x, y: pose.y, text: String(i + 1), color: v.flags.origin === 1 ? '#ff8a1f' : '#2f6fed' });
          });
        if (chain.length > 1) out.push({ kind: 'chain', id: 'chain', pts: chain, tone: 'good' });
        out.push({ kind: 'tag', id: 'turns', x: MERGE_X - 6, y: -8.6, text: 'One from each lane, in turn', tone: 'good', h: 0 });
        out.push({ kind: 'tag', id: 'whole', x: -28, y: -2.25, text: 'Orange lane used right to the end', tone: 'good', side: 'down', h: 0.4 });
      }
      return out;
    };
    const sample = () => {
      const t = w.t;
      return {
        queue: queueEma,
        thru: w.metrics.throughputPerMin(t, 60, w.measureSince),
        trip: w.metrics.avgTrip(t, 120).travel,
        forced: w.metrics.forcedMerges + (w.metrics.custom.standoffs ?? 0),
        lost: w.metrics.peopleSecLost / 60,
      };
    };
    return { world: w, vis, sample, annotate, colorBy };
  },
};
