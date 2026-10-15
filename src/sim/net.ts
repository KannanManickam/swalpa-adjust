// Road-network builder: two-way roads, junctions (with signals, connectors,
// conflict zones, stop lines) plus the matching static visuals.

import { Path, add, len, leftOf, mul, norm, pathCrossings, sub, type Vec2 } from './core/geom.ts';
import { Signal } from './core/signal.ts';
import type { Move, Mix } from './core/types.ts';
import { Source, World, type Lane } from './core/world.ts';
import type { Rng } from './core/rng.ts';
import { emptyVisual, type VisualSpec } from './visual.ts';

export interface NodeOpts {
  half?: number; // half-size of the junction box
  apron?: number; // zebra/stop-line apron depth before the box
  signal?: { greenNS: number; greenEW: number; amber?: number; allRed?: number; offset?: number } | null;
  freeLeft?: boolean; // kerb lane may turn left on red (straight from kerb lane is illegal)
  turns?: Partial<Record<Move, boolean>>;
  hatch?: boolean; // yellow box markings
  zebra?: boolean;
}

export class JNode {
  x: number;
  y: number;
  half: number;
  apron: number;
  opts: NodeOpts;
  signal: Signal | null = null;
  inbound: Carriageway[] = [];
  outbound: Carriageway[] = [];
  connectors: Lane[] = [];
  constructor(x: number, y: number, opts: NodeOpts) {
    this.x = x;
    this.y = y;
    this.opts = opts;
    this.half = opts.half ?? 9;
    this.apron = opts.apron ?? (opts.zebra === false ? 1 : 4.5);
  }
}

export interface RoadOpts {
  lanes: number;
  lanesBack?: number; // 0 => one-way
  laneW?: number;
  median?: number;
  footpath?: number;
  vLimit?: number;
  tag?: string;
  trees?: boolean;
  lamps?: boolean;
}

export class Carriageway {
  lanes: Lane[] = [];
  dir: Vec2;
  a: Vec2; // median-line start (after trimming)
  b: Vec2;
  from: JNode | null;
  to: JNode | null;
  road: Road;
  constructor(road: Road, dir: Vec2, a: Vec2, b: Vec2, from: JNode | null, to: JNode | null) {
    this.road = road;
    this.dir = dir;
    this.a = a;
    this.b = b;
    this.from = from;
    this.to = to;
  }
}

export class Road {
  pa: Vec2;
  pb: Vec2;
  dir: Vec2;
  opts: Required<Omit<RoadOpts, 'tag'>> & { tag: string };
  fwd: Carriageway | null = null;
  back: Carriageway | null = null;
  constructor(pa: Vec2, pb: Vec2, opts: RoadOpts) {
    this.pa = pa;
    this.pb = pb;
    this.dir = norm(sub(pb, pa));
    this.opts = {
      lanes: opts.lanes,
      lanesBack: opts.lanesBack ?? opts.lanes,
      laneW: opts.laneW ?? 3.3,
      median: opts.median ?? (opts.lanesBack === 0 ? 0 : 1.2),
      footpath: opts.footpath ?? 2.6,
      vLimit: opts.vLimit ?? 13,
      tag: opts.tag ?? '',
      trees: opts.trees ?? true,
      lamps: opts.lamps ?? true,
    };
  }
  /** Offset of the left (fwd kerb) and right (back kerb) edges from the median line. */
  edges(): { left: number; right: number } {
    const o = this.opts;
    return { left: o.median / 2 + o.lanes * o.laneW, right: -(o.median / 2 + o.lanesBack * o.laneW) - (o.lanesBack === 0 ? o.median / 2 : 0) };
  }
}

const isNode = (x: JNode | Vec2): x is JNode => x instanceof JNode;

export class Net {
  w: World;
  vis: VisualSpec;
  nodes: JNode[] = [];
  roads: Road[] = [];
  private sigId = 1;

  constructor(w: World, vis: VisualSpec = emptyVisual()) {
    this.w = w;
    this.vis = vis;
  }

