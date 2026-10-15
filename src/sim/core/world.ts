// Microscopic traffic simulation core.
// - Car following: Intelligent Driver Model (IDM)
// - Lane changing: MOBIL-style incentive/safety test with politeness
// - Junctions: signal stop lines, conflict zones inside the box, and the
//   "don't block the box" exit-space rule for civic drivers
// - Merges: zipper sponsoring (civic) vs nose-in forcing (selfish)

import { Path, clamp, leftOf, smoothstep, type Pose } from './geom.ts';
import { Rng } from './rng.ts';
import { Signal } from './signal.ts';
import { CIVIC, SELFISH, VSPECS, type Mix, type Move, type Profile, type VType } from './types.ts';

const LOOKAHEAD = 140;

export interface NeighborLink {
  lane: Lane;
  from: number; // valid range in this lane's s
  to: number;
  offset: number; // s_other = s + offset
}

export interface StopLine {
  id: number;
  lane: Lane;
  s: number;
  signal: Signal;
  group: number;
  moves?: Move[]; // applies only to these movements (free-left exemption)
  encroach?: number; // selfish drivers stop this far past the line (on the zebra)
  hard?: boolean; // physical gate (off-screen junction): nobody runs it
}

export interface Obstacle {
  sRear: number;
  sFront: number;
  v: number;
  kind: 'ghost' | 'ped' | 'block';
  owner?: unknown;
}

export class Zone {
  readonly id: number;
  /** vehicle -> lane it claimed the zone from (same-lane followers don't conflict) */
  holders = new Map<Vehicle, Lane>();
  kind: 'cross' | 'merge';
  constructor(id: number, kind: 'cross' | 'merge') {
    this.id = id;
    this.kind = kind;
  }
}

export interface ZoneRef {
  zone: Zone;
  s: number;
  w: number;
}

export interface MoveEntry {
  lane: Lane; // connector lane
  legal: boolean;
}

export class Lane {
  readonly id: number;
  path: Path;
  length: number;
  width: number;
  next: Lane[] = [];
  moves: Partial<Record<Move, MoveEntry>> | null = null;
  left: NeighborLink[] = []; // kerb side
  right: NeighborLink[] = []; // median side
  vehicles: Vehicle[] = [];
  obstacles: Obstacle[] = [];
  stopLines: StopLine[] = [];
  zones: ZoneRef[] = [];
  feeds: Lane[] = []; // connectors that feed into this lane
  endWall = false;
  exit = false;
  periodic = false;
  connector = false;
  noLaneChange = false;
  vLimit = 16;
  tag = '';
  /** zipper merge state (for lanes that end): planned merge order and whose turn it is */
  zipSeq: Vehicle[] = [];
  zipLast: 'A' | 'B' = 'A';
  /** Lane index from the kerb (0 = kerb lane) within its carriageway. */
  index = 0;
  /** Opaque group id for lanes of the same carriageway (rendering/metrics). */
  group = '';

  constructor(id: number, path: Path, width = 3.3) {
    this.id = id;
    this.path = path;
    this.length = path.length;
    this.width = width;
  }

  linkAt(side: 'left' | 'right', s: number): NeighborLink | undefined {
    const arr = side === 'left' ? this.left : this.right;
    for (const l of arr) if (s >= l.from && s <= l.to) return l;
    return undefined;
  }
}

export interface Claim {
  zone: Zone;
  remaining: number;
  lane: Lane; // lane the zone lies on
}

export interface StopPlan {
  lane: Lane;
  s: number; // where the front should stop
  time: number;
  state: 'approach' | 'dwell' | 'done';
  t: number;
}

let VEH_ID = 1;

export class Vehicle {
  readonly id: number;
  type: VType;
  len: number;
  wid: number;
  lane: Lane;
  s: number;
  v: number;
  acc = 0;
  accApplied = 0;
  v0: number;
  aMax: number;
  b: number;
  T = 1.2;
  s0 = 1.5;
  react = 0.8;
  u: number; // fixed random number deciding civic vs selfish under the slider
  traits: number[]; // fixed per-vehicle random numbers for scenario logic
  civic = false;
  profile: Profile = SELFISH;
  moves: Move[];
  moveIdx = 0;
  color: number;

  // lateral motion
  lat = 0;
  lat0 = 0;
  lcT = 0;
  lcDur = 0;
  lcActive = false;
  lcFrom: Lane | null = null;
  lcFromOffset = 0;
  lcCooldown = 0;
  lcNext = 0;
  indicator: -1 | 0 | 1 = 0;
  forced = false; // currently nosing in
  standoff = 0; // seconds left in a nose-to-nose standoff at a merge
  standoffWith: Vehicle | null = null;
  standoffDir: -1 | 1 = -1;
  yieldUntil = 0;
  nose = 0; // 0..1 visual nudge towards the lane it is forcing into
  zipGap = Infinity; // zipper: gap to the vehicle ahead in the *other* lane
  zipV = 0;

  // state
  wait = 0;
  stoppedFor = 0;
  delay = 0; // seconds lost vs desired speed
  spawnT: number;
  queuedFor = 0;
  dist = 0;
  brake = 0;
  claims: Claim[] = [];
  sponsoring: Vehicle | null = null;
  sponsor: Vehicle | null = null;
  letIn = false;
  decided: { line: number; key: number; go: boolean } | null = null;
  stopPlan: StopPlan | null = null;
  wrongWay = false;
  mergeZone = 60;
  flags: Record<string, number> = {};
  alive = true;
  hardBrakeLatch = false;

  constructor(type: VType, lane: Lane, s: number, v: number, u: number, traits: number[], moves: Move[], color: number, t: number) {
    this.id = VEH_ID++;
    this.type = type;
    const spec = VSPECS[type];
    this.len = spec.len;
    this.wid = spec.wid;
    this.lane = lane;
    this.s = s;
    this.v = v;
    this.u = u;
    this.traits = traits;
    this.v0 = spec.v0 * (0.88 + traits[0] * 0.24);
    this.aMax = spec.a;
    this.b = spec.b;
    this.moves = moves;
    this.color = color;
    this.spawnT = t;
  }

  get move(): Move | undefined {
    return this.moves[this.moveIdx];
  }

  /** Render pose including lateral offset during lane changes. */
  pose(out: Pose = { x: 0, y: 0, h: 0 }): Pose {
    const p = this.lane.path.pose(clamp(this.s - this.len * 0.5, -50, this.lane.length + 50), out);
    // centre of the vehicle sits half a length behind the front bumper
    if (this.s - this.len * 0.5 < 0 && !this.lane.periodic) {
      // still partly on the previous lane: extrapolate backwards along heading
      const back = this.s - this.len * 0.5;
      const p0 = this.lane.path.pose(0);
      p.x = p0.x + Math.cos(p0.h) * back;
      p.y = p0.y + Math.sin(p0.h) * back;
      p.h = p0.h;
    } else if (this.lane.periodic && this.s - this.len * 0.5 < 0) {
      this.lane.path.pose(this.s - this.len * 0.5 + this.lane.length, p);
    }
    if (this.lat !== 0) {
      const ln = leftOf({ x: Math.cos(p.h), y: Math.sin(p.h) });
      p.x += ln.x * this.lat;
      p.y += ln.y * this.lat;
      if (this.lcActive) {
        // yaw towards the target lane while changing (d(lat)/dt of the smoothstep blend)
        const x = clamp(this.lcT / this.lcDur, 0, 1);
        const dLat = (-this.lat0 * 6 * x * (1 - x)) / this.lcDur;
        p.h -= clamp(Math.atan2(dLat, Math.max(this.v, 1.6)), -0.6, 0.6);
      }
    }
    if (this.nose > 0.01) {
      const ln = leftOf({ x: Math.cos(p.h), y: Math.sin(p.h) });
      const side = -this.standoffDir; // -1 (kerb/left) => +lat
      p.x += ln.x * side * this.nose * 0.9;
      p.y += ln.y * side * this.nose * 0.9;
      p.h -= side * this.nose * 0.32;
    }
    if (this.wrongWay) p.h += Math.PI;
    return p;
  }
}

