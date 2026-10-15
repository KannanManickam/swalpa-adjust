// 04 · Lane & Gap — a 3-lane stretch with no signal, no merge, no pothole.
// Status quo: tailgating plus constant lane-hopping. Every cut-in makes
// someone brake, the braking ripples backwards, and stop-and-go waves appear
// out of nowhere ("phantom jams").
// Swalpa adjust: hold your lane, keep a two-second gap, absorb the wave.

import { Path } from '../core/geom.ts';
import { Rng } from '../core/rng.ts';
import { BLR_MIX, CIVIC, SELFISH } from '../core/types.ts';
import { World, populateLane, type Lane, type Vehicle } from '../core/world.ts';
import type { Pose } from '../core/geom.ts';
import { decorate, type Net } from '../net.ts';
import { emptyVisual } from '../visual.ts';
import type { Annotation, ScenarioDef } from './types.ts';
import { BLUE } from './palette.ts';

const STOP_RED = 0xe2364a;
const SLOW_AMBER = 0xf5a524;

const L = 440;
const LW = 3.3;
const N = 3;

export const phantom: ScenarioDef = {
  id: 'phantom',
  warmup: 200,
  split: 'v',
  view: 'split',
  aspect: '16/8',
  speed: 1.6,
  camera: { pitch: 1.12 },
  metrics: [
    { key: 'speed', label: 'Average speed', unit: 'km/h', better: 'higher', hero: true, up: 'faster', down: 'slower' },
    { key: 'stopped', label: 'Vehicles at a standstill', unit: '%', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'brakes', label: 'Hard brakes per minute', unit: '/min', better: 'lower', digits: 1, down: 'fewer', up: 'more' },
    { key: 'lcs', label: 'Lane changes per minute', unit: '/min', better: 'lower', digits: 0, down: 'fewer', up: 'more' },
    { key: 'lost', label: 'People-minutes lost', unit: 'min', better: 'lower', down: 'less', up: 'more' },
  ],
  build(seed, civicShare) {
    const w = new World({
      seed,
      civicShare,
      name: 'phantom',
      // same headway for everyone; the difference is lane-hopping and reactive vs anticipating driving
      selfish: { ...SELFISH, Tmul: 0.8, s0mul: 0.8, lcThresh: 0.02, lcCooldown: [0.8, 2.2], lcEvalPeriod: 0.3, bSafe: 6, lag: 0.65 },
      civic: { ...CIVIC, Tmul: 0.8, s0mul: 0.8, lcThresh: 0.45, lcCooldown: [8, 14], politeness: 0.6, lag: 0.2 },
    });
    const x0 = -L / 2;
    const lanes: Lane[] = [];
    for (let i = 0; i < N; i++) {
      // eastbound: kerb lane (0) on the north side (negative y)
      const y = -((N - i - 0.5) * LW) - 0.6;
      const lane = w.addLane(Path.line({ x: x0, y }, { x: x0 + L, y }), LW);
      lane.periodic = true;
      lane.index = i;
      lane.vLimit = 15;
      lanes.push(lane);
    }
    for (let i = 1; i < N; i++) w.neighbours(lanes[i], lanes[i - 1], 'left');
    // slower vehicles keep left when drivers are disciplined
    w.hooks.lcBias = (_w, v, dir) => {
      if (!v.civic) return 0;
      const slow = v.type === 'bus' || v.type === 'truck' || v.type === 'auto';
      return slow ? (dir < 0 ? 0.35 : -0.5) : 0;
    };
    const density = [84, 87, 84];
    lanes.forEach((ln, i) => populateLane(w, ln, density[i], BLR_MIX, 9));
    let lcCount = 0;
    const exec = w.executeLC.bind(w);
    w.executeLC = (v, link, dir, forced) => {
      lcCount++;
      exec(v, link, dir, forced);
    };

    // ---- visuals: a long elevated stretch ----
    const vis = emptyVisual();
    const yK = -(N * LW) - 0.6;
    const yM = -0.6;
    vis.asphalt.push([
      { x: x0, y: yK },
      { x: x0 + L, y: yK },
      { x: x0 + L, y: yM },
      { x: x0, y: yM },
    ]);
    // opposite carriageway (empty decor) and median
    vis.asphalt.push([
      { x: x0, y: 0.6 },
      { x: x0 + L, y: 0.6 },
      { x: x0 + L, y: 0.6 + N * LW },
      { x: x0, y: 0.6 + N * LW },
    ]);
    vis.medians.push({
      pts: [
        { x: x0, y: 0 },
        { x: x0 + L, y: 0 },
      ],
      width: 1.2,
    });
    for (let i = 1; i < N; i++) {
      const y = yK + i * LW;
      vis.lines.push({
        pts: [
          { x: x0, y },
          { x: x0 + L, y },
        ],
        color: 'white',
        width: 0.13,
        dash: [3, 4.5],
      });
      vis.lines.push({
        pts: [
          { x: x0, y: -y },
          { x: x0 + L, y: -y },
        ],
        color: 'white',
        width: 0.13,
        dash: [3, 4.5],
      });
    }
    for (const y of [yK + 0.35, yM - 0.3, 0.9, 0.6 + N * LW - 0.35])
      vis.lines.push({
        pts: [
          { x: x0, y },
          { x: x0 + L, y },
        ],
        color: 'white',
        width: 0.1,
      });
    vis.kerbs.push([
      { x: x0, y: yK },
      { x: x0 + L, y: yK },
    ]);
    vis.kerbs.push([
      { x: x0, y: 0.6 + N * LW },
      { x: x0 + L, y: 0.6 + N * LW },
    ]);
    for (const y of [yK - 2.6, 0.6 + N * LW]) {
      vis.footpaths.push([
        { x: x0, y },
        { x: x0 + L, y },
        { x: x0 + L, y: y + 2.6 },
        { x: x0, y: y + 2.6 },
      ]);
    }
    for (let x = x0 + 10; x < x0 + L; x += 30) {
      vis.lamps.push({ x, y: yK - 0.8 });
      vis.lamps.push({ x: x + 15, y: 0.6 + N * LW + 0.8 });
    }
    // the whole 440 m loop is on show, so a jam can be followed all the way round
    vis.bounds = { minX: x0 - 2, maxX: x0 + L + 2, minY: -18, maxY: 16 };
    const corr = [{ a: { x: x0 - 20, y: 0 }, b: { x: x0 + L + 20, y: 0 }, r: N * LW + 5 }];
    decorate(vis, new Rng(seed + 11), corr as ReturnType<Net['corridors']>, { density: 0.5, maxH: 22 });
    for (let x = x0 + 6; x < x0 + L; x += 12) {
      vis.trees.push({ x: x + ((x * 13) % 5), y: yK - 5, r: 3.2, kind: Math.floor(x / 12) % 5 === 0 ? 'pink' : 'rain' });
      vis.trees.push({ x: x + 6, y: 0.6 + N * LW + 5, r: 3.0, kind: Math.floor(x / 12) % 7 === 0 ? 'gulmohar' : 'rain' });
    }

    let brakeT0 = 0;
    let brakes0 = 0;
    let lc0 = 0;
    let brakeRate = 0;
    let lcRate = 0;
    let stoppedEma = 0;
    let speedEma = 0;
    w.hooks.afterStep = (world) => {
      const n = world.vehicles.length || 1;
      stoppedEma += ((world.metrics.stoppedNow / n) * 100 - stoppedEma) * (world.dt / 20);
      speedEma += (world.metrics.meanSpeed * 3.6 - speedEma) * (world.dt / 20);
      if (world.t - brakeT0 >= 20) {
        const span = world.t - brakeT0;
        const br = ((world.metrics.hardBrakes - brakes0) / span) * 60;
        const lr = ((lcCount - lc0) / span) * 60;
        brakeRate = brakeRate ? brakeRate * 0.5 + br * 0.5 : br;
        lcRate = lcRate ? lcRate * 0.5 + lr * 0.5 : lr;
        brakeT0 = world.t;
        brakes0 = world.metrics.hardBrakes;
        lc0 = lcCount;
      }
      trackWave(world);
    };
    // ---- the stop-and-go wave: the biggest cluster of stopped vehicles, tracked over time ----
    const VIEW = { minX: vis.bounds.minX + 4, maxX: vis.bounds.maxX - 4 };
    const wave = { on: false, x0: 0, x1: 0, c: 0, vx: 0, n: 0, since: 0 };
    let waveT = 0;
    const findWave = () => {
      const xs: number[] = [];
      for (const v of w.vehicles) if (v.v < 1.5) xs.push(v.pose(pose).x);
      xs.sort((a, b) => a - b);
      // clusters: stopped vehicles less than 18 m apart (across all three lanes)
      let best: { x0: number; x1: number; n: number } | null = null;
      let i = 0;
      while (i < xs.length) {
        let j = i;
        while (j + 1 < xs.length && xs[j + 1] - xs[j] < 18) j++;
        const n = j - i + 1;
        if (n >= 4 && (!best || n > best.n)) best = { x0: xs[i], x1: xs[j], n };
        i = j + 1;
      }
      return best;
    };
    const trackWave = (world: World) => {
      if (world.t - waveT < 0.5) return;
      const dt = world.t - waveT;
      waveT = world.t;
      const c = findWave();
      if (!c) {
        wave.on = false;
        return;
      }
      const centre = (c.x0 + c.x1) / 2;
      if (wave.on && Math.abs(centre - wave.c) < 25) wave.vx += ((centre - wave.c) / dt - wave.vx) * 0.08;
      else {
        wave.vx = 0;
        wave.since = world.t;
      }
      Object.assign(wave, { on: true, x0: c.x0, x1: c.x1, c: centre, n: c.n });
    };

    // ---- explanation: colours and call-outs ----
    const colorBy = (v: Vehicle) => (v.v < 1.5 ? STOP_RED : v.v < 5 ? SLOW_AMBER : BLUE);
    const pose: Pose = { x: 0, y: 0, h: 0 };
    const at = (v: Vehicle) => (v.pose(pose), { x: pose.x, y: pose.y });
    const inView = (v: Vehicle, margin = 0) => {
      const x = v.pose(pose).x;
      return x > VIEW.minX + margin && x < VIEW.maxX - margin;
    };
    // call-outs stick to one vehicle for a moment so they can be read
    const sticky: Record<string, { v: Vehicle; until: number }> = {};
    const hold = (key: string, pick: () => Vehicle | undefined, ok: (v: Vehicle) => boolean, secs: number) => {
      const cur = sticky[key];
      if (cur && cur.v.alive && w.t < cur.until && ok(cur.v)) return cur.v;
      const v = pick();
      if (v) sticky[key] = { v, until: w.t + secs };
      else delete sticky[key];
      return v;
    };
    const near = (v: Vehicle, zone: { minX: number; maxX: number }) => {
      const x = v.pose(pose).x;
      return x > zone.minX && x < zone.maxX;
    };
    const ZOOM = { minX: -34, maxX: 34 };
    let cut: { h: Vehicle; f: Vehicle; until: number } | null = null;
    const annotate = (mode: string): Annotation[] => {
      const out: Annotation[] = [];
      if (mode === 'setup') {
        out.push({ kind: 'tag', id: 'none', x: 30, y: yK - 1, text: 'No signal, no merge, no pothole', tone: 'info', h: 0.4 });
        out.push({ kind: 'tag', id: 'busy', x: -60, y: yK - 1, text: 'Busy: about 85 vehicles per km in each lane', tone: 'info', h: 0.4 });
      } else if (mode === 'problems') {
        // a lane-hop, and the driver it cuts in front of braking for it
        const behind = (h: Vehicle) => {
          const arr = h.lane.vehicles;
          const k = arr.indexOf(h);
          return k > 0 ? arr[k - 1] : arr[arr.length - 1] !== h ? arr[arr.length - 1] : undefined;
        };
        if (!cut || !cut.h.alive || !cut.h.lcActive || w.t > cut.until || behind(cut.h) !== cut.f || !near(cut.h, ZOOM)) {
          cut = null;
          for (const h of w.vehicles) {
            if (h.civic || !h.lcActive || h.lcT > 0.8 || !near(h, ZOOM)) continue;
            const f = behind(h);
            if (f && f.acc < -2.5) {
              cut = { h, f, until: w.t + 2.2 };
              break;
            }
          }
        }
        const hopper =
          cut?.h ??
          hold(
            'hop',
            () => w.vehicles.find((v) => !v.civic && v.lcActive && v.lcT < 0.8 && near(v, ZOOM)),
            (v) => v.lcActive && near(v, ZOOM),
            1.8,
          );
        if (hopper) out.push({ kind: 'tag', id: `hp${hopper.id}`, ...at(hopper), text: 'Hops lanes for a one-car gain', tone: 'warn', ring: 2.4 });
        if (cut) out.push({ kind: 'tag', id: `ct${cut.f.id}`, ...at(cut.f), text: 'Brakes for the cut-in', tone: 'bad', ring: 2.4, side: 'down' });
      } else if (mode === 'wave') {
        const x0 = Math.max(wave.x0 - 3, VIEW.minX);
        const x1 = Math.min(wave.x1 + 3, VIEW.maxX);
        const shown = wave.on ? w.vehicles.filter((v) => v.v < 1.5 && near(v, { minX: x0, maxX: x1 })).length : 0;
        if (shown >= 4) {
          const kmh = Math.round((-wave.vx * 3.6) / 1);
          const drift = wave.vx < -0.5 && w.t - wave.since > 4 ? ` · drifting back at ${kmh} km/h` : '';
          out.push({
            kind: 'bracket',
            id: 'wave',
            x0,
            x1,
            y: yK - 1.5,
            text: `Stop-and-go wave${drift}`,
            tone: 'bad',
          });
        } else out.push({ kind: 'tag', id: 'calm', x: 0, y: yK - 1, text: 'The next wave is on its way round', tone: 'info', h: 0.4 });
      } else if (mode === 'fix') {
        const steady = hold(
          'steady',
          () => w.vehicles.find((v) => v.type === 'car' && near(v, { minX: -20, maxX: 0 })),
          (v) => near(v, { minX: ZOOM.minX - 8, maxX: ZOOM.maxX }),
          30,
        );
        if (steady)
          out.push({ kind: 'tag', id: `st${steady.id}`, ...at(steady), text: `Holds its lane · ${Math.round(steady.v * 3.6)} km/h`, tone: 'good', ring: 2.4 });
      } else if (mode === 'after') {
        let stopped = 0;
        for (const v of w.vehicles) if (v.v < 1.5 && inView(v)) stopped++;
        out.push({
          kind: 'tag',
          id: 'flow',
          x: 0,
          y: yK - 1,
          text: stopped ? `${stopped} stopped` : 'No waves: everyone keeps moving',
          tone: stopped ? 'warn' : 'good',
          h: 0.4,
        });
      }
      return out;
    };

    const sample = () => ({
      speed: speedEma,
      stopped: stoppedEma,
      brakes: brakeRate,
      lcs: lcRate,
      lost: w.metrics.peopleSecLost / 60,
    });
    // the camera follows the jam as it drifts backwards
    const track = (mode: string) => (mode === 'wave' && wave.on ? { x: wave.c, y: (yK + yM) / 2 } : null);
    return { world: w, vis, sample, annotate, colorBy, track };
  },
};