  node(x: number, y: number, opts: NodeOpts = {}): JNode {
    const n = new JNode(x, y, opts);
    this.nodes.push(n);
    return n;
  }

  road(a: JNode | Vec2, b: JNode | Vec2, opts: RoadOpts): Road {
    const pa = isNode(a) ? { x: a.x, y: a.y } : a;
    const pb = isNode(b) ? { x: b.x, y: b.y } : b;
    const road = new Road(pa, pb, opts);
    this.roads.push(road);
    const o = road.opts;
    const d = road.dir;
    const L = leftOf(d);
    const trimA = isNode(a) ? a.half + a.apron : 0;
    const trimB = isNode(b) ? b.half + b.apron : 0;
    const mA = add(pa, mul(d, trimA));
    const mB = sub(pb, mul(d, trimB));
    const singleOff = o.lanesBack === 0 ? -(o.lanes * o.laneW) / 2 - o.median / 2 : 0; // one-way roads centred on the line

    const mk = (n: number, from: Vec2, to: Vec2, dir: Vec2, nodeFrom: JNode | null, nodeTo: JNode | null): Carriageway => {
      const cw = new Carriageway(road, dir, from, to, nodeFrom, nodeTo);
      const LN = leftOf(dir);
      for (let i = 0; i < n; i++) {
        const off = o.median / 2 + (n - i - 0.5) * o.laneW + (dir === d ? singleOff : 0);
        const p = Path.line(add(from, mul(LN, off)), add(to, mul(LN, off)));
        const lane = this.w.addLane(p, o.laneW);
        lane.index = i;
        lane.vLimit = o.vLimit;
        lane.tag = o.tag;
        lane.group = `${this.roads.length}:${dir === d ? 'f' : 'b'}`;
        if (!nodeTo) lane.exit = true;
        cw.lanes.push(lane);
      }
      for (let i = 1; i < n; i++) this.w.neighbours(cw.lanes[i], cw.lanes[i - 1], 'left');
      if (nodeTo) nodeTo.inbound.push(cw);
      if (nodeFrom) nodeFrom.outbound.push(cw);
      return cw;
    };
    road.fwd = mk(o.lanes, mA, mB, d, isNode(a) ? a : null, isNode(b) ? b : null);
    if (o.lanesBack > 0) {
      road.back = mk(o.lanesBack, mB, mA, { x: -d.x, y: -d.y }, isNode(b) ? b : null, isNode(a) ? a : null);
    }

    // ---- visuals ----
    const ext = (p: Vec2, k: number) => add(p, mul(d, k));
    const vA = isNode(a) ? ext(pa, a.half) : pa;
    const vB = isNode(b) ? ext(pb, -b.half) : pb;
    const left = o.median / 2 + o.lanes * o.laneW + singleOff;
    const right = o.lanesBack > 0 ? -(o.median / 2 + o.lanesBack * o.laneW) : singleOff - o.median / 2;
    const at = (p: Vec2, off: number) => add(p, mul(L, off));
    this.vis.asphalt.push([at(vA, left), at(vB, left), at(vB, right), at(vA, right)]);
    // footpaths both sides
    const fp = o.footpath;
    if (fp > 0) {
      const fA = isNode(a) ? ext(pa, a.half) : pa;
      const fB = isNode(b) ? ext(pb, -b.half) : pb;
      this.vis.footpaths.push([at(fA, left + fp), at(fB, left + fp), at(fB, left), at(fA, left)]);
      this.vis.footpaths.push([at(fA, right), at(fB, right), at(fB, right - fp), at(fA, right - fp)]);
      this.vis.kerbs.push([at(fA, left), at(fB, left)]);
      this.vis.kerbs.push([at(fA, right), at(fB, right)]);
    }
    // median or centre line
    if (o.lanesBack > 0) {
      if (o.median >= 0.8) this.vis.medians.push({ pts: [ext(vA, 0), ext(vB, 0)], width: o.median });
      else this.vis.lines.push({ pts: [mA, mB], color: 'white', width: 0.15 });
    }
    // lane lines
    const laneLines = (cw: Carriageway | null) => {
      if (!cw) return;
      const LN = leftOf(cw.dir);
      const n = cw.lanes.length;
      for (let i = 1; i < n; i++) {
        const off = o.median / 2 + (n - i) * o.laneW + (cw.dir === d ? singleOff : 0);
        this.vis.lines.push({ pts: [add(cw.a, mul(LN, off)), add(cw.b, mul(LN, off))], color: 'white', width: 0.13, dash: [3, 4.5] });
      }
      // edge line near kerb
      const eo = o.median / 2 + n * o.laneW - 0.35 + (cw.dir === d ? singleOff : 0);
      this.vis.lines.push({ pts: [add(cw.a, mul(LN, eo)), add(cw.b, mul(LN, eo))], color: 'white', width: 0.1 });
    };
    laneLines(road.fwd);
    laneLines(road.back);
    // street furniture
    const total = len(sub(vB, vA));
    if (o.lamps && fp > 0) {
      for (let s = 12; s < total - 6; s += 30) {
        const p = add(vA, mul(d, s));
        this.vis.lamps.push(at(p, left + 0.6));
        this.vis.lamps.push(at(p, right - 0.6));
      }
    }
    if (o.trees && fp > 0) {
      for (let s = 6; s < total - 4; s += 17) {
        const p = add(vA, mul(d, s + ((s * 7.31) % 3)));
        const k = Math.floor(s / 17) % 7;
        const kind = k === 2 ? 'pink' : k === 5 ? 'gulmohar' : 'rain';
        this.vis.trees.push({ ...at(p, left + fp + 1.6), r: 3 + ((s * 3.7) % 1.6), kind });
        this.vis.trees.push({ ...at(add(p, mul(d, 5)), right - fp - 1.6), r: 3 + ((s * 5.3) % 1.6), kind: k === 4 ? 'pink' : 'rain' });
      }
    }
    return road;
  }