export interface Pending {
  type: VType;
  u: number;
  traits: number[];
  moves: Move[];
  color: number;
  laneU: number;
  t: number;
}

export class Source {
  lanes: Lane[];
  rate: number;
  mix: Mix;
  moveGen: (rng: Rng) => Move[];
  nextT: number;
  queue: Pending[] = [];
  pickLane: ((p: Pending, w: World) => Lane) | null = null;
  onSpawn: ((v: Vehicle, w: World) => void) | null = null;
  enabled = true;
  /** Background traffic: rendered but excluded from metrics. */
  bg = false;

  constructor(lanes: Lane[], rate: number, mix: Mix, moveGen: (rng: Rng) => Move[] = () => ['S', 'S', 'S', 'S']) {
    this.lanes = lanes;
    this.rate = rate;
    this.mix = mix;
    this.moveGen = moveGen;
    this.nextT = 0;
  }
}

/** Pedestrian (moved by scenario logic, drawn by the renderer). */
export interface Ped {
  id: number;
  x: number;
  y: number;
  h: number;
  vx: number;
  vy: number;
  civic: boolean;
  color: number;
  state: 'arrive' | 'wait' | 'cross' | 'refuge' | 'leave';
  t: number; // time in current state
  waited: number;
  patience: number;
  dir: 1 | -1; // +1 crossing towards +y
  speed: number;
  phase: number; // walk-cycle phase
  alive: boolean;
  danger: number; // 0..1 flash when involved in a near miss
}

export interface SimEvent {
  kind: 'honk' | 'nearmiss' | 'hardbrake' | 'merge' | 'gridlock';
  x: number;
  y: number;
  t: number;
  civic: boolean;
}

export class Metrics {
  exitTimes: number[] = [];
  trips: { t: number; travel: number; delay: number; occ: number; tag: string }[] = [];
  totalExited = 0;
  peopleSecLost = 0;
  vehSecLost = 0;
  honks = 0;
  nearMisses = 0;
  hardBrakes = 0;
  forcedMerges = 0;
  stoppedNow = 0;
  meanSpeed = 0;
  movingSince = 0; // last time something in the watched area moved
  gridlocked = false;
  custom: Record<string, number> = {};

  throughputPerMin(now: number, window = 60, since = 0): number {
    const from = Math.max(since, now - window);
    let n = 0;
    for (let i = this.exitTimes.length - 1; i >= 0; i--) {
      if (this.exitTimes[i] < from) break;
      n++;
    }
    const span = now - from;
    return span > 1 ? (n / span) * 60 : 0;
  }

  avgTrip(now: number, window = 90, tag?: string): { travel: number; delay: number; n: number } {
    let tr = 0;
    let de = 0;
    let n = 0;
    for (let i = this.trips.length - 1; i >= 0; i--) {
      const r = this.trips[i];
      if (r.t < now - window) break;
      if (tag && r.tag !== tag) continue;
      tr += r.travel;
      de += r.delay;
      n++;
    }
    return n ? { travel: tr / n, delay: de / n, n } : { travel: 0, delay: 0, n: 0 };
  }
}

export interface WorldOptions {
  seed: number;
  civicShare: number;
  name?: string;
  accLag?: number; // first-order lag on acceleration (driver response time)
  civic?: Profile;
  selfish?: Profile;
}

export interface Hooks {
  /** After obstacles are cleared and ghosts placed, before accelerations. */
  preAccel?: (w: World) => void;
  /** Extra per-vehicle constraint; return a (lower) acceleration or undefined. */
  constraint?: (w: World, v: Vehicle) => number | undefined;
  afterStep?: (w: World) => void;
  onExit?: (w: World, v: Vehicle) => void;
  /** Override whether a lane is acceptable for a vehicle (route/legality). */
  laneOk?: (w: World, v: Vehicle, lane: Lane) => boolean | undefined;
  /** Scenario-specific mandatory lane need. null = none, undefined = default logic. */
  mandatory?: (w: World, v: Vehicle) => MandNeed | null | undefined;
  /** Distance before a lane end at which a vehicle starts trying to merge. */
  mergeZone?: (w: World, v: Vehicle) => number;
  /** Extra MOBIL bias for moving in `dir` (-1 kerb, +1 median). */
  lcBias?: (w: World, v: Vehicle, dir: -1 | 1) => number;
}

export type MandNeed = { dir: -1 | 1; urgency: number; dEnd: number; atWall: boolean };

export class World {
  name: string;
  t = 0;
  dt = 1 / 30;
  lanes: Lane[] = [];
  vehicles: Vehicle[] = [];
  signals: Signal[] = [];
  sources: Source[] = [];
  zones: Zone[] = [];
  stopLines: StopLine[] = [];
  spawnRng: Rng;
  rng: Rng;
  civicShare: number;
  civicProfile: Profile;
  selfishProfile: Profile;
  accLag: number;
  metrics = new Metrics();
  events: SimEvent[] = [];
  hooks: Hooks = {};
  peds: Ped[] = [];
  /** Lanes considered when detecting gridlock (no movement for a while). */
  watchLanes: Set<Lane> | null = null;
  measureSince = 0;
  /** Scenario scratch space. */
  ctx: Record<string, unknown> = {};
  private nextLaneId = 1;
  private nextZoneId = 1;
  private nextLineId = 1;
  private frame = 0;

  constructor(opts: WorldOptions) {
    this.name = opts.name ?? 'world';
    this.spawnRng = new Rng(opts.seed);
    this.rng = new Rng(opts.seed * 7919 + 13);
    this.civicShare = opts.civicShare;
    this.accLag = opts.accLag ?? 0;
    this.civicProfile = opts.civic ?? CIVIC;
    this.selfishProfile = opts.selfish ?? SELFISH;
  }

  // ---------- construction helpers ----------
  addLane(path: Path, width = 3.3): Lane {
    const l = new Lane(this.nextLaneId++, path, width);
    this.lanes.push(l);
    return l;
  }

  link(a: Lane, b: Lane) {
    a.next.push(b);
  }

  /** Make `a` and `b` neighbours: b lies on a's `side`. Ranges in a's coordinates. */
  neighbours(a: Lane, b: Lane, side: 'left' | 'right', from = 0, to = a.length, offset = 0) {
    const other = side === 'left' ? 'right' : 'left';
    (side === 'left' ? a.left : a.right).push({ lane: b, from, to, offset });
    (other === 'left' ? b.left : b.right).push({ lane: a, from: from + offset, to: to + offset, offset: -offset });
  }

