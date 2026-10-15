// Per-frame instanced rendering of vehicles, their lights, pedestrians and effects.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Pose } from '../sim/core/geom.ts';
import type { VType } from '../sim/core/types.ts';
import type { World, Vehicle } from '../sim/core/world.ts';
import { SpriteBatch } from './sprites.ts';
import { beamTexture, glowTexture, ringTexture } from './textures.ts';
import type { Theme } from './theme.ts';

const CAP: Record<VType, number> = { bike: 900, car: 600, cab: 260, auto: 300, bus: 120, truck: 120 };

export interface LayerOpts {
  clip?: THREE.Plane[];
  theme: Theme;
  /** Override vehicle colours (e.g. colour by lane of origin when explaining). */
  colorBy?: ((v: Vehicle) => number | null) | null;
}

/** Write a yaw-only transform straight into an instance matrix array. */
function setYaw(arr: Float32Array, i: number, x: number, y: number, z: number, h: number, sx = 1, sy = 1, sz = 1) {
  const o = i * 16;
  const c = Math.cos(h);
  const s = -Math.sin(h);
  arr[o] = c * sx;
  arr[o + 1] = 0;
  arr[o + 2] = -s * sx;
  arr[o + 3] = 0;
  arr[o + 4] = 0;
  arr[o + 5] = sy;
  arr[o + 6] = 0;
  arr[o + 7] = 0;
  arr[o + 8] = s * sz;
  arr[o + 9] = 0;
  arr[o + 10] = c * sz;
  arr[o + 11] = 0;
  arr[o + 12] = x;
  arr[o + 13] = y;
  arr[o + 14] = z;
  arr[o + 15] = 1;
}

interface Part {
  mesh: THREE.InstancedMesh;
  color: 'instance' | 'fixed' | 'accent';
}

function box(w: number, h: number, d: number, x: number, y: number, r = 0): THREE.BufferGeometry {
  const g = r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, 0);
  return g;
}

function makeParts(type: VType, opts: LayerOpts): Part[] {
  const cap = CAP[type];
  const day = opts.theme.name === 'day';
  const std = (p: THREE.MeshStandardMaterialParameters) => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.45, metalness: day ? 0.05 : 0.2, clippingPlanes: opts.clip ?? null, ...p });
    // let paint colours glow a little so traffic reads at night (and stays crisp by day)
    const k = day ? 0.12 : 0.32;
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance += vColor * ${k.toFixed(2)};\n#endif`,
      );
    };
    return m;
  };
  const glass = std({ color: day ? '#2b3644' : '#0f1724', roughness: 0.15, metalness: 0.6, emissive: '#0b1626', emissiveIntensity: day ? 0 : 0.4 });
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, color: Part['color']): Part => {
    const mesh = new THREE.InstancedMesh(g, m, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = opts.theme.key.shadows;
    return { mesh, color };
  };
  switch (type) {
    case 'car':
    case 'cab': {
      const body = box(4.15, 0.8, 1.76, 0, 0.6, 0.28);
      const cabin = box(2.15, 0.56, 1.48, -0.25, 1.22, 0.22);
      return [mk(body, std({}), 'instance'), mk(cabin, glass, 'fixed')];
    }
    case 'bike': {
      const body = box(1.85, 0.45, 0.42, 0, 0.62);
      const rider = new THREE.CapsuleGeometry(0.24, 0.42, 4, 8).translate(-0.25, 1.15, 0);
      const helmet = new THREE.SphereGeometry(0.2, 10, 8).translate(-0.18, 1.62, 0);
      return [
        mk(body, std({ color: '#ffffff' }), 'instance'),
        mk(rider, std({ color: '#ffffff', roughness: 0.8, metalness: 0 }), 'accent'),
        mk(helmet, std({ color: '#ffffff', roughness: 0.3 }), 'accent'),
      ];
    }
    case 'auto': {
      const body = box(2.6, 0.85, 1.32, 0, 0.62, 0.2);
      const canopy = box(2.05, 0.6, 1.38, -0.2, 1.38, 0.22);
      return [mk(body, std({}), 'instance'), mk(canopy, std({ roughness: 0.55 }), 'accent')];
    }
    case 'bus': {
      const lower = box(11.4, 1.25, 2.55, 0, 0.9);
      const band = box(11.2, 1.05, 2.48, 0, 2.05);
      const roof = box(11.3, 0.32, 2.52, 0, 2.72, 0.12);
      return [mk(lower, std({}), 'instance'), mk(band, glass, 'fixed'), mk(roof, std({ roughness: 0.6 }), 'accent')];
    }
    case 'truck': {
      const cab = box(2.1, 2.1, 2.35, 2.9, 1.25, 0.15);
      const cargo = box(5.7, 2.55, 2.42, -1.05, 1.55, 0.08);
      return [mk(cab, std({}), 'instance'), mk(cargo, std({ roughness: 0.85, metalness: 0 }), 'accent')];
    }
  }
}

