// A Stage owns one WebGL canvas showing two simulated worlds of the same
// scenario: the status quo (nobody adjusts) and "swalpa adjust" (a chosen
// share of drivers do). Worlds sit side by side ("split") or share one
// diorama with a draggable before/after divider ("wipe"). For guided
// explanations the camera can be focused on one world and a region of it,
// with call-outs anchored to live vehicles.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { Built, ScenarioDef } from '../sim/scenarios/types.ts';
import type { World } from '../sim/core/world.ts';
import type { VisualSpec } from '../sim/visual.ts';
import { buildStatic, type StaticScene } from './staticScene.ts';
import { FxLayer, PedLayer, VehicleLayer } from './dynamic.ts';
import { AnnotationLayer } from './annotations.ts';
import { themeByName, type Theme, type ThemeName } from './theme.ts';

export type Metrics = Record<string, number>;
export type Rect = { minX: number; maxX: number; minY: number; maxY: number };
export interface Focus {
  world: 'a' | 'b' | 'both';
  /** region of the world (sim coordinates) to frame; defaults to the whole diorama */
  region?: Rect;
  pitch?: number;
  /** rotate the camera around the target (radians); negative looks along +x from behind */
  yaw?: number;
  /** fraction of the canvas height to keep clear at the bottom (for captions) */
  lift?: number;
  /** fraction of the canvas height to keep clear at the top (for controls over the scene) */
  top?: number;
}

interface WorldSlot {
  built: Built;
  world: World;
  root: THREE.Group;
  stat: StaticScene | null;
  vehicles: VehicleLayer;
  peds: PedLayer;
  fx: FxLayer;
  anno: AnnotationLayer | null;
  offset: THREE.Vector3;
  clip?: THREE.Plane[];
}

interface View {
  target: THREE.Vector3;
  dist: number;
  pitch: number;
  yaw: number;
}

export interface StageOptions {
  canvas: HTMLCanvasElement;
  overlay?: HTMLElement | null;
  mode?: 'split' | 'wipe';
  quality?: 'high' | 'low';
  onMetrics?: (a: Metrics, b: Metrics, t: number) => void;
  labels?: { a: string; b: string };
  /** Pin the camera (no drift) — used by the film renderer. */
  steadyCam?: boolean;
  /** Where the world name tags sit in split mode. */
  tagAlign?: 'left' | 'right';
  theme?: ThemeName;
  /** 'explain' recolours vehicles with the scenario's explanatory colouring */
  colorMode?: 'paint' | 'explain';
}