  addZone(kind: 'cross' | 'merge'): Zone {
    const z = new Zone(this.nextZoneId++, kind);
    this.zones.push(z);
    return z;
  }

  addStopLine(lane: Lane, s: number, signal: Signal, group: number, moves?: Move[]): StopLine {
    const sl: StopLine = { id: this.nextLineId++, lane, s, signal, group, moves };
    lane.stopLines.push(sl);
    this.stopLines.push(sl);
    return sl;
  }

  addSource(src: Source): Source {
    src.nextT = this.spawnRng.exp(src.rate) * 0.5;
    this.sources.push(src);
    return src;
  }

  // ---------- behaviour ----------
  profileFor(u: number): Profile {
    return u < this.civicShare ? this.civicProfile : this.selfishProfile;
  }

  applyProfile(v: Vehicle) {
    const p = this.profileFor(v.u);
    v.profile = p;
    v.civic = p.name === 'civic';
    const spec = VSPECS[v.type];
    const personal = 0.9 + v.traits[1] * 0.2;
    v.T = spec.T * p.Tmul * personal;
    v.s0 = spec.s0 * p.s0mul;
    v.react = p.react * (0.8 + v.traits[2] * 0.4);
  }

  setCivicShare(share: number) {
    this.civicShare = share;
    for (const v of this.vehicles) this.applyProfile(v);
  }

  // ---------- spawning ----------
  makePending(src: Source): Pending {
    const r = this.spawnRng;
    const type = r.weighted<VType>(src.mix);
    const u = r.next();
    const traits = [r.next(), r.next(), r.next(), r.next(), r.next(), r.next()];
    const colorU = r.next();
    const laneU = r.next();
    const moves = src.moveGen(r);
    const cols = VSPECS[type].colors;
    return { type, u, traits, moves, color: cols[Math.floor(colorU * cols.length)], laneU, t: this.t };
  }

  spawnVehicle(p: Pending, lane: Lane, s: number, v: number): Vehicle {
    const veh = new Vehicle(p.type, lane, s, v, p.u, p.traits, p.moves, p.color, p.t);
    this.applyProfile(veh);
    veh.lcNext = this.t + veh.traits[3] * veh.profile.lcEvalPeriod;
    this.vehicles.push(veh);
    // insert sorted
    const arr = lane.vehicles;
    let i = arr.length;
    while (i > 0 && arr[i - 1].s > s) i--;
    arr.splice(i, 0, veh);
    return veh;
  }

  private trySpawn(src: Source) {
    // per-lane FIFO: a full lane must not hold back arrivals bound for other lanes
    const blocked = new Set<Lane>();
    for (let i = 0; i < src.queue.length; i++) {
      const p = src.queue[i];
      const lane = src.pickLane ? src.pickLane(p, this) : src.lanes[Math.floor(p.laneU * src.lanes.length)];
      if (blocked.has(lane)) continue;
      const spec = VSPECS[p.type];
      const first = lane.vehicles[0];
      let vIn = spec.v0 * 0.8;
      let ok = true;
      if (first) {
        const gap = first.s - first.len - spec.len;
        if (gap < spec.s0 + 1) ok = false;
        else vIn = Math.min(vIn, first.v + Math.max(0, gap - 4) * 0.4);
      }
      for (const o of lane.obstacles) if (o.sRear < spec.len + 3) ok = false;
      if (!ok) {
        blocked.add(lane);
        if (blocked.size >= src.lanes.length) return;
        continue;
      }
      src.queue.splice(i, 1);
      i--;
      const veh = this.spawnVehicle(p, lane, spec.len, Math.max(0, vIn));
      veh.queuedFor = this.t - p.t;
      veh.delay += veh.queuedFor;
      if (src.bg) veh.flags.bg = 1;
      src.onSpawn?.(veh, this);
    }
  }