const HELMETS = [0xf2f2f2, 0xd62828, 0x1d4ed8, 0x111111, 0xf59e0b, 0x16a34a, 0x7c3aed, 0xe5e7eb];
const SHIRTS = [0x2563eb, 0xdc2626, 0xf8fafc, 0x16a34a, 0xf59e0b, 0x6b7280, 0x0891b2, 0x9333ea];
const TARPS = [0x1f5130, 0x1e3a8a, 0x8b5a2b, 0x0f766e];

export class VehicleLayer {
  group = new THREE.Group();
  parts: Record<VType, Part[]>;
  private glows: SpriteBatch;
  private beams: SpriteBatch | null = null;
  private pose: Pose = { x: 0, y: 0, h: 0 };
  private col = new THREE.Color();
  private opts: LayerOpts;

  constructor(opts: LayerOpts) {
    this.opts = opts;
    this.parts = {} as Record<VType, Part[]>;
    for (const t of Object.keys(CAP) as VType[]) {
      this.parts[t] = makeParts(t, opts);
      for (const p of this.parts[t]) this.group.add(p.mesh);
    }
    const night = opts.theme.nightLights;
    this.glows = new SpriteBatch(glowTexture(), 6000, { additive: night, clip: opts.clip, renderOrder: 5 });
    this.group.add(this.glows.mesh);
    if (night) {
      this.beams = new SpriteBatch(beamTexture(), 1600, { additive: true, clip: opts.clip, renderOrder: 4 });
      this.group.add(this.beams.mesh);
    }
  }