  /** Create connectors, signals, conflict zones and junction visuals. */
  build() {
    for (const node of this.nodes) this.buildNode(node);
    this.computeBounds();
  }

  private buildNode(node: JNode) {
    const w = this.w;
    const o = node.opts;
    const turns = { S: true, L: false, R: false, ...(o.turns ?? {}) };
    if (o.freeLeft) turns.L = true;
    if (o.signal) {
      const s = o.signal;
      node.signal = new Signal(
        this.sigId++,
        [
          { groups: [1], green: s.greenEW },
          { groups: [0], green: s.greenNS },
        ],
        s.amber ?? 3,
        s.allRed ?? 2,
        s.offset ?? 0,
      );
      w.signals.push(node.signal);
    }
    for (const cin of node.inbound) {
      const din = cin.dir;
      const group = Math.abs(din.x) > Math.abs(din.y) ? 1 : 0;
      for (const l of cin.lanes) l.moves = {};
      for (const cout of node.outbound) {
        if (cout.road === cin.road) continue;
        const dout = cout.dir;
        const cross = din.x * dout.y - din.y * dout.x;
        const dot = din.x * dout.x + din.y * dout.y;
        const move: Move = dot > 0.7 ? 'S' : cross < 0 ? 'L' : 'R';
        if (!turns[move]) continue;
        const nIn = cin.lanes.length;
        const nOut = cout.lanes.length;
        const pairs: [number, number, boolean][] = [];
        if (move === 'S') {
          for (let i = 0; i < Math.min(nIn, nOut); i++) {
            const kerbIllegal = !!o.freeLeft && i === 0;
            pairs.push([i + Math.max(0, nIn - nOut), i, !kerbIllegal]);
          }
          if (o.freeLeft && nIn > nOut) pairs.push([0, 0, false]);
        } else if (move === 'L') pairs.push([0, 0, true]);
        else pairs.push([nIn - 1, nOut - 1, true]);
        for (const [i, j, legal] of pairs) {
          const inL = cin.lanes[i];
          const outL = cout.lanes[j];
          if (inL.moves![move]) continue;
          const path = Path.connect(inL.path.end(), outL.path.start(), move === 'S' ? 4 : 28);
          const c = w.addLane(path, inL.width);
          c.connector = true;
          c.noLaneChange = true;
          c.vLimit = move === 'S' ? 12 : 6.5;
          c.next = [outL];
          c.tag = move;
          outL.feeds.push(c);
          inL.moves![move] = { lane: c, legal };
          node.connectors.push(c);
        }
      }
      // stop lines + signal posts
      if (node.signal) {
        for (const l of cin.lanes) {
          const moves: Move[] | undefined = o.freeLeft && l.index === 0 ? ['S', 'R'] : undefined;
          w.addStopLine(l, l.length - 0.05, node.signal, group, moves);
        }
        const LN = leftOf(din);
        const kerb = cin.lanes[0];
        const e = kerb.path.end();
        const n = cin.lanes.length;
        const ow = cin.road.opts.laneW;
        this.vis.signals.push({ x: e.x + LN.x * (ow / 2 + 1.0), y: e.y + LN.y * (ow / 2 + 1.0), h: Math.atan2(din.y, din.x), signal: node.signal, group });
        const med = cin.lanes[n - 1].path.end();
        this.vis.signals.push({ x: med.x - LN.x * (ow / 2 + 0.6), y: med.y - LN.y * (ow / 2 + 0.6), h: Math.atan2(din.y, din.x), signal: node.signal, group });
      }
      // stop line, arrows, zebra visuals
      const LN = leftOf(din);
      const n = cin.lanes.length;
      const ow = cin.road.opts.laneW;
      const k0 = cin.lanes[0].path.end();
      const kn = cin.lanes[n - 1].path.end();
      this.vis.stopLines.push({ a: add(k0, mul(LN, ow / 2)), b: add(kn, mul(LN, -ow / 2)) });
      for (const l of cin.lanes) {
        const mv = l.moves!;
        const legal = (m: Move) => !!mv[m]?.legal;
        const kind = legal('L') && legal('S') ? 'SL' : legal('L') ? 'L' : legal('R') && !legal('S') ? 'R' : 'S';
        const p = l.path.pose(l.length - 9);
        this.vis.arrows.push({ x: p.x, y: p.y, h: p.h, kind });
        if (o.freeLeft && l.index === 0) {
          const q = l.path.pose(l.length - 20);
          this.vis.texts.push({ x: q.x, y: q.y, h: q.h, text: 'FREE LEFT', color: 'yellow' });
        }
      }
      if (o.zebra !== false) {
        // full road width at the apron
        const road = cin.road;
        const e = road.edges();
        const center = add({ x: node.x, y: node.y }, mul(din, -(node.half + node.apron * 0.5)));
        const RL = leftOf(road.dir);
        // road.dir may be opposite to din; edges are relative to road.dir
        this.vis.zebras.push({ a: add(center, mul(RL, e.left)), b: add(center, mul(RL, e.right)), depth: node.apron - 1.2 });
      }
    }
    // box visual
    const h = node.half + 0.01;
    const box = [
      { x: node.x - h, y: node.y - h },
      { x: node.x + h, y: node.y - h },
      { x: node.x + h, y: node.y + h },
      { x: node.x - h, y: node.y + h },
    ];
    this.vis.boxes.push(box);
    if (o.hatch) this.vis.hatch.push(box);

    // conflict zones between connectors
    const cs = node.connectors;
    for (let i = 0; i < cs.length; i++) {
      for (let j = i + 1; j < cs.length; j++) {
        const a = cs[i];
        const b = cs[j];
        const sa = a.path.start();
        const sb = b.path.start();
        if (Math.hypot(sa.x - sb.x, sa.y - sb.y) < 0.5) continue; // same source lane (diverging)
        if (a.next[0] === b.next[0]) {
          const z = w.addZone('merge');
          a.zones.push({ zone: z, s: a.length - 2.5, w: 2.5 });
          b.zones.push({ zone: z, s: b.length - 2.5, w: 2.5 });
          continue;
        }
        for (const hit of pathCrossings(a.path, b.path)) {
          const z = w.addZone('cross');
          a.zones.push({ zone: z, s: hit.sa, w: 2.1 });
          b.zones.push({ zone: z, s: hit.sb, w: 2.1 });
        }
      }
    }
  }