  // ---------- main step ----------
  step() {
    const dt = this.dt;
    this.t += dt;
    this.frame++;
    for (const s of this.signals) s.step(dt);

    // arrivals
    for (const src of this.sources) {
      if (!src.enabled) continue;
      while (this.t >= src.nextT) {
        src.queue.push(this.makePending(src));
        src.nextT += Math.max(0.35, this.spawnRng.exp(src.rate));
      }
      this.trySpawn(src);
    }

    // obstacles: ghosts of vehicles mid lane change
    for (const l of this.lanes) l.obstacles.length = 0;
    for (const v of this.vehicles) {
      if (v.lcActive && v.lcFrom && v.lcT < v.lcDur * (v.forced ? 0.6 : 0.4)) {
        const sOld = v.s + v.lcFromOffset;
        v.lcFrom.obstacles.push({ sRear: sOld - v.len, sFront: sOld, v: v.v, kind: 'ghost', owner: v });
      }
    }
    // nose-to-nose standoffs at merges: the nosing vehicle blocks the target lane
    for (const v of this.vehicles) {
      const target = v.standoff > 0 || v.nose > 0.3 ? 1 : 0;
      v.nose += (target - v.nose) * Math.min(1, dt * 3);
      if (v.standoff <= 0) continue;
      v.standoff -= dt;
      const lk = v.lane.linkAt(v.standoffDir < 0 ? 'left' : 'right', v.s);
      if (lk) lk.lane.obstacles.push({ sRear: v.s + lk.offset - v.len * 0.7, sFront: v.s + lk.offset, v: 0, kind: 'block', owner: v });
      if (v.standoff <= 0) {
        const f = v.standoffWith;
        v.standoffWith = null;
        if (lk && (!f || !f.alive || this.rng.chance(0.5))) {
          this.executeLC(v, lk, v.standoffDir, true);
        } else {
          v.yieldUntil = this.t + 2.5;
        }
      }
    }
    this.hooks.preAccel?.(this);

    // zipper: courteous drivers interleave with the other lane as lanes converge
    this.zipperPass();

    // accelerations
    for (const v of this.vehicles) {
      let a = this.computeAcc(v);
      const extra = this.hooks.constraint?.(this, v);
      if (extra !== undefined) a = Math.min(a, extra);
      v.acc = a;
    }

    // lane changes
    for (const v of this.vehicles) {
      if (v.lcCooldown > 0) v.lcCooldown -= dt;
      if (this.t >= v.lcNext) {
        v.lcNext = this.t + v.profile.lcEvalPeriod;
        this.decideLaneChange(v);
      } else if (v.forced === false && this.needsUrgentLC(v)) {
        this.decideLaneChange(v);
      }
    }

    // integrate
    let stopped = 0;
    let speedSum = 0;
    let counted = 0;
    let moved = false;
    const exiting: Vehicle[] = [];
    for (const v of this.vehicles) {
      let a = v.acc;
      // start-up reaction time from standstill
      if (v.v < 0.05) {
        if (a > 0.05) {
          v.wait += dt;
          if (v.wait < v.react) a = 0;
        } else v.wait = 0;
      } else v.wait = 0;
      const lag = v.profile.lag ?? this.accLag;
      if (lag > 0 && a > -4) {
        v.accApplied += (a - v.accApplied) * Math.min(1, dt / lag);
        a = v.accApplied;
      } else v.accApplied = a;

      const vNew = Math.max(0, v.v + a * dt);
      let ds = ((v.v + vNew) / 2) * dt;
      if (vNew === 0 && a < 0) ds = Math.min(ds, (v.v * v.v) / (2 * -a + 1e-6));
      v.v = vNew;
      v.s += ds;
      v.dist += ds;
      for (const c of v.claims) c.remaining -= ds;

      // brake light intensity
      const target = a < -0.4 ? clamp(-a / 2.5, 0.35, 1) : v.v < 0.4 ? 0.55 : 0;
      v.brake += (target - v.brake) * Math.min(1, dt * 10);
      if (a < -4.5 && !v.hardBrakeLatch) {
        v.hardBrakeLatch = true;
        this.metrics.hardBrakes++;
        const p = v.pose();
        this.events.push({ kind: 'hardbrake', x: p.x, y: p.y, t: this.t, civic: v.civic });
      } else if (a > -2) v.hardBrakeLatch = false;

      // lane change progress
      if (v.lcActive) {
        const rate = v.forced ? clamp(0.35 + v.v / 6, 0.35, 1) : clamp(0.65 + v.v / 6, 0.65, 1);
        v.lcT += dt * rate;
        const k = smoothstep(v.lcT / v.lcDur);
        v.lat = v.lat0 * (1 - k);
        if (v.lcT >= v.lcDur) {
          v.lcActive = false;
          v.lat = 0;
          v.lcFrom = null;
          v.indicator = 0;
          v.forced = false;
        }
      }

      const occ = VSPECS[v.type].occupancy;
      const v0e = Math.min(v.v0, v.lane.vLimit);
      const lost = dt * clamp(1 - v.v / Math.max(v0e, 1), 0, 1);
      v.delay += lost;
      // dwelling at a stop is the vehicle doing its job, not time lost in traffic
      const bg = !!v.flags.bg || (v.stopPlan !== null && v.stopPlan.state === 'dwell');
      if (v.v < 1.0) {
        if (!bg) stopped++;
        v.stoppedFor += dt;
        if (!bg) {
          this.metrics.peopleSecLost += dt * occ;
          this.metrics.vehSecLost += dt;
        }
        if (v.stoppedFor > 1.5 && this.rng.chance(v.profile.honkRate * dt)) {
          this.metrics.honks++;
          const p = v.pose();
          this.events.push({ kind: 'honk', x: p.x, y: p.y, t: this.t, civic: v.civic });
        }
      } else v.stoppedFor = 0;
      if (!bg) {
        speedSum += v.v;
        counted++;
      }
      if (ds > 0.02 && (!this.watchLanes || this.watchLanes.has(v.lane))) moved = true;

      // lane transitions
      let guard = 0;
      while (v.s >= v.lane.length && guard++ < 4) {
        const lane = v.lane;
        if (lane.periodic) {
          v.s -= lane.length;
          continue;
        }
        if (lane.exit) {
          exiting.push(v);
          break;
        }
        const nxt = this.nextLaneFor(v, lane);
        if (!nxt) {
          v.s = lane.length - 0.01;
          v.v = 0;
          break;
        }
        if (lane.moves) v.moveIdx++;
        this.transfer(v, lane, nxt, v.s - lane.length);
      }
    }
    // pending vehicles waiting to enter count as lost time too
    for (const src of this.sources) {
      if (src.bg) continue;
      for (const p of src.queue) {
        this.metrics.peopleSecLost += dt * VSPECS[p.type].occupancy;
        this.metrics.vehSecLost += dt;
      }
    }

    for (const v of exiting) this.removeVehicle(v, true);

    // release zone claims
    for (const v of this.vehicles) {
      if (v.claims.length) {
        for (let i = v.claims.length - 1; i >= 0; i--) {
          if (v.claims[i].remaining <= 0) {
            v.claims[i].zone.holders.delete(v);
            v.claims.splice(i, 1);
          }
        }
      }
      if (v.sponsoring && (!v.sponsoring.alive || v.sponsoring.lane === v.lane)) {
        // merged (or gone): one-by-one rule fulfilled
        if (v.sponsoring.alive) v.letIn = true;
        v.sponsoring.sponsor = null;
        v.sponsoring = null;
      }
    }

    // keep lane arrays sorted
    for (const l of this.lanes) {
      const arr = l.vehicles;
      for (let i = 1; i < arr.length; i++) {
        const x = arr[i];
        let j = i - 1;
        while (j >= 0 && arr[j].s > x.s) {
          arr[j + 1] = arr[j];
          j--;
        }
        arr[j + 1] = x;
      }
      // collision guard
      for (let i = arr.length - 2; i >= 0; i--) {
        const f = arr[i];
        const lead = arr[i + 1];
        const lim = lead.s - lead.len - 0.15;
        if (f.s > lim && !(f.lcActive || lead.lcActive)) {
          f.s = Math.max(lim, f.s - 0.5);
          f.v = Math.min(f.v, lead.v);
        }
      }
    }

    this.metrics.stoppedNow = stopped;
    this.metrics.meanSpeed = counted ? speedSum / counted : 0;
    if (moved) this.metrics.movingSince = this.t;
    this.metrics.gridlocked = this.vehicles.length > 20 && this.t - this.metrics.movingSince > 12;
    this.hooks.afterStep?.(this);
    if (this.events.length > 400) this.events.splice(0, this.events.length - 400);
  }

  private transfer(v: Vehicle, from: Lane, to: Lane, s: number) {
    const i = from.vehicles.indexOf(v);
    if (i >= 0) from.vehicles.splice(i, 1);
    v.lane = to;
    v.s = s;
    if (v.lcActive) {
      v.lcFrom = null;
    }
    // reset one-by-one merge courtesy when moving to a new lane segment
    v.letIn = false;
    const arr = to.vehicles;
    let k = arr.length;
    while (k > 0 && arr[k - 1].s > s) k--;
    arr.splice(k, 0, v);
  }

  removeVehicle(v: Vehicle, exited: boolean) {
    v.alive = false;
    const i = v.lane.vehicles.indexOf(v);
    if (i >= 0) v.lane.vehicles.splice(i, 1);
    const j = this.vehicles.indexOf(v);
    if (j >= 0) this.vehicles.splice(j, 1);
    for (const c of v.claims) c.zone.holders.delete(v);
    v.claims.length = 0;
    if (v.sponsor) v.sponsor.sponsoring = null;
    if (v.sponsoring) v.sponsoring.sponsor = null;
    if (exited && !v.flags.bg) {
      const m = this.metrics;
      m.totalExited++;
      if (this.t >= this.measureSince) {
        m.exitTimes.push(this.t);
        m.trips.push({ t: this.t, travel: this.t - v.spawnT, delay: v.delay, occ: VSPECS[v.type].occupancy, tag: v.move ?? v.moves[v.moveIdx - 1] ?? 'S' });
      }
      if (m.exitTimes.length > 3000) m.exitTimes.splice(0, 1000);
      if (m.trips.length > 3000) m.trips.splice(0, 1000);
    }
    if (exited) this.hooks.onExit?.(this, v);
  }