const GAP = 9;
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private hemi: THREE.HemisphereLight;
  private key: THREE.DirectionalLight;
  private fill: THREE.DirectionalLight;
  private theme: Theme;
  private slots: WorldSlot[] = [];
  private def: ScenarioDef | null = null;
  private opts: StageOptions;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private clock = 0;
  private active = false;
  private playing = true;
  private speed = 1;
  private wipe = 0.5;
  private pitch = 0.95;
  private view: View = { target: new THREE.Vector3(), dist: 100, pitch: 0.95, yaw: 0 };
  private viewFrom: View | null = null;
  private viewTo: View | null = null;
  private tween = 1;
  private tweenDur = 1.2;
  private focus: Focus | null = null;
  private annoMode: string | null = null;
  /** camera pan that follows a moving point of interest (Built.track) */
  private trackOff = new THREE.Vector3();
  private trackWant = new THREE.Vector3();
  private trackClock = 0;
  /** jump straight to the tracked point on the next frame (after a cut) instead of easing */
  private trackSnap = false;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private metricsTimer = 0;
  private divider: THREE.Mesh | null = null;
  private labelEls: { el: HTMLElement; pos: THREE.Vector3; slot: number }[] = [];
  private wipePlanes: [THREE.Plane, THREE.Plane] = [new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
  private split: 'h' | 'v' = 'h';
  private loadToken = 0;
  /** camera override (film mode): yaw/pitch/zoom deltas and focus offset */
  cam = { yaw: 0, pitch: 0, zoom: 1, fx: 0, fz: 0 };

  constructor(opts: StageOptions) {
    this.opts = opts;
    const quality = opts.quality ?? 'high';
    this.theme = themeByName(opts.theme ?? 'night');
    this.renderer = new THREE.WebGLRenderer({
      canvas: opts.canvas,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: !!opts.steadyCam,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1.25));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.fog = new THREE.Fog(new THREE.Color(), 200, 900);

    this.hemi = new THREE.HemisphereLight();
    this.key = new THREE.DirectionalLight();
    this.fill = new THREE.DirectionalLight();
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.key, this.key.target, this.fill);

    if (quality === 'high') {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.55, 0.45, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this.applyTheme();
    opts.canvas.addEventListener('pointermove', this.onPointer);
    this.resize();
    if (import.meta.env?.DEV) {
      const w = window as unknown as { __stages?: Stage[] };
      (w.__stages ??= []).push(this);
    }
  }

  private applyTheme() {
    const T = this.theme;
    this.scene.background = T.bg.clone();
    (this.scene.fog as THREE.Fog).color.copy(T.fog);
    this.renderer.toneMappingExposure = T.exposure;
    this.hemi.color.set(T.hemi[0]);
    this.hemi.groundColor.set(T.hemi[1]);
    this.hemi.intensity = T.hemi[2];
    this.key.color.set(T.key.color);
    this.key.intensity = T.key.intensity;
    this.key.castShadow = T.key.shadows;
    this.renderer.shadowMap.enabled = T.key.shadows;
    this.fill.color.set(T.fill.color);
    this.fill.intensity = T.fill.intensity;
    this.fill.position.set(...T.fill.dir);
    if (this.bloom) this.bloom.enabled = T.bloom;
  }

  get themeName(): ThemeName {
    return this.theme.name;
  }

  /** Switch day/night: rebuilds the dioramas around the running simulations. */
  setTheme(name: ThemeName) {
    if (name === this.theme.name) return;
    this.theme = themeByName(name);
    this.applyTheme();
    if (this.slots.length === 2) {
      const [a, b] = this.slots.map((s) => s.built);
      this.clearSlots();
      this.mount(a, b, true);
    }
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.opts.canvas.getBoundingClientRect();
    this.pointer.tx = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.pointer.ty = ((e.clientY - r.top) / r.height) * 2 - 1;
  };

  /** Build both worlds for a scenario and warm them up in slices, so the page stays responsive. */
  static async prepare(
    def: ScenarioDef,
    civicShare: number,
    opts: { seed?: number; warmup?: number; onProgress?: (p: number) => void; cancelled?: () => boolean } = {},
  ): Promise<[Built, Built] | null> {
    const seed = opts.seed ?? 7;
    const a = def.build(seed, 0);
    const b = def.build(seed, civicShare);
    const warm = opts.warmup ?? def.warmup;
    // time-sliced so warming up never blocks scrolling or a playing film for more than a few ms
    let done = 0;
    while (done < warm) {
      if (opts.cancelled?.()) return null;
      const t0 = performance.now();
      while (done < warm && performance.now() - t0 < 7) {
        const dt = Math.min(0.5, warm - done);
        a.world.run(dt);
        b.world.run(dt);
        done += dt;
      }
      opts.onProgress?.(done / warm);
      await new Promise((r) => setTimeout(r, 0));
    }
    // rolling metrics include the last minute of warm-up, so numbers are steady from the first frame
    a.world.measureSince = Math.max(0, a.world.t - 60);
    b.world.measureSince = Math.max(0, b.world.t - 60);
    a.world.events.length = 0;
    b.world.events.length = 0;
    return [a, b];
  }

  async load(def: ScenarioDef, civicShare: number, opts: { seed?: number; onProgress?: (p: number) => void; warmup?: number } = {}) {
    const token = ++this.loadToken;
    this.clearSlots();
    const built = await Stage.prepare(def, civicShare, { ...opts, cancelled: () => token !== this.loadToken });
    if (!built || token !== this.loadToken) return;
    this.show(def, built[0], built[1]);
  }

  /** Mount two prepared worlds. */
  show(def: ScenarioDef, a: Built, b: Built) {
    this.clearSlots();
    this.def = def;
    this.speed = def.speed;
    this.pitch = def.camera?.pitch ?? 0.95;
    this.acc = 0;
    this.mount(a, b);
  }

  private mode(): 'split' | 'wipe' {
    return this.opts.mode ?? this.def?.view ?? 'split';
  }

  /** Four planes that cut everything outside a slab's footprint. */
  private slabPlanes(v: VisualSpec['bounds'], off: THREE.Vector3): THREE.Plane[] {
    return [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), -(v.minX + off.x)),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), v.maxX + off.x),
      new THREE.Plane(new THREE.Vector3(0, 0, 1), -(v.minY + off.z)),
      new THREE.Plane(new THREE.Vector3(0, 0, -1), v.maxY + off.z),
    ];
  }

  private mount(a: Built, b: Built, keepView = false) {
    const mode = this.mode();
    const vis = a.vis;
    const bw = vis.bounds.maxX - vis.bounds.minX;
    const bh = vis.bounds.maxY - vis.bounds.minY;
    const aspect = this.aspect();
    // two cut-out dioramas: stacked, unless the screen is very wide relative to the scene
    this.split = aspect > 2.6 * (bw / bh) ? 'h' : 'v';
    const T = this.theme;
    const fog = { color: T.fog, near: 200, far: 900 };
    const explain = this.opts.colorMode === 'explain';
    const mk = (built: Built, offset: THREE.Vector3, key: string, withStatic: boolean, extra: THREE.Plane[] = []): WorldSlot => {
      const root = new THREE.Group();
      root.position.copy(offset);
      const slab = this.slabPlanes(built.vis.bounds, offset);
      const clip = [...extra, ...slab];
      let stat: StaticScene | null = null;
      if (withStatic) {
        stat = buildStatic(built.vis, `${key}-${T.name}`, { quality: this.opts.quality ?? 'high', fog, clip: slab, theme: T });
        root.add(stat.group);
      }
      const lo = { clip, theme: T, colorBy: explain ? (built.colorBy ?? null) : null };
      const vehicles = new VehicleLayer(lo);
      const peds = new PedLayer(lo);
      const fx = new FxLayer(lo);
      root.add(vehicles.group, peds.group, fx.group);
      let anno: AnnotationLayer | null = null;
      if (this.opts.overlay && built.annotate) {
        anno = new AnnotationLayer(this.opts.overlay, offset, T, clip);
        root.add(anno.group);
      }
      this.scene.add(root);
      return { built, world: built.world, root, stat, vehicles, peds, fx, anno, offset, clip };
    };
    const cx = (vis.bounds.minX + vis.bounds.maxX) / 2;
    const cy = (vis.bounds.minY + vis.bounds.maxY) / 2;
    if (mode === 'wipe') {
      const off = new THREE.Vector3(-cx, 0, -cy);
      this.slots = [mk(a, off, `${this.def?.id}-wipe`, true, [this.wipePlanes[0]]), mk(b, off, `${this.def?.id}-wipe`, false, [this.wipePlanes[1]])];
      const dg = new THREE.BoxGeometry(1, 1, 1);
      this.divider = new THREE.Mesh(
        dg,
        new THREE.MeshBasicMaterial({
          color: T.name === 'day' ? '#1b2333' : '#dfe6ff',
          transparent: true,
          opacity: 0.55,
          toneMapped: false,
          depthWrite: false,
        }),
      );
      this.divider.scale.set(0.35, 0.15, bh);
      this.scene.add(this.divider);
    } else {
      const span = this.split === 'h' ? bw + GAP : bh + GAP;
      const oa = this.split === 'h' ? new THREE.Vector3(-cx - span / 2, 0, -cy) : new THREE.Vector3(-cx, 0, -cy - span / 2);
      const ob = this.split === 'h' ? new THREE.Vector3(-cx + span / 2, 0, -cy) : new THREE.Vector3(-cx, 0, -cy + span / 2);
      this.slots = [mk(a, oa, `${this.def?.id}-a`, true), mk(b, ob, `${this.def?.id}-b`, true)];
    }
    this.buildLabels(vis);
    this.applyVisibility();
    this.reframe(keepView ? 0 : -1);
    this.emitMetrics();
  }

  private buildLabels(vis: VisualSpec) {
    const ov = this.opts.overlay;
    if (!ov) return;
    for (const l of this.labelEls) l.el.remove();
    this.labelEls = [];
    const titles = this.opts.labels ?? { a: 'Status quo', b: 'Swalpa adjust' };
    const mode = this.mode();
    this.slots.forEach((s, i) => {
      const el = document.createElement('div');
      el.className = `world-tag ${i === 0 ? 'is-selfish' : 'is-civic'}`;
      el.innerHTML = `<span class="dot"></span>${i === 0 ? titles.a : titles.b}`;
      ov.appendChild(el);
      const v = s.built.vis.bounds;
      let pos: THREE.Vector3;
      if (mode === 'wipe') pos = new THREE.Vector3(i === 0 ? v.minX + 4 : v.maxX - 4, 0, v.minY + 2).add(s.offset);
      else if (this.opts.tagAlign === 'right') pos = new THREE.Vector3(v.maxX - 3, 0, v.minY + 1).add(s.offset);
      else pos = new THREE.Vector3(v.minX + 3, 0, v.minY + 1).add(s.offset);
      this.labelEls.push({ el, pos, slot: i });
      // place names for every world; only the visible world's are shown
      {
        for (const l of vis.labels) {
          const le = document.createElement('div');
          le.className = `place-tag kind-${l.kind}`;
          le.innerHTML = `<b>${l.text}</b>${l.sub ? `<span>${l.sub}</span>` : ''}`;
          ov.appendChild(le);
          this.labelEls.push({ el: le, pos: new THREE.Vector3(l.x, 0, l.y).add(s.offset), slot: i });
        }
      }
    });
    if (mode === 'wipe') this.labelEls.find((l) => l.slot === 1 && l.el.classList.contains('world-tag'))?.el.classList.add('align-right');
    else
      for (const l of this.labelEls)
        if (l.el.classList.contains('world-tag')) l.el.classList.add('inside', ...(this.opts.tagAlign === 'right' ? ['align-right'] : []));
  }

  private aspect() {
    const c = this.opts.canvas;
    return (c.clientWidth || 1) / (c.clientHeight || 1);
  }

  // ---------- camera ----------

  /** Camera framing (target + distance) that fits `box` at the given pitch. */
  private frame(box: THREE.Box3, pitch: number, yaw = 0): View {
    const target = new THREE.Vector3();
    box.getCenter(target);
    target.y = 0;
    const corners: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [0, 3]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
    let lo = 5;
    let hi = 6000;
    const tmp = new THREE.Vector3();
    const lift = this.focus?.lift ?? 0;
    const top = this.focus?.top ?? 0;
    const v: View = { target, dist: 100, pitch, yaw };
    for (let it = 0; it < 30; it++) {
      v.dist = (lo + hi) / 2;
      this.placeCamera(v, 0);
      this.camera.updateMatrixWorld();
      let ok = true;
      for (const p of corners) {
        tmp.copy(p).project(this.camera);
        if (Math.abs(tmp.x) > 0.96 || tmp.y > 0.9 - 2 * top || tmp.y < -0.9 + 2 * lift || tmp.z > 1) {
          ok = false;
          break;
        }
      }
      if (ok) hi = v.dist;
      else lo = v.dist;
    }
    v.dist = hi * (this.def?.camera?.zoom ? 1 / this.def.camera.zoom : 1);
    return v;
  }

  /** Box covering what should be on screen for the current focus. */
  private focusBox(): THREE.Box3 {
    const box = new THREE.Box3();
    const f = this.focus;
    this.slots.forEach((s, i) => {
      if (f && f.world === 'a' && i !== 0) return;
      if (f && f.world === 'b' && i !== 1) return;
      if (this.mode() === 'wipe' && i === 1 && (!f || f.world === 'both')) return; // same footprint
      const r = f?.region ?? s.built.vis.bounds;
      box.expandByPoint(new THREE.Vector3(r.minX, -1, r.minY).add(s.offset));
      box.expandByPoint(new THREE.Vector3(r.maxX, 3, r.maxY).add(s.offset));
    });
    return box;
  }

  /**
   * Recompute the framing. duration < 0 jumps, 0 jumps but keeps fog etc., >0 animates.
   */
  private reframe(duration: number) {
    if (!this.slots.length) return;
    const pitch = this.focus?.pitch ?? this.pitch;
    const to = this.frame(this.focusBox(), pitch, this.focus?.yaw ?? 0);
    if (duration > 0) {
      this.viewFrom = { target: this.view.target.clone(), dist: this.view.dist, pitch: this.view.pitch, yaw: this.view.yaw };
      this.viewTo = to;
      this.tween = 0;
      this.tweenDur = duration;
    } else {
      this.view = to;
      this.viewFrom = null;
      this.viewTo = null;
      this.tween = 1;
    }
    this.updateFogAndShadow(to);
  }

  private updateFogAndShadow(v: View) {
    const fog = this.scene.fog as THREE.Fog;
    const far = Math.max(v.dist, 60);
    fog.near = far * (this.theme.name === 'day' ? 1.6 : 0.95);
    fog.far = far * (this.theme.name === 'day' ? 4 : 2.6);
    for (const s of this.slots) {
      s.root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        if (m && m.uniforms?.uFogNear) {
          m.uniforms.uFogNear.value = fog.near;
          m.uniforms.uFogFar.value = fog.far;
        }
      });
    }
    // sun & shadow frustum follow whatever is framed
    const d = this.theme.key.dir;
    const box = this.focusBox();
    const size = new THREE.Vector3();
    box.getSize(size);
    const c = new THREE.Vector3();
    box.getCenter(c);
    this.key.target.position.copy(c);
    this.key.position.set(c.x + d[0] * 200, d[1] * 200, c.z + d[2] * 200);
    const half = Math.max(size.x, size.z) * 0.62 + 20;
    const sc = this.key.shadow.camera;
    sc.left = -half;
    sc.right = half;
    sc.top = half;
    sc.bottom = -half;
    sc.near = 10;
    sc.far = 600;
    sc.updateProjectionMatrix();
  }

  /** Point the camera at a world (or both) and a region of it. */
  setFocus(f: Focus | null, duration = 1.3) {
    this.focus = f;
    this.trackSnap = duration <= 0;
    this.applyLift();
    this.applyVisibility();
    this.reframe(duration);
  }

  /** Which explanatory call-outs to draw (scenario-defined), or null for none. */
  setAnnotations(mode: string | null) {
    this.annoMode = mode;
    this.trackWant.set(0, 0, 0);
    if (!mode) for (const s of this.slots) s.anno?.clear();
  }

  /** Shift the projection so framed content sits between the top controls and the caption area. */
  private applyLift() {
    const c = this.opts.canvas;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    const shift = (this.focus?.lift ?? 0) - (this.focus?.top ?? 0);
    if (shift !== 0) this.camera.setViewOffset(w, h, 0, (shift * h) / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  private applyVisibility() {
    const f = this.focus;
    this.slots.forEach((s, i) => {
      const vis = !f || f.world === 'both' || (f.world === 'a' ? i === 0 : i === 1) || this.mode() === 'wipe';
      s.root.visible = vis;
    });
    for (const l of this.labelEls) {
      const isWorldTag = l.el.classList.contains('world-tag');
      const show = !f || f.world === 'both' ? isWorldTag || l.slot === 0 || this.mode() === 'wipe' : f.world === 'a' ? l.slot === 0 : l.slot === 1;
      l.el.style.display = show && !(isWorldTag && f && f.world !== 'both') ? '' : 'none';
    }
  }

  private placeCamera(v: View, yawOffset: number, pitchOffset = 0) {
    const t = v.target;
    const p = v.pitch + pitchOffset;
    const yaw = v.yaw + yawOffset;
    this.camera.position.set(t.x + Math.sin(yaw) * Math.cos(p) * v.dist, t.y + Math.sin(p) * v.dist, t.z + Math.cos(yaw) * Math.cos(p) * v.dist);
    this.camera.lookAt(t);
  }

  resize() {
    const c = this.opts.canvas;
    const w = c.clientWidth || 1;
    const h = c.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloom?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyLift();
    if (this.slots.length) {
      const vb = this.slots[0].built.vis.bounds;
      const want = w / h > 2.6 * ((vb.maxX - vb.minX) / (vb.maxY - vb.minY)) ? 'h' : 'v';
      if (this.mode() === 'split' && want !== this.split && this.slots.length === 2) {
        const [a, b] = this.slots.map((s) => s.built);
        this.clearSlots();
        this.mount(a, b);
      } else this.reframe(-1);
    }
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (on) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame_);
    } else cancelAnimationFrame(this.raf);
  }

  setPlaying(p: boolean) {
    this.playing = p;
  }
  setSpeed(s: number) {
    this.speed = s;
  }
  setCivicShare(share: number) {
    if (this.slots[1]) this.slots[1].world.setCivicShare(share);
  }
  setWipe(x: number) {
    this.wipe = Math.max(0, Math.min(1, x));
  }
  get worlds(): World[] {
    return this.slots.map((s) => s.world);
  }

  /** Advance simulation & render one frame with a fixed real-time delta (film capture). */
  advance(dtReal: number) {
    this.step(dtReal);
    this.render();
  }

  private frame_ = (now: number) => {
    if (!this.active) return;
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.step(dt);
    this.render();
    this.raf = requestAnimationFrame(this.frame_);
  };

  private step(dt: number) {
    this.clock += dt;
    if (this.tween < 1) this.tween = Math.min(1, this.tween + dt / this.tweenDur);
    if (!this.slots.length) return;
    if (this.playing) {
      this.acc += dt * this.speed;
      const wdt = this.slots[0].world.dt;
      let n = 0;
      while (this.acc >= wdt && n < 14) {
        for (const s of this.slots) s.world.step();
        this.acc -= wdt;
        n++;
      }
      if (n >= 14) this.acc = 0;
    }
    this.metricsTimer += dt;
    if (this.metricsTimer > 0.25) {
      this.metricsTimer = 0;
      this.emitMetrics();
    }
  }

  private emitMetrics() {
    if (!this.opts.onMetrics || this.slots.length < 2) return;
    this.opts.onMetrics(this.slots[0].built.sample(), this.slots[1].built.sample(), this.slots[0].world.t);
  }

  render() {
    if (!this.slots.length) return;
    const t = this.clock;
    // camera: tween between framings, gentle drift + pointer parallax (+ film overrides)
    if (this.viewFrom && this.viewTo) {
      const k = easeInOut(this.tween);
      this.view = {
        target: this.viewFrom.target.clone().lerp(this.viewTo.target, k),
        // interpolate distance in log space so zooms feel even
        dist: Math.exp(Math.log(this.viewFrom.dist) + (Math.log(this.viewTo.dist) - Math.log(this.viewFrom.dist)) * k),
        pitch: this.viewFrom.pitch + (this.viewTo.pitch - this.viewFrom.pitch) * k,
        yaw: this.viewFrom.yaw + (this.viewTo.yaw - this.viewFrom.yaw) * k,
      };
      if (this.tween >= 1) {
        this.view = this.viewTo;
        this.viewFrom = null;
        this.viewTo = null;
      }
    }
    this.updateTrack();
    const p = this.pointer;
    p.x += (p.tx - p.x) * 0.04;
    p.y += (p.ty - p.y) * 0.04;
    const steady = this.opts.steadyCam || !!this.focus;
    const yaw = (steady ? 0 : Math.sin(t * 0.07) * 0.035 + p.x * 0.05) + this.cam.yaw + (this.focus ? p.x * 0.015 : 0);
    const v: View = {
      target: this.view.target
        .clone()
        .add(new THREE.Vector3(this.cam.fx, 0, this.cam.fz))
        .add(this.trackOff),
      dist: this.view.dist / this.cam.zoom,
      pitch: this.view.pitch,
      yaw: this.view.yaw,
    };
    this.placeCamera(v, yaw, (steady ? 0 : p.y * 0.03) + this.cam.pitch);

    // wipe planes
    if (this.mode() === 'wipe' && this.slots.length) {
      const b = this.slots[0].built.vis.bounds;
      const off = this.slots[0].offset;
      const x = b.minX + off.x + (b.maxX - b.minX) * this.wipe;
      this.wipePlanes[0].constant = x;
      this.wipePlanes[1].constant = -x;
      if (this.divider) {
        this.divider.position.set(x, 0.4, (b.minY + b.maxY) / 2 + off.z);
        this.divider.visible = this.wipe > 0.002 && this.wipe < 0.998;
      }
    }

    const c = this.opts.canvas;
    for (const s of this.slots) {
      s.stat?.update(t);
      s.vehicles.update(s.world, t);
      s.peds.update(s.world);
      s.fx.update(s.world, t);
      if (s.anno) {
        const annos = this.annoMode && s.root.visible && s.built.annotate ? s.built.annotate(this.annoMode) : [];
        s.anno.update(annos, this.camera, c.clientWidth, c.clientHeight, t, s.root.visible);
      }
    }
    // the composer only exists for the night-time bloom; its render targets have no MSAA,
    // so the day view renders straight to the (anti-aliased) canvas
    if (this.composer && this.theme.bloom) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }

  /** Ease the camera towards whatever the focused world asks to follow, kept inside its diorama. */
  private updateTrack() {
    const f = this.focus;
    const slot = f && f.world !== 'both' ? this.slots[f.world === 'a' ? 0 : 1] : null;
    const r = f?.region;
    const p = slot && r && this.annoMode ? slot.built.track?.(this.annoMode) : null;
    if (slot && r && p) {
      const b = slot.built.vis.bounds;
      const hx = (r.maxX - r.minX) / 2;
      const hy = (r.maxY - r.minY) / 2;
      const cx = Math.max(b.minX + hx, Math.min(b.maxX - hx, p.x));
      const cy = Math.max(b.minY + hy, Math.min(b.maxY - hy, p.y));
      this.trackWant.set(cx - (r.minX + r.maxX) / 2, 0, cy - (r.minY + r.maxY) / 2);
      if (this.trackSnap) this.trackOff.copy(this.trackWant);
    }
    this.trackSnap = false;
    const dt = Math.min(0.1, this.clock - this.trackClock);
    this.trackClock = this.clock;
    this.trackOff.lerp(this.trackWant, 1 - Math.exp(-dt * 1.4));
    // keep the sun's shadow box on what is being looked at
    if (this.trackOff.lengthSq() > 0.01 || this.trackWant.lengthSq() > 0.01) {
      const box = this.focusBox();
      const c = new THREE.Vector3();
      box.getCenter(c).add(this.trackOff);
      const d = this.theme.key.dir;
      this.key.target.position.copy(c);
      this.key.position.set(c.x + d[0] * 200, d[1] * 200, c.z + d[2] * 200);
    }
  }

  /** Screen-space x (0..1) of the wipe divider, for positioning the drag handle. */
  dividerScreenX(): number {
    if (!this.divider) return 0.5;
    const v = this.divider.position.clone();
    v.y = 0;
    v.project(this.camera);
    return (v.x + 1) / 2;
  }

  /** Convert a screen x (0..1) on the canvas to a wipe fraction. */
  wipeFromScreen(sx: number): number {
    if (!this.slots.length) return 0.5;
    const ndc = new THREE.Vector2(sx * 2 - 1, 0);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return this.wipe;
    const v = this.slots[0].built.vis.bounds;
    const off = this.slots[0].offset;
    return (hit.x - off.x - v.minX) / (v.maxX - v.minX);
  }

  private updateLabels() {
    if (!this.labelEls.length) return;
    const c = this.opts.canvas;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const v = new THREE.Vector3();
    for (const l of this.labelEls) {
      v.copy(l.pos).project(this.camera);
      const x = (v.x + 1) * 0.5 * w;
      const y = (1 - v.y) * 0.5 * h;
      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      l.el.style.opacity = v.z < 1 ? '' : '0';
    }
  }

  private clearSlots() {
    for (const s of this.slots) {
      this.scene.remove(s.root);
      s.stat?.dispose();
      s.vehicles.dispose();
      s.peds.dispose();
      s.fx.dispose();
      s.anno?.dispose();
    }
    this.slots = [];
    for (const l of this.labelEls) l.el.remove();
    this.labelEls = [];
    if (this.divider) {
      this.scene.remove(this.divider);
      this.divider.geometry.dispose();
      (this.divider.material as THREE.Material).dispose();
      this.divider = null;
    }
  }

  dispose() {
    this.setActive(false);
    this.loadToken++;
    this.clearSlots();
    this.opts.canvas.removeEventListener('pointermove', this.onPointer);
    this.composer?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