  computeBounds(margin = 6) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const poly of [...this.vis.asphalt, ...this.vis.footpaths, ...this.vis.boxes]) {
      for (const p of poly) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    this.vis.bounds = { minX: minX - margin, minY: minY - margin, maxX: maxX + margin, maxY: maxY + margin };
  }

  /** Entry source on the carriageway of `road` that starts at a world edge. */
  source(road: Road, which: 'fwd' | 'back', rate: number, mix: Mix, moveGen?: (r: Rng) => Move[]): Source {
    const cw = which === 'fwd' ? road.fwd! : road.back!;
    const src = new Source(cw.lanes, rate, mix, moveGen);
    return this.w.addSource(src);
  }

  /** Corridors used to keep buildings off the roads. */
  corridors(): { a: Vec2; b: Vec2; r: number }[] {
    return this.roads.map((r) => {
      const e = r.edges();
      return { a: r.pa, b: r.pb, r: Math.max(e.left, -e.right) + r.opts.footpath + 1.5 };
    });
  }
}

/** Distance from point p to segment ab. */
export function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1)));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** Scatter buildings and trees over the free land inside `bounds`. */
export function decorate(
  vis: VisualSpec,
  rng: Rng,
  corridors: { a: Vec2; b: Vec2; r: number }[],
  opts: { density?: number; maxH?: number; minH?: number; extra?: number; avoid?: { x: number; y: number; r: number }[] } = {},
) {
  const { minX, minY, maxX, maxY } = vis.bounds;
  const pad = opts.extra ?? 0;
  const step = 15;
  const maxH = opts.maxH ?? 30;
  const minH = opts.minH ?? 5;
  const density = opts.density ?? 0.6;
  const blocked = (x: number, y: number, rad: number) => {
    for (const c of corridors) if (distToSeg({ x, y }, c.a, c.b) < c.r + rad) return true;
    for (const a of opts.avoid ?? []) if (Math.hypot(x - a.x, y - a.y) < a.r + rad) return true;
    return false;
  };
  for (let x = minX - pad + step / 2; x < maxX + pad; x += step) {
    for (let y = minY - pad + step / 2; y < maxY + pad; y += step) {
      if (!rng.chance(density)) {
        if (rng.chance(0.6)) {
          const tx = x + rng.range(-5, 5);
          const ty = y + rng.range(-5, 5);
          if (!blocked(tx, ty, 2.5))
            vis.trees.push({ x: tx, y: ty, r: rng.range(2.6, 4.4), kind: rng.chance(0.18) ? 'pink' : rng.chance(0.1) ? 'palm' : 'rain' });
        }
        continue;
      }
      const w = rng.range(8, 13.5);
      const d = rng.range(8, 13.5);
      const cx = x + rng.range(-1, 1);
      const cy = y + rng.range(-1, 1);
      if (blocked(cx, cy, Math.hypot(w, d) / 2)) {
        continue;
      }
      const tall = rng.chance(0.08);
      let h = tall ? rng.range(maxH * 0.6, maxH) : rng.range(minH, minH + 8);
      // the camera looks north: anything just south of a road would hide it
      for (const c of corridors) {
        const horizontal = Math.abs(c.b.x - c.a.x) > Math.abs(c.b.y - c.a.y);
        if (!horizontal) continue;
        const dy = cy - (c.a.y + c.b.y) / 2;
        const inX = cx > Math.min(c.a.x, c.b.x) - 10 && cx < Math.max(c.a.x, c.b.x) + 10;
        if (inX && dy > 0 && dy < 60) h = Math.min(h, 3.5 + (dy - c.r) * 0.32);
      }
      if (h < 3) continue;
      vis.buildings.push({ x: cx, y: cy, w, d, h, rot: 0, hue: rng.next() });
    }
  }
}