  // ---------- routing ----------
  moveAllowed(v: Vehicle, lane: Lane, move: Move | undefined): boolean {
    const custom = this.hooks.laneOk?.(this, v, lane);
    if (custom !== undefined) return custom;
    if (!lane.moves || !move) return true;
    const e = lane.moves[move];
    if (!e) return false;
    return e.legal || !v.civic;
  }

  nextLaneFor(v: Vehicle, lane: Lane): Lane | null {
    if (lane.periodic) return lane;
    if (lane.moves) {
      const m = v.move;
      if (!m || !this.moveAllowed(v, lane, m)) return null;
      return lane.moves[m]!.lane;
    }
    return lane.next[0] ?? null;
  }

  /** Free space at the tail of `out`, minus vehicles already committed via its feeders.
   *  Moving traffic counts (a little) as space that is about to open up; counting on more
   *  than a second of it leaves careful drivers stranded in the box when the queue stops. */
  exitSpace(out: Lane): { free: number; tailMoving: boolean } {
    let free: number;
    let tailMoving = true;
    const tail = out.vehicles[0];
    if (tail) {
      free = tail.s - tail.len + tail.v * 1.0;
      tailMoving = tail.v > 2.5;
    } else free = out.length;
    for (const f of out.feeds) {
      for (const c of f.vehicles) free -= c.len + c.s0 + 0.5 - c.v * 0.5;
    }
    return { free, tailMoving };
  }

  // ---------- car following ----------
  idm(v: Vehicle, gap: number, vLead: number): number {
    const dv = v.v - vLead;
    const sStar = v.s0 + Math.max(0, v.v * v.T + (v.v * dv) / (2 * Math.sqrt(v.aMax * v.b)));
    const g = Math.max(gap, 0.05);
    return -v.aMax * (sStar / g) ** 2;
  }

  freeAcc(v: Vehicle, lane: Lane = v.lane): number {
    const v0 = Math.max(0.5, Math.min(v.v0, lane.vLimit));
    return v.aMax * (1 - (v.v / v0) ** 4);
  }

  private stopDecision(v: Vehicle, sl: StopLine, d: number): boolean {
    // returns true if the vehicle must stop at this line
    if (sl.moves && v.move && !sl.moves.includes(v.move)) return false;
    const st = sl.signal.state(sl.group);
    if (st === 'G') {
      v.decided = null;
      return false;
    }
    const key = sl.signal.windowKey();
    if (v.decided && v.decided.line === sl.id && v.decided.key === key) {
      if (v.decided.go) return false;
      return true;
    }
    let go: boolean;
    if (sl.hard) {
      go = v.v > 1 && d < (v.v * v.v) / (2 * 4) + 0.3;
      v.decided = { line: sl.id, key, go };
      return !go;
    }
    if (st === 'Y') {
      const canStop = v.v < 1 || d > (v.v * v.v) / (2 * 3.2) + 1;
      if (!canStop) go = true;
      else go = v.profile.ambRun > 0 && d < v.v * 3.2 + 6 && this.rng.chance(v.profile.ambRun);
    } else {
      // red
      const redFor = sl.signal.redFor(sl.group);
      const canStop = v.v < 1 || d > (v.v * v.v) / (2 * 6) + 0.5;
      if (!canStop) go = true;
      else go = redFor < 2.5 && v.v > 3 && d < v.v * 1.6 + 4 && this.rng.chance(v.profile.redRun);
    }
    v.decided = { line: sl.id, key, go };
    return !go;
  }