  update(world: World, t: number) {
    const counts: Record<VType, number> = { bike: 0, car: 0, cab: 0, auto: 0, bus: 0, truck: 0 };
    const night = this.opts.theme.nightLights;
    const colorBy = this.opts.colorBy;
    const col = this.col;
    const glows = this.glows;
    const beams = this.beams;
    glows.begin();
    beams?.begin();
    const blink = Math.sin(t * 9) > 0;
    const dot = (x: number, y: number, z: number, s: number, r: number, g: number, b: number, a = 1) => glows.push(x, y, z, 0, s, s, r, g, b, a);
    for (const v of world.vehicles) {
      const type = v.type;
      const parts = this.parts[type];
      const i = counts[type]++;
      if (i >= CAP[type]) continue;
      const p = v.pose(this.pose);
      const h = p.h;
      const override = colorBy ? colorBy(v) : null;
      for (const part of parts) {
        setYaw(part.mesh.instanceMatrix.array as Float32Array, i, p.x, 0, p.y, h);
        if (part.color === 'instance') {
          col.setHex(override ?? v.color);
          part.mesh.setColorAt(i, col);
        } else if (part.color === 'accent') {
          col.setHex(override !== null && (type === 'bike' || type === 'truck') ? override : this.accent(v));
          part.mesh.setColorAt(i, col);
        }
      }
      // ---- lights ----
      const ch = Math.cos(h);
      const sh = Math.sin(h);
      const lx = sh; // left normal (y-down coords)
      const ly = -ch;
      const half = v.len / 2;
      const fx = p.x + ch * half;
      const fy = p.y + sh * half;
      const rx = p.x - ch * half;
      const ry = p.y - sh * half;
      const narrow = type === 'bike' || type === 'auto';
      const sep = narrow ? 0 : v.wid * 0.36;
      const hy = type === 'bus' || type === 'truck' ? 1.1 : 0.85;
      const br = v.brake;
      if (night) {
        const head = narrow ? 2.0 : 1.7;
        if (narrow) dot(fx, hy, fy, head, 1.4, 1.25, 1.0);
        else {
          dot(fx + lx * sep, hy, fy + ly * sep, head, 1.3, 1.18, 0.95);
          dot(fx - lx * sep, hy, fy - ly * sep, head, 1.3, 1.18, 0.95);
        }
        if (beams) {
          const bl = narrow ? 7.5 : type === 'bus' || type === 'truck' ? 12 : 10.5;
          const bw = narrow ? 2.8 : 4.0;
          beams.push(fx + ch * bl * 0.5, 0.08, fy + sh * bl * 0.5, h, bl, bw, 0.26, 0.234, 0.187, 1);
        }
        const tailI = 0.45 + br * 1.8;
        const ts = 1.0 + br * 1.1;
        if (type === 'bike') dot(rx, hy, ry, ts, tailI, 0.05 * tailI, 0.08 * tailI);
        else {
          const ss = narrow ? v.wid * 0.3 : v.wid * 0.38;
          dot(rx + lx * ss, hy, ry + ly * ss, ts, tailI, 0.05 * tailI, 0.08 * tailI);
          dot(rx - lx * ss, hy, ry - ly * ss, ts, tailI, 0.05 * tailI, 0.08 * tailI);
        }
        if (br > 0.45) dot(rx - ch * 1.6, 0.1, ry - sh * 1.6, 3.6 + br * 1.5, 0.32 * br, 0.01, 0.03 * br);
      } else if (br > 0.3) {
        // daylight: brake lights only when braking, plus a soft red patch behind
        const ss = narrow ? 0 : v.wid * 0.38;
        dot(rx + lx * ss, hy + 0.3, ry + ly * ss, 0.95, 1, 0.12, 0.15, 0.95);
        if (ss) dot(rx - lx * ss, hy + 0.3, ry - ly * ss, 0.95, 1, 0.12, 0.15, 0.95);
        if (br > 0.5) dot(rx - ch * 1.2, 0.12, ry - sh * 1.2, 3.2 + br * 1.4, 0.95, 0.15, 0.18, 0.28 * br);
      }
      // indicators when changing lanes / forcing a merge
      const ind = v.indicator !== 0 ? v.indicator : v.standoff > 0 ? v.standoffDir : 0;
      if (ind !== 0 && blink) {
        const side = -ind; // -1 (kerb/left) => +left normal
        const ox = lx * side * (v.wid * 0.5 + 0.1);
        const oy = ly * side * (v.wid * 0.5 + 0.1);
        const a = night ? 1 : 0.95;
        const k = night ? 1.4 : 1;
        dot(fx + ox - ch * 0.3, hy + (night ? 0 : 0.3), fy + oy - sh * 0.3, 1.0, k, 0.55 * k, 0.05, a);
        dot(rx + ox + ch * 0.3, hy + (night ? 0 : 0.3), ry + oy + sh * 0.3, 1.0, k, 0.55 * k, 0.05, a);
      }
      // hazard aura for nose-to-nose standoffs
      if (v.standoff > 0 || v.nose > 0.3) {
        const k = 0.35 + 0.25 * Math.sin(t * 10);
        if (night) dot(p.x, 0.15, p.y, v.len + 3, k, 0.08 * k, 0.05 * k);
        else dot(p.x, 0.15, p.y, v.len + 3, 0.95, 0.2, 0.2, 0.25 + 0.2 * Math.sin(t * 10));
      }
    }
    for (const type of Object.keys(CAP) as VType[]) {
      for (const part of this.parts[type]) {
        part.mesh.count = Math.min(counts[type], CAP[type]);
        part.mesh.instanceMatrix.needsUpdate = true;
        if (part.mesh.instanceColor) part.mesh.instanceColor.needsUpdate = true;
      }
    }
    glows.end();
    beams?.end();
  }

  private accent(v: Vehicle): number {
    switch (v.type) {
      case 'bike':
        return HELMETS[Math.floor(v.traits[2] * HELMETS.length)];
      case 'bus':
        return 0xe9edf2;
      case 'truck':
        return TARPS[Math.floor(v.traits[2] * TARPS.length)];
      case 'auto':
        return 0xffd21a;
      default:
        return SHIRTS[Math.floor(v.traits[2] * SHIRTS.length)];
    }
  }

  dispose() {
    for (const t of Object.keys(this.parts) as VType[]) {
      for (const p of this.parts[t]) {
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        p.mesh.dispose();
      }
    }
    this.glows.dispose();
    this.beams?.dispose();
  }
}

export class PedLayer {
  group = new THREE.Group();
  bodies: THREE.InstancedMesh;
  heads: THREE.InstancedMesh;
  aura: SpriteBatch;
  private col = new THREE.Color();
  private night: boolean;

