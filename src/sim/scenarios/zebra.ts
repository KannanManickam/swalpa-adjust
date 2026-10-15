// 06 · Red Means Red — a signalised pedestrian crossing on a busy two-way road.
// Status quo: drivers jump the amber and the first seconds of red, and stop on
// the zebra; pedestrians give up waiting and dart across through gaps, often
// away from the crossing. Everyone brakes for everyone.
// Swalpa adjust: stop behind the line on amber; walk on the walk signal.

import { Rng } from '../core/rng.ts';
import { Signal } from '../core/signal.ts';
import { BLR_MIX } from '../core/types.ts';
import type { Pose } from '../core/geom.ts';
import { World, type Lane, type Ped, type Vehicle } from '../core/world.ts';
import { Net, decorate } from '../net.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE, ORANGE } from './palette.ts';

const JUMP_RED = 0xe2364a;

const X0 = -175;
const X1 = 175;
const LW = 3.3;
const MED = 1.2;
const EDGE = MED / 2 + 2 * LW; // 7.2
const STOP = 4.6; // stop lines at x = ±STOP
const PED_COLORS = [0xe11d48, 0xf59e0b, 0x22c55e, 0x3b82f6, 0xa855f7, 0xec4899, 0xf97316, 0x14b8a6, 0xfacc15, 0xffffff, 0x0ea5e9];