  /** Acceleration from scanning ahead along the planned route. */
  computeAcc(v: Vehicle): number {
    let acc = this.freeAcc(v);
    let lane: Lane | null = v.lane;
    let offset = -v.s; // distance of lane-coordinate 0 from the vehicle front
    let fromS = v.s;
    let depth = 0;
    let haveLeader = false;
    let stopAt = Infinity; // distance to the first hard stop (no zone claims beyond it)
    const idxInLane = lane.vehicles.indexOf(v);

    if (v.zipGap < Infinity) acc = Math.min(acc, this.freeAcc(v) + this.idm(v, Math.max(v.zipGap, 0.3), v.zipV));
    // zipper: a sponsored merger slots in behind the vehicle its sponsor follows
    if (v.sponsor && v.sponsor.alive) {
      const f = v.sponsor;
      const arr = f.lane.vehicles;
      const k = arr.indexOf(f);
      const slot = k >= 0 ? arr[k + 1] : undefined;
      const lk = v.lane.left.find((l) => l.lane === f.lane) ?? v.lane.right.find((l) => l.lane === f.lane);
      if (slot && slot !== v && lk) {
        const myS = v.s + lk.offset;
        const gap = slot.s - slot.len - myS;
        if (gap < 25) acc = Math.min(acc, this.freeAcc(v) + this.idm(v, Math.max(gap, 0.5), slot.v));
      }
    }
    // zipper courtesy: treat the vehicle we are letting in as our leader
    if (v.sponsoring) {
      const r = v.sponsoring;
      const lk = r.lane.left.find((l) => l.lane === v.lane) ?? r.lane.right.find((l) => l.lane === v.lane);
      if (lk && r.s >= lk.from - 1 && r.s <= lk.to + 1) {
        const gap = r.s + lk.offset - r.len - v.s;
        if (gap > -1.5) acc = Math.min(acc, this.freeAcc(v) + this.idm(v, Math.max(gap, 0.4), r.v));
        else {
          r.sponsor = null;
          v.sponsoring = null;
        }
      }
    }

    const laneOffsets: [Lane, number][] = [];
    while (lane && depth < 5 && offset < LOOKAHEAD) {
      laneOffsets.push([lane, offset]);
      // leader vehicle
      if (!haveLeader) {
        let lead: Vehicle | undefined;
        if (depth === 0) {
          lead = lane.vehicles[idxInLane + 1];
          if (!lead && lane.periodic && lane.vehicles.length > 1) {
            lead = lane.vehicles[0];
            if (lead === v) lead = undefined;
            else {
              const gap = lane.length - v.s + lead.s - lead.len;
              acc = Math.min(acc, this.freeAcc(v) + this.idm(v, gap, lead.v));
              haveLeader = true;
              lead = undefined;
            }
          }
        } else {
          lead = lane.vehicles[0];
          if (lead === v) lead = lane.vehicles[1];
        }
        if (lead) {
          const gap = offset + lead.s - lead.len;
          acc = Math.min(acc, this.freeAcc(v) + this.idm(v, gap, lead.v));
          haveLeader = true;
        }
      }
      // obstacles (ghosts, pedestrians, blocks)
      for (const o of lane.obstacles) {
        if (o.owner === v) continue;
        if (o.sFront <= fromS + 0.01) continue;
        const gap = offset + o.sRear;
        if (gap < -v.len * 0.6) continue; // obstacle is beside/behind us
        acc = Math.min(acc, this.freeAcc(v) + this.idm(v, gap, o.v));
      }
      if (lane.periodic && depth === 0) {
        for (const o of lane.obstacles) {
          if (o.owner === v || o.sRear >= fromS) continue;
          const gap = lane.length - v.s + o.sRear;
          if (gap < LOOKAHEAD) acc = Math.min(acc, this.freeAcc(v) + this.idm(v, gap, o.v));
        }
      }
      // stop lines
      for (const sl of lane.stopLines) {
        if (sl.s < fromS - 0.2) continue;
        const d = offset + sl.s;
        if (d > LOOKAHEAD) continue;
        if (this.stopDecision(v, sl, d)) {
          const enc = !v.civic && sl.encroach ? sl.encroach * (0.4 + 0.6 * v.traits[5]) : 0;
          acc = Math.min(acc, this.freeAcc(v) + this.idm(v, d + enc + v.s0 - 0.4, 0));
          stopAt = Math.min(stopAt, d + enc);
        }
      }
      // civic drivers only enter the box when their whole path through it is free
      if (lane.connector && lane.zones.length && v.profile.boxRule && depth > 0) {
        let first = Infinity;
        let mine = false;
        let busy = false;
        for (const zr of lane.zones) {
          first = Math.min(first, offset + zr.s - zr.w);
          if (zr.zone.holders.has(v)) mine = true;
          for (const [h, hl] of zr.zone.holders) if (h !== v && hl !== lane) busy = true;
        }
        if (!mine) {
          if (busy) {
            acc = Math.min(acc, this.freeAcc(v) + this.idm(v, offset + v.s0 - 0.5, 0));
            stopAt = Math.min(stopAt, offset);
          } else if (first < Math.max(4, v.v * 1.4 + 3) && offset < stopAt) {
            for (const zr of lane.zones) {
              zr.zone.holders.set(v, lane);
              v.claims.push({ zone: zr.zone, remaining: offset + zr.s + zr.w + v.len + 0.5, lane });
            }
          }
        }
      }
      // conflict zones (inside junction boxes)
      for (const zr of lane.zones) {
        const dz = offset + zr.s - zr.w;
        if (offset + zr.s + zr.w < 0) continue; // already past
        if (dz > 30) continue;
        if (zr.zone.holders.has(v)) continue;
        let blocked = false;
        let physical = false;
        for (const [h, hl] of zr.zone.holders) {
          if (h === v || hl === lane) continue;
          blocked = true;
          if (this.occupies(h, hl, zr.zone)) physical = true;
        }
        // stuck inside the box behind a mere claim: wriggle past (people squeeze through)
        if (blocked && !physical && depth === 0 && lane.connector && v.stoppedFor > 5) blocked = false;
        if (blocked) {
          acc = Math.min(acc, this.freeAcc(v) + this.idm(v, dz + v.s0 - 0.3, 0));
          stopAt = Math.min(stopAt, dz);
        } else if (dz < stopAt && dz < Math.max(3.5, v.v * 1.3 + 2.5)) {
          zr.zone.holders.set(v, lane);
          v.claims.push({ zone: zr.zone, remaining: dz + 2 * zr.w + v.len + 0.5, lane });
        }
      }
      // planned stop (bus stops etc.)
      const sp: StopPlan | null = v.stopPlan;
      if (sp && sp.lane === lane && sp.state !== 'done') {
        const d = offset + sp.s;
        if (d > -1.5 && d < LOOKAHEAD) acc = Math.min(acc, this.freeAcc(v) + this.idm(v, d + v.s0 - 0.2, 0));
      }

      if (lane.exit || lane.periodic) break;
      // end of lane conditions
      let wall = false;
      let next: Lane | null = null;
      if (lane.endWall) wall = true;
      else if (lane.moves) {
        const m: Move | undefined = v.moves[v.moveIdx + (depth === 0 ? 0 : this.movesConsumedBefore(v, depth))];
        if (!m || !this.moveAllowed(v, lane, m)) wall = true;
        else {
          const conn: Lane = lane.moves[m]!.lane;
          next = conn;
          if (v.profile.boxRule && conn.connector) {
            const out = conn.next[0];
            if (out) {
              const { free, tailMoving } = this.exitSpace(out);
              const need = v.len + v.s0 + 1.0;
              if (free < need && !(tailMoving && free > need - 1.5)) wall = true;
            }
          }
        }
      } else {
        next = lane.next[0] ?? null;
        if (!next) wall = true;
      }
      if (wall) {
        const d = offset + lane.length;
        acc = Math.min(acc, this.freeAcc(v) + this.idm(v, d + v.s0 - 0.6, 0));
        break;
      }
      if (offset + lane.length > stopAt) break;
      offset += lane.length;
      fromS = -Infinity;
      lane = next;
      depth++;
    }
    // a driver who is going to stop before the box should not keep it reserved
    if (stopAt < Infinity && v.claims.length) {
      for (let i = v.claims.length - 1; i >= 0; i--) {
        const c = v.claims[i];
        if (c.lane === v.lane || c.lane.next.includes(v.lane)) continue; // inside or just behind
        const lo = laneOffsets.find((x) => x[0] === c.lane);
        if (!lo || lo[1] >= stopAt - 0.5) {
          c.zone.holders.delete(v);
          v.claims.splice(i, 1);
        }
      }
    }
    return Math.max(acc, -9);
  }

  /** Is vehicle h physically inside conflict zone z (claimed from lane hl)? */
  private occupies(h: Vehicle, hl: Lane, z: Zone): boolean {
    const zr = hl.zones.find((r) => r.zone === z);
    if (!zr) return false;
    let front = h.s;
    if (h.lane !== hl) {
      // already moved on to the next lane: express front in hl coordinates
      if (hl.next[0] === h.lane) front = hl.length + h.s;
      else return false;
    }
    return front > zr.s - zr.w && front - h.len < zr.s + zr.w;
  }

  /** Number of junction moves the vehicle will have consumed before reaching lookahead depth. */
  private movesConsumedBefore(v: Vehicle, depth: number): number {
    // walk the planned chain from the current lane counting junction approaches
    let lane: Lane | null = v.lane;
    let consumed = 0;
    for (let d = 0; d < depth && lane; d++) {
      if (lane.moves) {
        const m: Move | undefined = v.moves[v.moveIdx + consumed];
        const e: MoveEntry | undefined = m ? lane.moves[m] : undefined;
        lane = e ? e.lane : null;
        consumed++;
      } else lane = lane.periodic ? lane : (lane.next[0] ?? null);
    }
    return consumed;
  }

  // ---------- merging & lane changes ----------
  /** Does this vehicle have to leave its lane soon? */
  mandatoryNeed(v: Vehicle): MandNeed | null {
    const custom = this.hooks.mandatory?.(this, v);
    if (custom !== undefined) return custom;
    const lane = v.lane;
    const dEnd = lane.length - v.s;
    if (lane.endWall) {
      // prefer the side that has a neighbour reaching the lane end
      const l = lane.linkAt('left', v.s);
      const r = lane.linkAt('right', v.s);
      const dir: -1 | 1 = l ? -1 : 1;
      if (!l && !r) return null;
      const zone = this.hooks.mergeZone ? this.hooks.mergeZone(this, v) : v.mergeZone;
      if (dEnd > zone) return null;
      return { dir, urgency: clamp(1 - dEnd / zone, 0, 1), dEnd, atWall: dEnd < 4 && v.v < 1 };
    }
    if (lane.moves && !this.moveAllowed(v, lane, v.move)) {
      // look sideways for a lane that allows the move
      for (const side of ['left', 'right'] as const) {
        let cur: Lane | undefined = lane;
        let s = v.s;
        for (let k = 0; k < 3 && cur; k++) {
          const lk: NeighborLink | undefined = cur.linkAt(side, s);
          if (!lk) break;
          cur = lk.lane;
          s += lk.offset;
          if (this.moveAllowed(v, cur, v.move)) {
            const zone = 140;
            return { dir: side === 'left' ? -1 : 1, urgency: clamp(1 - dEnd / zone, 0.15, 1), dEnd, atWall: dEnd < 4 && v.v < 1 };
          }
        }
      }
    }
    return null;
  }

