// 02 · The Box — four signalised junctions, a few hundred metres of city grid.
// Status quo: drivers enter the junction on green even when their exit is full,
// get stuck inside the box, and block the cross street's green. The jam
// closes into a loop: gridlock.
// Swalpa adjust: wait at the line until there is space on the other side.

import { Rng } from '../core/rng.ts';
import { Signal } from '../core/signal.ts';
import { BLR_MIX } from '../core/types.ts';
import type { Pose } from '../core/geom.ts';
import { World, type Lane, type Vehicle } from '../core/world.ts';
import { Net, decorate, type JNode } from '../net.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE, ORANGE } from './palette.ts';

export const GX = 52;
export const GY = 42;
const EDGE_X = 158;
const EDGE_Y = 128;

export function buildGrid(seed: number, civicShare: number, rate = 0.12, name = 'gridlock', gateGreen = 6, sideShare = 0.8) {
  const w = new World({ seed, civicShare, name });
  const net = new Net(w);
  const sig = (offset: number) => ({ greenNS: 17, greenEW: 19, amber: 3, allRed: 2, offset });
  const nodeOpts = { half: 7.4, hatch: true, zebra: true };
  const TL = net.node(-GX, -GY, { ...nodeOpts, signal: sig(0) });
  const TR = net.node(GX, -GY, { ...nodeOpts, signal: sig(11) });
  const BL = net.node(-GX, GY, { ...nodeOpts, signal: sig(23) });
  const BR = net.node(GX, GY, { ...nodeOpts, signal: sig(34) });
  const ro = { lanes: 2, lanesBack: 2, median: 1.0, laneW: 3.3, vLimit: 12 };

  const roads = {
    hTopW: net.road({ x: -EDGE_X, y: -GY }, TL, ro),
    hTopM: net.road(TL, TR, ro),
    hTopE: net.road(TR, { x: EDGE_X, y: -GY }, ro),
    hBotW: net.road({ x: -EDGE_X, y: GY }, BL, ro),
    hBotM: net.road(BL, BR, ro),
    hBotE: net.road(BR, { x: EDGE_X, y: GY }, ro),
    vLeftN: net.road({ x: -GX, y: -EDGE_Y }, TL, ro),
    vLeftM: net.road(TL, BL, ro),
    vLeftS: net.road(BL, { x: -GX, y: EDGE_Y }, ro),
    vRightN: net.road({ x: GX, y: -EDGE_Y }, TR, ro),
    vRightM: net.road(TR, BR, ro),
    vRightS: net.road(BR, { x: GX, y: EDGE_Y }, ro),
  };
  net.build();

  const straight = () => ['S', 'S', 'S', 'S'] as 'S'[];
  // entries: fwd carriageway of edge-starting roads, back carriageway of edge-ending roads
  const entries = [
    net.source(roads.hTopW, 'fwd', rate, BLR_MIX, straight),
    net.source(roads.hBotW, 'fwd', rate, BLR_MIX, straight),
    net.source(roads.vLeftN, 'fwd', rate, BLR_MIX, straight),
    net.source(roads.vRightN, 'fwd', rate, BLR_MIX, straight),
    net.source(roads.hTopE, 'back', rate, BLR_MIX, straight),
    net.source(roads.hBotE, 'back', rate, BLR_MIX, straight),
    net.source(roads.vLeftS, 'back', rate, BLR_MIX, straight),
    net.source(roads.vRightS, 'back', rate, BLR_MIX, straight),
  ];
  for (const e of entries) e.rate = rate * 2; // per carriageway (2 lanes)
  // remember which road each vehicle is on: 0 = main road (E–W), 1 = side street (N–S)
  entries.forEach((e, i) => {
    const side = i % 4 >= 2 ? 1 : 0;
    e.onSpawn = (v) => {
      v.flags.road = side;
    };
  });

  // the main road (E–W) is jammed further downstream: off-screen signals limit how
  // fast it drains. The side streets (N–S) have plenty of room — unless someone blocks the box.
  const exits: Lane[] = [...roads.hTopE.fwd!.lanes, ...roads.hBotE.fwd!.lanes, ...roads.hTopW.back!.lanes, ...roads.hBotW.back!.lanes];
  let k = 0;
  for (const lane of exits) {
    const gate = new Signal(
      100 + k,
      [
        { groups: [0], green: gateGreen },
        { groups: [1], green: 28 - gateGreen },
      ],
      2,
      1,
      (k * 7.3) % 30,
    );
    w.signals.push(gate);
    w.addStopLine(lane, lane.length - 3, gate, 0).hard = true;
    k++;
  }
  // side streets carry a bit less traffic than the main road
  for (const e of entries.slice(2, 4)) e.rate *= sideShare;
  for (const e of entries.slice(6, 8)) e.rate *= sideShare;

  const internal = new Set<Lane>();
  for (const r of [roads.hTopM, roads.hBotM, roads.vLeftM, roads.vRightM]) {
    for (const l of [...r.fwd!.lanes, ...r.back!.lanes]) internal.add(l);
  }
  const connectors: Lane[] = [];
  for (const n of net.nodes)
    for (const c of n.connectors) {
      internal.add(c);
      connectors.push(c);
    }
  w.watchLanes = internal;

  // visuals
  const vis = net.vis;
  vis.bounds = { minX: -128, maxX: 128, minY: -84, maxY: 84 };
  decorate(vis, new Rng(seed + 9), net.corridors(), { density: 0.62, maxH: 34 });
  return { w, net, vis, internal, connectors, entries, nodes: [TL, TR, BL, BR] };
}