export const zebra: ScenarioDef = {
  id: 'zebra',
  warmup: 60,
  split: 'v',
  view: 'split',
  aspect: '16/8.5',
  speed: 1.6,
  camera: { pitch: 1.12 },
  metrics: [
    { key: 'near', label: 'Near misses with people walking', unit: '', better: 'lower', hero: true, digits: 0, down: 'fewer', up: 'more' },
    { key: 'jumps', label: 'Vehicles running amber or red', unit: '', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'jay', label: 'People crossing away from the zebra', unit: '%', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'pedWait', label: 'Average wait to cross', unit: 's', better: 'lower', down: 'shorter', up: 'longer' },
    { key: 'thru', label: 'Vehicles through per minute', unit: '/min', better: 'higher', digits: 0, up: 'more', down: 'fewer' },
    { key: 'lost', label: 'People-minutes lost (in vehicles)', unit: 'min', better: 'lower', down: 'less', up: 'more' },
  ],
  build(seed, civicShare) {
    const w = new World({ seed, civicShare, name: 'zebra' });
    const net = new Net(w);
    const road = net.road({ x: X0, y: 0 }, { x: X1, y: 0 }, { lanes: 2, lanesBack: 2, median: MED, vLimit: 13 });
    net.build();
    const east = road.fwd!.lanes; // kerb lane at y = -5.55
    const west = road.back!.lanes; // kerb lane at y = +5.55
    const sig = new Signal(
      1,
      [
        { groups: [1], green: 26 },
        { groups: [0], green: 11 },
      ],
      3,
      2,
      4,
    );
    w.signals.push(sig);
    const sAt = (lane: Lane, x: number) => (east.includes(lane) ? x - X0 : X1 - x);
    for (const l of east) w.addStopLine(l, sAt(l, -STOP), sig, 1).encroach = 4.2;
    for (const l of west) w.addStopLine(l, sAt(l, STOP), sig, 1).encroach = 4.2;
    net.source(road, 'fwd', 0.44, BLR_MIX);
    net.source(road, 'back', 0.44, BLR_MIX);

    const laneY = (l: Lane) => l.path.pose(10).y;
    const bands = [...east, ...west].map((l) => ({ lane: l, y: laneY(l) }));

    // ---- pedestrians ----
    const pr = new Rng(seed * 31 + 7);
    const peds = w.peds;
    let pedId = 1;
    let nextPed = [pr.exp(0.11), pr.exp(0.11)];
    let nearMisses = 0;
    let crossings = 0;
    let jaywalks = 0;
    const waits: number[] = [];
    const nmKeys = new Set<string>();

    const spawnPed = (side: 0 | 1) => {
      const u = pr.next();
      const jayU = pr.next();
      const xU = pr.next();
      const patience = 6 + pr.next() * 16;
      const color = PED_COLORS[Math.floor(pr.next() * PED_COLORS.length)];
      const speed = 1.2 + pr.next() * 0.35;
      const civic = u < w.civicShare;
      const jay = !civic && jayU < 0.42;
      // people who give up on the signal cross wherever they are: within sight of the crossing (12–80 m away)
      const x = jay ? (xU < 0.5 ? -1 : 1) * (12 + (xU < 0.5 ? xU : xU - 0.5) * 2 * 68) : -1.6 + xU * 3.2;
      const dir: 1 | -1 = side === 0 ? 1 : -1;
      const y0 = -dir * (EDGE + 4.6);
      const p: Ped = {
        id: pedId++,
        x,
        y: y0,
        h: 0,
        vx: 0,
        vy: 0,
        civic,
        color,
        state: 'arrive',
        t: 0,
        waited: 0,
        patience,
        dir,
        speed,
        phase: pr.next() * 6,
        alive: true,
        danger: 0,
      };
      peds.push(p);
      if (jay) jaywalks++;
    };

    // which carriageway band is the pedestrian about to enter?
    const bandAhead = (p: Ped) => {
      const yNext = p.y + p.dir * 1.0;
      for (const b of bands) if (Math.abs(yNext - b.y) < LW / 2 + 0.3 && Math.abs(p.y - b.y) >= LW / 2 + 0.3) return b;
      return null;
    };
    const bandsAt = (p: Ped) => bands.filter((b) => Math.abs(p.y - b.y) < LW / 2 + 0.45);
    const gapOk = (lane: Lane, s: number, accept: number) => {
      // nearest vehicle approaching s in this lane
      let best: { d: number; v: number } | null = null;
      for (const v of lane.vehicles) {
        const d = s - 0.6 - v.s;
        if (d < -v.len) continue;
        if (d < 0) return false; // vehicle is on the crossing line right now
        if (!best || d < best.d) best = { d, v: v.v };
      }
      if (!best) return true;
      if (best.d > 70) return true;
      return best.v < 0.5 ? best.d > 2 : best.d / best.v > accept;
    };

    w.hooks.preAccel = (world) => {
      for (const p of peds) {
        if (p.state !== 'cross' && p.state !== 'refuge') continue;
        for (const b of bandsAt(p)) {
          const s = sAt(b.lane, p.x);
          b.lane.obstacles.push({ sRear: s - 0.7, sFront: s + 0.7, v: 0, kind: 'ped', owner: p });
          // near miss: a vehicle that cannot stop comfortably for this person
          for (const v of b.lane.vehicles) {
            const d = s - 0.7 - v.s;
            if (d < 0 || d > 40) continue;
            if (v.v > 3.5 && d < (v.v * v.v) / (2 * 5) + 1.5) {
              const key = `${p.id}:${b.lane.id}`;
              if (!nmKeys.has(key)) {
                nmKeys.add(key);
                nearMisses++;
                p.danger = 1;
                world.events.push({ kind: 'nearmiss', x: p.x, y: p.y, t: world.t, civic: v.civic });
              }
            }
          }
        }
      }
    };

    w.hooks.afterStep = (world) => {
      const dt = world.dt;
      for (let i = 0; i < 2; i++) {
        while (world.t >= nextPed[i]) {
          spawnPed(i as 0 | 1);
          nextPed[i] += pr.exp(0.11);
        }
      }
      const walk = sig.state(0) === 'G';
      const walkLeft = sig.remaining();
      for (const p of peds) {
        p.t += dt;
        p.danger = Math.max(0, p.danger - dt * 0.6);
        let vy = 0;
        let vx = 0;
        const kerbY = -p.dir * (EDGE + 0.9);
        if (p.state === 'arrive') {
          vy = p.dir * p.speed;
          if ((p.dir > 0 && p.y >= kerbY) || (p.dir < 0 && p.y <= kerbY)) {
            p.state = 'wait';
            p.t = 0;
          }
        } else if (p.state === 'wait' || p.state === 'refuge') {
          p.waited += dt;
          const onZebra = Math.abs(p.x) < 3;
          let go = false;
          if (onZebra && walk && (p.state === 'refuge' || walkLeft > 3)) go = true;
          else if (!p.civic && (p.waited > p.patience || !onZebra)) {
            const b = bandAhead(p);
            const accept = 1.6 + (p.id % 5) * 0.35;
            go = !b || gapOk(b.lane, sAt(b.lane, p.x), accept);
          } else if (p.state === 'refuge' && p.civic && walk) go = true;
          if (go) {
            if (p.state === 'wait') {
              crossings++;
              waits.push(p.waited);
              if (waits.length > 60) waits.shift();
            }
            p.state = 'cross';
            p.t = 0;
          }
        } else if (p.state === 'cross') {
          // stop at the median refuge if the next band is not safe (selfish) or the walk phase ended (civic)
          const b = bandAhead(p);
          const atMedian = Math.abs(p.y) < 0.9;
          if (atMedian && !p.civic && b && !gapOk(b.lane, sAt(b.lane, p.x), 1.4)) {
            p.state = 'refuge';
          } else {
            // squeezing around a vehicle stopped on the zebra slows you down
            let slow = 1;
            for (const bb of bandsAt(p)) {
              const s = sAt(bb.lane, p.x);
              for (const v of bb.lane.vehicles) if (v.s > s - 0.5 && v.s - v.len < s + 0.5) slow = 0.35;
            }
            vy = p.dir * p.speed * slow;
          }
          if ((p.dir > 0 && p.y > EDGE + 0.9) || (p.dir < 0 && p.y < -EDGE - 0.9)) {
            p.state = 'leave';
            p.t = 0;
          }
        } else if (p.state === 'leave') {
          vy = p.dir * p.speed * 0.6;
          vx = (p.id % 2 ? 1 : -1) * p.speed * 0.8;
          if (p.t > 9) p.alive = false;
        }
        p.vx = vx;
        p.vy = vy;
        p.x += vx * dt;
        p.y += vy * dt;
        if (vx || vy) {
          p.h = Math.atan2(vy, vx);
          p.phase += dt * 9;
        }
      }
      for (let i = peds.length - 1; i >= 0; i--) if (!peds[i].alive) peds.splice(i, 1);
    };

    // ---- visuals ----
    const vis = net.vis;
    vis.zebras.push({ a: { x: 0, y: -EDGE }, b: { x: 0, y: EDGE }, depth: 4.2 });
    vis.stopLines.push({ a: { x: -STOP, y: -EDGE }, b: { x: -STOP, y: -MED / 2 } });
    vis.stopLines.push({ a: { x: STOP, y: MED / 2 }, b: { x: STOP, y: EDGE } });
    vis.signals.push({ x: -STOP - 0.6, y: -EDGE - 0.8, h: 0, signal: sig, group: 1 });
    vis.signals.push({ x: STOP + 0.6, y: EDGE + 0.8, h: Math.PI, signal: sig, group: 1 });
    vis.signals.push({ x: -STOP - 0.6, y: -0.2, h: 0, signal: sig, group: 1 });
    vis.signals.push({ x: STOP + 0.6, y: 0.2, h: Math.PI, signal: sig, group: 1 });
    // median gap at the crossing
    vis.medians = vis.medians.flatMap((m) => [
      { pts: [m.pts[0], { x: -2.4, y: 0 }], width: m.width },
      { pts: [{ x: 2.4, y: 0 }, m.pts[1]], width: m.width },
    ]);
    vis.labels.push({ x: 0, y: -EDGE - 8, text: 'Zebra crossing', sub: 'signal-controlled', kind: 'place' });
    vis.trees = vis.trees.filter((t) => Math.abs(t.x) > 9);
    vis.lamps = vis.lamps.filter((t) => Math.abs(t.x) > 6);
    vis.bounds = { minX: -95, maxX: 95, minY: -19, maxY: 19 };
    decorate(vis, new Rng(seed + 13), net.corridors(), { density: 0.55, maxH: 22 });

    // ---- who runs the light: crossing the stop line on red, or on amber when they could have stopped ----
    const lineOf = (l: Lane) => l.stopLines[0].s;
    const lanes = [...east, ...west];
    const prevS = new Map<Vehicle, number>();
    let lightWas = sig.state(1);
    let jumps = 0;
    let speedEma = 0;
    const prevAfter = w.hooks.afterStep;
    w.hooks.afterStep = (world) => {
      prevAfter(world);
      speedEma += (world.metrics.meanSpeed * 3.6 - speedEma) * (world.dt / 15);
      const light = sig.state(1);
      if (light === 'Y' && lightWas === 'G') {
        // amber just came on: who could still stop comfortably?
        for (const l of lanes)
          for (const v of l.vehicles) {
            const d = lineOf(l) - v.s;
            if (d > 0 && d < 150) v.flags.couldStop = v.v < 1 || d > (v.v * v.v) / (2 * 3.2) + 1 ? 1 : 0;
          }
      }
      lightWas = light;
      for (const l of lanes)
        for (const v of l.vehicles) {
          const line = lineOf(l);
          const before = prevS.get(v);
          prevS.set(v, v.s);
          if (before === undefined || before >= line || v.s < line) continue;
          if (light === 'R' || (light === 'Y' && v.flags.couldStop)) {
            v.flags.jumped = light === 'R' ? 2 : 1;
            v.flags.jumpT = world.t;
            jumps++;
          }
        }
      if (prevS.size > 300) for (const v of prevS.keys()) if (!v.alive) prevS.delete(v);
    };

    // ---- explanation: colours and call-outs ----
    const onZebra = (v: Vehicle) => v.v < 0.5 && v.s > lineOf(v.lane) + 0.8 && v.s < lineOf(v.lane) + 7;
    const colorBy = (v: Vehicle) => (v.flags.bg ? null : v.flags.jumped ? JUMP_RED : onZebra(v) ? ORANGE : BLUE);
    const pose: Pose = { x: 0, y: 0, h: 0 };
    const at = (v: Vehicle) => (v.pose(pose), { x: pose.x, y: pose.y });
    const jaywalking = (p: Ped) => (p.state === 'cross' || p.state === 'refuge') && Math.abs(p.x) > 5;
    const annotate = (mode: string): Annotation[] => {
      const out: Annotation[] = [];
      const recentJumper = () => lanes.flatMap((l) => l.vehicles).find((v) => v.flags.jumped && w.t - v.flags.jumpT < 3);
      if (mode === 'setup') {
        out.push({ kind: 'tag', id: 'line', x: -STOP, y: -EDGE + 1.6, text: 'Stop line: wait behind it', tone: 'info', side: 'down', h: 0.4 });
        out.push({ kind: 'tag', id: 'walk', x: 0, y: EDGE + 2.6, text: 'People cross here on the walk signal', tone: 'good', side: 'down', h: 0.4 });
      } else if (mode === 'problems' || mode === 'cost') {
        const j = recentJumper();
        if (j)
          out.push({
            kind: 'tag',
            id: `jr${j.id}`,
            ...at(j),
            text: j.flags.jumped === 2 ? 'Jumps the red' : 'Speeds through the amber',
            tone: 'bad',
            ring: 2.6,
          });
        if (mode === 'problems') {
          const z = lanes.flatMap((l) => l.vehicles).find(onZebra);
          if (z) out.push({ kind: 'tag', id: `zb${z.id}`, ...at(z), text: 'Stops on the zebra', tone: 'warn', ring: 2.4, side: 'down' });
        }
        let k = 0;
        for (const p of peds) {
          if (p.danger > 0.4) out.push({ kind: 'tag', id: `nm${p.id}`, x: p.x, y: p.y, text: 'Near miss', tone: 'bad', ring: 2.2, h: 1.6 });
          else if (jaywalking(p) && k < (mode === 'cost' ? 2 : 1)) {
            out.push({
              kind: 'tag',
              id: `jw${p.id}`,
              x: p.x,
              y: p.y,
              text: 'Gives up waiting, crosses away from the zebra',
              tone: 'warn',
              ring: 1.6,
              h: 1.6,
              side: p.y > 0 ? 'down' : 'up',
            });
            k++;
          }
        }
        if (mode === 'cost')
          out.push({ kind: 'tag', id: 'count', x: 0, y: EDGE + 3.5, text: `${nearMisses} near misses so far`, tone: 'bad', side: 'down', h: 0.4 });
      } else if (mode === 'fix') {
        const red = sig.state(1) !== 'G';
        for (const l of lanes) {
          const f = l.vehicles[l.vehicles.length - 1];
          if (red && f && f.v < 0.5 && f.s <= lineOf(l) + 0.3 && lineOf(l) - f.s < 6) {
            out.push({
              kind: 'tag',
              id: `sb${f.id}`,
              ...at(f),
              text: 'Stops behind the line',
              tone: 'good',
              ring: 2.4,
              side: east.includes(l) ? 'up' : 'down',
            });
            break;
          }
        }
        const walker = peds.find((p) => p.state === 'cross' && Math.abs(p.x) < 3 && sig.state(0) !== 'R');
        if (walker)
          out.push({
            kind: 'tag',
            id: `wk${walker.id}`,
            x: walker.x,
            y: walker.y,
            text: 'Walks on the walk signal',
            tone: 'good',
            ring: 1.6,
            h: 1.6,
            side: walker.y > 0 ? 'down' : 'up',
          });
        const waiting = peds.filter((p) => p.state === 'wait' && Math.abs(p.x) < 3).length;
        if (!walker && waiting)
          out.push({ kind: 'tag', id: 'wait', x: 0, y: -EDGE - 3.5, text: `${waiting} waiting for the walk signal`, tone: 'info', h: 0.4 });
      } else if (mode === 'after') {
        out.push({
          kind: 'tag',
          id: 'count',
          x: 0,
          y: EDGE + 3.5,
          text: nearMisses ? `${nearMisses} near misses so far` : 'No near misses',
          tone: nearMisses ? 'bad' : 'good',
          side: 'down',
          h: 0.4,
        });
      }
      return out;
    };
    const sample = () => ({
      near: nearMisses,
      jumps,
      pedWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0,
      jay: crossings ? (jaywalks / Math.max(1, crossings + peds.filter((p) => p.state === 'wait').length)) * 100 : 0,
      thru: w.metrics.throughputPerMin(w.t, 60, w.measureSince),
      lost: w.metrics.peopleSecLost / 60,
    });
    return { world: w, vis, sample, annotate, colorBy };
  },
};