  constructor(opts: LayerOpts) {
    this.night = opts.theme.nightLights;
    const bg = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8).translate(0, 1.0, 0);
    this.bodies = new THREE.InstancedMesh(
      bg,
      new THREE.MeshStandardMaterial({ roughness: 0.8, clippingPlanes: opts.clip ?? null, emissive: '#ffffff', emissiveIntensity: this.night ? 0.35 : 0.05 }),
      300,
    );
    const hg = new THREE.SphereGeometry(0.3, 10, 8).translate(0, 2.15, 0);
    this.heads = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ color: '#3b2a20', roughness: 0.7, clippingPlanes: opts.clip ?? null }), 300);
    this.aura = new SpriteBatch(glowTexture(), 300, { additive: this.night, clip: opts.clip, renderOrder: 3 });
    for (const m of [this.bodies, this.heads]) {
      m.count = 0;
      m.frustumCulled = false;
      m.castShadow = opts.theme.key.shadows;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    this.group.add(this.aura.mesh);
    this.bodies.setColorAt(0, this.col);
  }

  update(world: World) {
    const peds = world.peds;
    const n = Math.min(peds.length, 300);
    const bArr = this.bodies.instanceMatrix.array as Float32Array;
    const hArr = this.heads.instanceMatrix.array as Float32Array;
    this.aura.begin();
    for (let i = 0; i < n; i++) {
      const p = peds[i];
      const bob = Math.abs(Math.sin(p.phase)) * 0.06;
      setYaw(bArr, i, p.x, 0.16 + bob, p.y, p.h);
      setYaw(hArr, i, p.x, 0.16 + bob, p.y, p.h);
      this.bodies.setColorAt(i, this.col.setHex(p.color));
      const d = p.danger;
      const crossing = p.state === 'cross' || p.state === 'refuge';
      const s = 4.2 + d * 6;
      if (d > 0.05) this.aura.push(p.x, 0.12, p.y, 0, s, s, this.night ? 1.8 * d + 0.2 : 1, 0.12, 0.12, this.night ? 1 : 0.5 * d + 0.1);
      else if (this.night) this.aura.push(p.x, 0.12, p.y, 0, s, s, crossing ? 0.55 : 0.3, crossing ? 0.5 : 0.28, crossing ? 0.4 : 0.24, 1);
    }
    this.aura.end();
    for (const m of [this.bodies, this.heads]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const m of [this.bodies, this.heads]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
    this.aura.dispose();
  }
}

interface Ring {
  x: number;
  y: number;
  t0: number;
  r: number;
  g: number;
  b: number;
  size: number;
  life: number;
}

/** Honk ripples, near-miss flashes and merge stand-off rings. */
export class FxLayer {
  group = new THREE.Group();
  private rings: SpriteBatch;
  private live: Ring[] = [];
  private night: boolean;

  constructor(opts: LayerOpts) {
    this.night = opts.theme.nightLights;
    this.rings = new SpriteBatch(ringTexture(), 160, { additive: this.night, clip: opts.clip, renderOrder: 6 });
    this.group.add(this.rings.mesh);
  }

  update(world: World, t: number) {
    const ev = world.events;
    for (const e of ev) {
      if (this.live.length > 150) this.live.shift();
      if (e.kind === 'honk') this.live.push({ x: e.x, y: e.y, t0: t, r: 1.0, g: 0.62, b: 0.18, size: 9, life: 1.1 });
      else if (e.kind === 'nearmiss') this.live.push({ x: e.x, y: e.y, t0: t, r: 1.8, g: 0.1, b: 0.12, size: 16, life: 1.6 });
      else if (e.kind === 'merge') this.live.push({ x: e.x, y: e.y, t0: t, r: 1.4, g: 0.25, b: 0.15, size: 11, life: 1.2 });
      else if (e.kind === 'hardbrake' && Math.random() < 0.5) this.live.push({ x: e.x, y: e.y, t0: t, r: 1.0, g: 0.08, b: 0.1, size: 6, life: 0.7 });
    }
    ev.length = 0;
    this.live = this.live.filter((r) => t - r.t0 < r.life);
    this.rings.begin();
    for (const r of this.live) {
      const a = (t - r.t0) / r.life;
      const s = 1 + a * r.size;
      const k = (1 - a) * (1 - a);
      if (this.night) this.rings.push(r.x, 0.3, r.y, 0, s, s, r.r * k, r.g * k, r.b * k, 1);
      else this.rings.push(r.x, 0.3, r.y, 0, s, s, Math.min(1, r.r), Math.min(1, r.g), Math.min(1, r.b), 0.7 * k);
    }
    this.rings.end();
  }

  dispose() {
    this.rings.dispose();
  }
}