  private needsUrgentLC(v: Vehicle): boolean {
    if (v.lcActive || v.standoff > 0) return false;
    const lane = v.lane;
    if (!lane.endWall && !lane.moves) return false;
    const d = lane.length - v.s;
    if (lane.endWall && v.civic && d < 30) return true;
    return d < 6 && v.v < 1;
  }

  /** Order vehicles of a merging lane pair by position; civic drivers follow whoever is next ahead in either lane. */
  /**
   * Zipper merging for lanes that end. Courteous drivers in both lanes agree on one
   * merge order that takes turns — one from the through lane, one from the ending
   * lane — and each keeps a gap behind whoever is next ahead of them in that order.
   */
  private zipperPass() {
    for (const v of this.vehicles) v.zipGap = Infinity;
    const Z = 48;
    const NEAR = 22; // don't wait for someone more than this far behind
    for (const B of this.lanes) {
      if (!B.endWall) continue;
      const lk = B.left[0] ?? B.right[0];
      if (!lk) continue;
      const A = lk.lane;
      const end = B.length;
      const line = end - 3; // the merge point (in B's coordinates)
      // whoever just reached the merge point decides whose turn is next
      for (const v of A.vehicles) {
        const sB = v.s - lk.offset;
        if (sB >= line && !v.flags.zipPassed) {
          v.flags.zipPassed = 1;
          B.zipLast = v.flags.fromB ? 'B' : 'A';
        }
      }
      // the through lane keeps its physical order (including vehicles that already merged in);
      // vehicles still in the ending lane are slotted in between them, one at a time
      const qa: { v: Vehicle; s: number; inB: boolean }[] = [];
      const qb: { v: Vehicle; s: number; inB: boolean }[] = [];
      for (const v of B.vehicles) if (v.s > end - Z && !(v.stopPlan && v.stopPlan.state !== 'done')) qb.push({ v, s: v.s, inB: true });
      for (const v of A.vehicles) {
        const sB = v.s - lk.offset;
        if (sB > end - Z && sB < line) qa.push({ v, s: sB, inB: false });
      }
      qa.sort((x, y) => y.s - x.s);
      qb.sort((x, y) => y.s - x.s);
      const seq: { v: Vehicle; s: number; inB: boolean }[] = [];
      let owed: 'A' | 'B' = B.zipLast === 'A' ? 'B' : 'A';
      let j = 0;
      for (const a of qa) {
        // the ending lane's turn: let the next one in ahead of this vehicle (unless it is far behind)
        if (owed === 'B' && !a.v.flags.fromB && j < qb.length && qb[j].s >= a.s - NEAR) {
          seq.push(qb[j++]);
          owed = 'A';
        }
        seq.push(a);
        owed = a.v.flags.fromB ? 'A' : 'B';
      }
      while (j < qb.length) seq.push(qb[j++]);
      B.zipSeq = seq.map((e) => e.v);
      // each courteous driver keeps a gap behind their predecessor in the order
      for (let k = 1; k < seq.length; k++) {
        const e = seq[k];
        const p = seq[k - 1];
        if (!e.v.profile.zipper) continue;
        if (p.v.lane === e.v.lane) continue; // same lane: ordinary car-following does it
        const raw = p.s - p.v.len - e.s;
        // already alongside a merger that cannot move: the through-lane driver goes first
        if (e.v.lane === A && raw < 0.3 && p.v.v < 0.5 && end - p.s < 5) continue;
        const relief = 9 * clamp((end - e.s - 15) / (Z - 15), 0, 1);
        const gap = raw + relief;
        if (gap < e.v.zipGap) {
          e.v.zipGap = gap;
          e.v.zipV = p.v.v;
        }
      }
    }
  }

  private gapsIn(T: Lane, sT: number, len: number, self: Vehicle) {
    const arr = T.vehicles;
    let lead: Vehicle | undefined;
    let fol: Vehicle | undefined;
    for (let i = 0; i < arr.length; i++) {
      const o = arr[i];
      if (o === self) continue;
      if (o.s > sT) {
        lead = o;
        fol = i > 0 ? arr[i - 1] : undefined;
        if (fol === self) fol = i > 1 ? arr[i - 2] : undefined;
        break;
      }
    }
    if (!lead && arr.length) {
      fol = arr[arr.length - 1];
      if (fol === self) fol = arr[arr.length - 2];
    }
    if (T.periodic && arr.length) {
      if (!lead) lead = arr[0] !== self ? arr[0] : arr[1];
      if (!fol) fol = arr[arr.length - 1] !== self ? arr[arr.length - 1] : arr[arr.length - 2];
    }
    let gapL = Infinity;
    let vL = 0;
    if (lead) {
      gapL = lead.s - lead.len - sT;
      if (T.periodic && gapL < -lead.len - 0.01 && lead.s < sT) gapL += T.length;
      vL = lead.v;
    }
    let gapF = Infinity;
    if (fol) {
      gapF = sT - len - fol.s;
      if (T.periodic && fol.s > sT) gapF += T.length;
    }
    for (const o of T.obstacles) {
      if (o.owner === self) continue;
      if (o.sFront > sT - len && o.sRear < sT + 0.5) {
        gapL = Math.min(gapL, o.sRear - sT);
      } else if (o.sRear >= sT) {
        if (o.sRear - sT < gapL) {
          gapL = o.sRear - sT;
          vL = o.v;
        }
      }
    }
    return { lead, fol, gapL, gapF, vL };
  }

