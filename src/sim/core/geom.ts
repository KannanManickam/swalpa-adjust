// Geometry helpers. World units are metres.
// Coordinate system is "screen-like": +x = east (right), +y = south (down).
// Bengaluru drives on the LEFT, so for a heading (dx, dy) the kerb side is
// the left normal, which in y-down coordinates is (dy, -dx).

export type Vec2 = { x: number; y: number };
export type Pose = { x: number; y: number; h: number }; // h = heading in radians (atan2(dy, dx))

export const v2 = (x: number, y: number): Vec2 => ({ x, y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const len = (a: Vec2) => Math.hypot(a.x, a.y);
export const norm = (a: Vec2): Vec2 => {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** Left normal (kerb side for left-hand traffic) in y-down coords. */
export const leftOf = (d: Vec2): Vec2 => ({ x: d.y, y: -d.x });
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, lo: number, hi: number) => (x < lo ? lo : x > hi ? hi : x);
export const smoothstep = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Polyline path with arc-length parameterisation. */
export class Path {
  readonly pts: Vec2[];
  readonly cum: number[];
  readonly length: number;

  constructor(pts: Vec2[]) {
    if (pts.length < 2) throw new Error('Path needs at least 2 points');
    this.pts = pts;
    this.cum = [0];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      this.cum.push(acc);
    }
    this.length = acc;
  }

  static line(a: Vec2, b: Vec2): Path {
    return new Path([a, b]);
  }

  /** Cubic Bezier sampled into a polyline. */
  static bezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, n = 24): Path {
    const pts: Vec2[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      pts.push({
        x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      });
    }
    return new Path(pts);
  }

  /** Smooth connector between two poses (end of one lane, start of another). */
  static connect(a: Pose, b: Pose, n = 24): Path {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    const k = d * 0.42;
    return Path.bezier(
      { x: a.x, y: a.y },
      { x: a.x + Math.cos(a.h) * k, y: a.y + Math.sin(a.h) * k },
      { x: b.x - Math.cos(b.h) * k, y: b.y - Math.sin(b.h) * k },
      { x: b.x, y: b.y },
      n,
    );
  }

  /** Circular arc. Angles in radians, y-down. */
  static arc(c: Vec2, r: number, a0: number, a1: number, n = 32): Path {
    const pts: Vec2[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r });
    }
    return new Path(pts);
  }

  private seg(s: number): number {
    const c = this.cum;
    if (s <= 0) return 0;
    if (s >= this.length) return c.length - 2;
    let lo = 0;
    let hi = c.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (c[mid] <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  /** Pose at arc length s (clamped/extrapolated linearly beyond ends). */
  pose(s: number, out: Pose = { x: 0, y: 0, h: 0 }): Pose {
    const i = this.seg(s);
    const a = this.pts[i];
    const b = this.pts[i + 1];
    const sl = this.cum[i + 1] - this.cum[i] || 1e-9;
    const t = (s - this.cum[i]) / sl;
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.h = Math.atan2(b.y - a.y, b.x - a.x);
    return out;
  }

  start(): Pose {
    return this.pose(0);
  }
  end(): Pose {
    return this.pose(this.length);
  }

  /** Parallel offset; positive d = towards the left normal (kerb side). */
  offset(d: number): Path {
    const n = this.pts.length;
    const out: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const prev = this.pts[Math.max(0, i - 1)];
      const next = this.pts[Math.min(n - 1, i + 1)];
      const dir = norm(sub(next, prev));
      const ln = leftOf(dir);
      out.push({ x: p.x + ln.x * d, y: p.y + ln.y * d });
    }
    return new Path(out);
  }

  /** Sub-path between s0 and s1. */
  slice(s0: number, s1: number): Path {
    const pts: Vec2[] = [this.pose(s0)];
    for (let i = 0; i < this.pts.length; i++) {
      if (this.cum[i] > s0 && this.cum[i] < s1) pts.push(this.pts[i]);
    }
    const e = this.pose(s1);
    pts.push({ x: e.x, y: e.y });
    return new Path(pts.map((p) => ({ x: p.x, y: p.y })));
  }
}

/** Intersection of segments p-p2 and q-q2. Returns params along each, or null. */
export function segIntersect(p: Vec2, p2: Vec2, q: Vec2, q2: Vec2): { t: number; u: number } | null {
  const rx = p2.x - p.x;
  const ry = p2.y - p.y;
  const sx = q2.x - q.x;
  const sy = q2.y - q.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qpx = q.x - p.x;
  const qpy = q.y - p.y;
  const t = (qpx * sy - qpy * sx) / den;
  const u = (qpx * ry - qpy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

/** All crossings of two paths, as arc-length positions on each. */
export function pathCrossings(a: Path, b: Path): { sa: number; sb: number }[] {
  const res: { sa: number; sb: number }[] = [];
  for (let i = 0; i < a.pts.length - 1; i++) {
    for (let j = 0; j < b.pts.length - 1; j++) {
      const hit = segIntersect(a.pts[i], a.pts[i + 1], b.pts[j], b.pts[j + 1]);
      if (hit) {
        res.push({
          sa: a.cum[i] + (a.cum[i + 1] - a.cum[i]) * hit.t,
          sb: b.cum[j] + (b.cum[j + 1] - b.cum[j]) * hit.u,
        });
      }
    }
  }
  return res;
}