/** Junction the guided story zooms in on. */
export const FOCUS_NODE = 2; // bottom-left

function gridDef(id: string, warmup: number, rate: number, gate: number): ScenarioDef {
  return {
    id,
    warmup,
    split: 'h',
    view: 'wipe',
    aspect: '16/11',
    speed: 3,
    camera: { pitch: 0.98 },
    metrics: [
      { key: 'thru', label: 'Vehicles out per minute', unit: '/min', better: 'higher', digits: 0, hero: true, up: 'more', down: 'fewer' },
      { key: 'sideThru', label: 'Side-street vehicles across per minute', unit: '/min', better: 'higher', digits: 0, up: 'more', down: 'fewer' },
      { key: 'inbox', label: 'Stuck inside junction boxes', unit: '', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
      { key: 'trip', label: 'Average trip time', unit: 's', better: 'lower', time: true, down: 'quicker', up: 'slower' },
      { key: 'frozen', label: 'Gridlocked for', unit: '', better: 'lower', clock: true, zero: 'never locks' },
      { key: 'lost', label: 'People-minutes lost', unit: 'min', better: 'lower', down: 'less', up: 'more' },
    ],
    build(seed, civicShare) {
      const g = buildGrid(seed, civicShare, rate, id, gate);
      const w = g.w;
      let frozenSince = -1;

      // ---- junction geometry: who is waiting where ----
      type Approach = { node: JNode; lane: Lane; conn: Lane; side: boolean; group: number };
      const approaches: Approach[] = [];
      for (const node of g.nodes)
        for (const cw of node.inbound) {
          const side = Math.abs(cw.dir.y) > Math.abs(cw.dir.x);
          for (const lane of cw.lanes) {
            const conn = lane.moves?.S?.lane;
            if (conn) approaches.push({ node, lane, conn, side, group: side ? 0 : 1 });
          }
        }
      const connNode = new Map<Lane, JNode>();
      for (const a of approaches) connNode.set(a.conn, a.node);
      /** stopped (for more than a moment) with part of the vehicle on the hatched box */
      const inBox = (v: Vehicle, node: JNode) =>
        v.lane.connector && v.v < 0.6 && v.stoppedFor > 2 && v.s > node.apron && v.s - v.len < node.apron + 2 * node.half;
      const stuckAt = (node: JNode) => node.connectors.flatMap((c) => c.vehicles.filter((v) => inBox(v, node)));
      const front = (a: Approach) => {
        const f = a.lane.vehicles[a.lane.vehicles.length - 1];
        return f && f.s > a.lane.length - 6 && f.v < 0.5 ? f : null;
      };
      const green = (a: Approach) => a.node.signal?.state(a.group) === 'G';

      // side-street vehicles that got across a junction, per minute
      const sideCross: number[] = [];
      const crossed = new Set<Vehicle>();
      w.hooks.afterStep = (world) => {
        for (const c of connNode.keys())
          for (const v of c.vehicles) {
            if (v.flags.road !== 1 || crossed.has(v) || v.s < c.length - 1) continue;
            crossed.add(v);
            if (world.t >= world.measureSince) sideCross.push(world.t);
          }
        if (crossed.size > 400) for (const v of crossed) if (!v.alive || !v.lane.connector) crossed.delete(v);
        while (sideCross.length && sideCross[0] < world.t - 60) sideCross.shift();
      };

      // ---- explanation: colours and call-outs ----
      const colorBy = (v: Vehicle) => (v.flags.road === 1 ? ORANGE : BLUE);
      const pose: Pose = { x: 0, y: 0, h: 0 };
      const at = (v: Vehicle) => (v.pose(pose), { x: pose.x, y: pose.y });
      const focus = g.nodes[FOCUS_NODE];
      const annotate = (mode: string): Annotation[] => {
        const out: Annotation[] = [];
        if (mode === 'setup' || mode === 'setup-phone') {
          out.push({ kind: 'tag', id: 'main', x: -82, y: -GY + 3.6, text: 'Main road: jammed further on', tone: 'info', side: 'down', h: 0.4 });
          if (mode === 'setup')
            out.push({ kind: 'tag', id: 'side', x: -GX - 3.6, y: -62, text: 'Side street: clear beyond the junction', tone: 'info', h: 0.4 });
          out.push({ kind: 'tag', id: 'box', x: -GX, y: GY, text: 'Yellow box: keep it clear', tone: 'warn', h: 0.4 });
        } else if (mode === 'problems') {
          // main-road vehicles stopped inside the box: label the one nearest the middle (and one more if well apart)
          const stuck = stuckAt(focus).filter((v) => v.flags.road === 0);
          const d = (v: Vehicle) => (v.pose(pose), Math.hypot(pose.x - focus.x, pose.y - focus.y));
          stuck.sort((p, q) => d(p) - d(q));
          const shown: { x: number; y: number }[] = [];
          for (const v of stuck) {
            const p = at(v);
            if (shown.length >= 2 || shown.some((q) => Math.abs(q.x - p.x) < 12)) continue;
            shown.push(p);
            out.push({ kind: 'tag', id: `sb${v.id}`, ...p, text: 'Stuck in the box', tone: 'bad', ring: 3.4 });
          }
          // a side-street driver with a green light and room beyond, held up only by the blocked box
          if (stuck.length) {
            const cands = approaches.filter((a) => a.node === focus && a.side && green(a));
            cands.sort((p, q) => p.conn.path.start().y - q.conn.path.start().y).reverse(); // from the south first: label below
            for (const a of cands) {
              const f = front(a);
              if (!f || w.exitSpace(a.conn.next[0]).free < f.len + 3) continue;
              const south = a.conn.path.start().y > focus.y;
              out.push({ kind: 'tag', id: `gb${f.id}`, ...at(f), text: 'Green light, but it can’t cross', tone: 'warn', ring: 3, side: south ? 'down' : 'up' });
              break;
            }
          }
        } else if (mode === 'cost') {
          for (const node of g.nodes) {
            const k = stuckAt(node).length;
            if (k >= 3)
              out.push({ kind: 'tag', id: `jb${node.x},${node.y}`, x: node.x, y: node.y, text: `Box blocked · ${k} stuck`, tone: 'bad', ring: 7, h: 0.5 });
          }
          const fz = frozenSince >= 0 ? w.t - frozenSince : 0;
          const mm = `${Math.floor(fz / 60)}:${String(Math.floor(fz % 60)).padStart(2, '0')}`;
          out.push({
            kind: 'tag',
            id: 'timer',
            x: -GX,
            y: 0,
            text: fz > 0 ? `Gridlock: nothing has moved for ${mm}` : 'Junctions locking each other up',
            tone: 'bad',
            h: 0.6,
          });
        } else if (mode === 'fix') {
          let n = 0;
          for (const a of approaches) {
            if (a.node !== focus || n >= 2 || !green(a)) continue;
            const f = front(a);
            if (!f || !f.civic) continue;
            const room = w.exitSpace(a.conn.next[0]).free;
            if (room >= f.len + f.s0 + 1) continue;
            out.push({ kind: 'tag', id: `wl${f.id}`, ...at(f), text: 'Waits: no room on the other side', tone: 'good', ring: 3, side: n ? 'down' : 'up' });
            n++;
          }
          const mover = focus.connectors.flatMap((c) => c.vehicles).find((v) => v.flags.road === 1 && v.v > 2);
          if (mover) out.push({ kind: 'tag', id: `sm${mover.id}`, ...at(mover), text: 'Side street crosses', tone: 'good', ring: 2.6 });
          if (!stuckAt(focus).length)
            out.push({ kind: 'tag', id: 'clear', x: focus.x - focus.half + 3, y: focus.y + focus.half, text: 'Box clear', tone: 'good', side: 'down', h: 0 });
        } else if (mode === 'after') {
          for (const node of g.nodes) {
            const k = stuckAt(node).length;
            out.push({
              kind: 'tag',
              id: `jc${node.x},${node.y}`,
              x: node.x,
              y: node.y,
              text: k ? `${k} in the box` : 'Box clear',
              tone: k ? 'warn' : 'good',
              h: 0.5,
            });
          }
          out.push({ kind: 'tag', id: 'still', x: -82, y: -GY + 3.6, text: 'Still slow: jammed further on', tone: 'info', side: 'down', h: 0.4 });
        }
        return out;
      };

      const sample = () => {
        let inbox = 0;
        for (const node of g.nodes) inbox += stuckAt(node).length;
        const m = w.metrics;
        if (m.gridlocked) {
          if (frozenSince < 0) frozenSince = m.movingSince;
        } else frozenSince = -1;
        const span = Math.min(60, w.t - w.measureSince);
        return {
          thru: m.throughputPerMin(w.t, 60, w.measureSince),
          sideThru: span > 1 ? (sideCross.length / span) * 60 : 0,
          inbox,
          trip: m.avgTrip(w.t, 150).travel,
          frozen: frozenSince >= 0 ? w.t - frozenSince : 0,
          lost: m.peopleSecLost / 60,
        };
      };
      return { world: w, vis: g.vis, sample, annotate, colorBy };
    },
  };
}

export const gridlock = gridDef('gridlock', 440, 0.13, 5);
/** Hero variant: a little more pressure so the status quo visibly locks up within a minute. */
export const hero = gridDef('hero', 330, 0.13, 5);