  decideLaneChange(v: Vehicle) {
    const lane = v.lane;
    if (lane.noLaneChange || lane.connector || v.lcActive || v.wrongWay || v.standoff > 0) return;
    if (v.stopPlan && v.stopPlan.state !== 'done' && v.stopPlan.lane === v.lane) return;
    const mand = this.mandatoryNeed(v);
    if (!mand && v.lcCooldown > 0) return;
    // solid lines just before a junction: no discretionary lane changes there
    if (!mand && lane.moves && lane.length - v.s < 14) return;
    const p = v.profile;
    let best: { link: NeighborLink; dir: -1 | 1; score: number } | null = null;

    for (const dir of [-1, 1] as const) {
      const link = lane.linkAt(dir < 0 ? 'left' : 'right', v.s);
      if (!link) continue;
      const T = link.lane;
      if (T.noLaneChange) continue;
      const sT = v.s + link.offset;
      if (sT > T.length - 2 && !T.exit && !T.periodic && T.next.length === 0 && !T.moves) continue;
      const toward = mand && mand.dir === dir;
      // route/legality suitability of target lane
      if (!toward && T.moves && !this.moveAllowed(v, T, v.move)) continue;
      // courteous drivers never move into a lane that is about to close; queue-jumpers do
      if (!toward && T.endWall && (v.civic || T.length - sT < 25)) continue;
      const hookOk = this.hooks.laneOk?.(this, v, T);
      if (hookOk === false && !toward) continue;
      // zipper: wait for your turn — whoever is ahead of you in the agreed order goes first
      if (lane.endWall && v.profile.zipper && lane.zipSeq.length) {
        const k = lane.zipSeq.indexOf(v);
        const pred = k > 0 ? lane.zipSeq[k - 1] : null;
        if (pred && pred.lane === T && pred.s - pred.len < sT + 0.5) continue;
      }

      const { fol, gapL, gapF, vL } = this.gapsIn(T, sT, v.len, v);
      const sponsored = !!fol && fol.sponsoring === v;
      const forcing = !!mand && toward && p.forceMerge && (mand.atWall || mand.dEnd < 10) && this.t >= v.yieldUntil;
      if (forcing && mand!.atWall && fol && !fol.civic && gapF > -1 && gapF < 7 && fol.standoff <= 0 && !fol.standoffWith) {
        // both refuse to give way: nose-to-nose standoff
        if (this.rng.chance(0.55)) {
          v.standoff = 1.2 + this.rng.next() * 2.4;
          v.standoffWith = fol;
          v.standoffDir = dir;
          this.metrics.honks += 2;
          const pp = v.pose();
          this.events.push({ kind: 'honk', x: pp.x, y: pp.y, t: this.t, civic: false });
          this.metrics.custom.standoffs = (this.metrics.custom.standoffs ?? 0) + 1;
          return;
        }
      }
      let minGap = v.civic ? 1.0 + 0.3 * v.v : 0.5 + 0.12 * v.v;
      if (sponsored) minGap = 0.6;
      if (forcing) minGap = 0.3;
      if (gapL < minGap || gapF < minGap) continue;

      // acceleration in the target lane (leader, red lights, lane end)
      let aNew = this.freeAcc(v, T);
      if (gapL < Infinity) aNew = Math.min(aNew, this.freeAcc(v, T) + this.idm(v, gapL, vL));
      if (T.endWall) aNew = Math.min(aNew, this.freeAcc(v, T) + this.idm(v, T.length - sT + v.s0, 0));
      for (const sl of T.stopLines) {
        if (sl.s < sT || sl.s - sT > 120) continue;
        if (sl.moves && v.move && !sl.moves.includes(v.move)) continue;
        if (sl.signal.state(sl.group) !== 'G') aNew = Math.min(aNew, this.freeAcc(v, T) + this.idm(v, sl.s - sT + v.s0 - 0.4, 0));
      }
      let folNew = 0;
      let folOld = 0;
      if (fol) {
        folNew = this.freeAcc(fol) + this.idm(fol, gapF, v.v);
        folOld = fol.acc;
        if (forcing) {
          // only physical possibility matters: can they stop at all?
          const need = (fol.v * fol.v) / (2 * 7.5);
          if (need > gapF + 0.2) continue;
        } else {
          const bs = sponsored ? Math.max(p.bSafe, 3.0) : p.bSafe;
          // IDM is over-cautious near standstill: also accept if the follower can simply stop in time
          const canStop = (fol.v * fol.v) / (2 * bs) < gapF - 0.6;
          if (folNew < -bs && !canStop) continue;
        }
      }
      let score = aNew - v.acc + p.politeness * (folNew - folOld);
      if (mand) score += toward ? 1.2 + 8 * mand.urgency : -6;
      // keep-left habit for slower vehicles
      if (dir < 0 && (v.type === 'bus' || v.type === 'truck' || v.type === 'auto')) score += 0.08;
      if (this.hooks.lcBias) score += this.hooks.lcBias(this, v, dir);
      const thresh = mand && toward ? 0 : p.lcThresh;
      if (score > thresh && (!best || score > best.score)) best = { link, dir, score };
    }
    if (best) this.executeLC(v, best.link, best.dir, !!(mand && mand.atWall && v.profile.forceMerge));
  }

  executeLC(v: Vehicle, link: NeighborLink, dir: -1 | 1, forced: boolean) {
    const old = v.lane;
    if (old.endWall) v.flags.fromB = 1;
    const T = link.lane;
    const sT = v.s + link.offset;
    const cBack = v.s - v.len * 0.5;
    const pOld = old.path.pose(cBack);
    const pNew = T.path.pose(sT - v.len * 0.5);
    const ln = leftOf({ x: Math.cos(pNew.h), y: Math.sin(pNew.h) });
    const lat = (pOld.x - pNew.x) * ln.x + (pOld.y - pNew.y) * ln.y + v.lat;
    const i = old.vehicles.indexOf(v);
    if (i >= 0) old.vehicles.splice(i, 1);
    v.lane = T;
    v.s = sT;
    const arr = T.vehicles;
    let k = arr.length;
    while (k > 0 && arr[k - 1].s > sT) k--;
    arr.splice(k, 0, v);
    v.lat0 = lat;
    v.lat = lat;
    v.lcT = 0;
    v.lcDur = forced ? 3.0 : v.civic ? 2.6 : 1.7;
    v.lcActive = true;
    v.lcFrom = old;
    v.lcFromOffset = -link.offset;
    v.indicator = dir;
    v.forced = forced;
    const [c0, c1] = v.profile.lcCooldown;
    v.lcCooldown = c0 + (c1 - c0) * v.traits[4];
    if (v.sponsor) {
      v.sponsor.letIn = true;
      v.sponsor.sponsoring = null;
      v.sponsor = null;
    }
    if (forced) {
      this.metrics.forcedMerges++;
      const p = v.pose();
      this.events.push({ kind: 'merge', x: p.x, y: p.y, t: this.t, civic: v.civic });
    }
    v.letIn = false;
  }

  /** Total lost people-minutes so far. */
  peopleMinutesLost(): number {
    return this.metrics.peopleSecLost / 60;
  }

  run(seconds: number) {
    const n = Math.round(seconds / this.dt);
    for (let i = 0; i < n; i++) this.step();
  }
}

/** Fill a periodic lane with vehicles at a given density (veh/km). */
export function populateLane(w: World, lane: Lane, perKm: number, mix: Mix, speed = 8) {
  const n = Math.floor((lane.length / 1000) * perKm);
  const step = lane.length / Math.max(n, 1);
  const r = w.spawnRng;
  for (let i = 0; i < n; i++) {
    const type = r.weighted<VType>(mix);
    const u = r.next();
    const traits = [r.next(), r.next(), r.next(), r.next(), r.next(), r.next()];
    const cols = VSPECS[type].colors;
    const color = cols[Math.floor(r.next() * cols.length)];
    const s = i * step + r.range(0, step * 0.3) + VSPECS[type].len;
    w.spawnVehicle({ type, u, traits, moves: ['S'], color, laneU: 0, t: w.t }, lane, Math.min(s, lane.length - 0.1), speed);
  }
}
