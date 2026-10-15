// Draws explanatory call-outs: HTML labels that follow simulated vehicles,
// pulsing halo rings on the road, measuring brackets and numbered badges.
import * as THREE from 'three';
import type { Annotation, Tone } from '../sim/scenarios/types.ts';
import { SpriteBatch } from './sprites.ts';
import { haloTexture, solidTexture } from './textures.ts';
import type { Theme } from './theme.ts';

const TONE_RGB: Record<Tone, [number, number, number]> = {
  bad: [0.93, 0.22, 0.27],
  warn: [0.98, 0.58, 0.1],
  good: [0.1, 0.72, 0.45],
  info: [0.3, 0.42, 0.62],
};

type Labeled = Exclude<Annotation, { kind: 'chain' }>;

interface Live {
  el: HTMLElement;
  a: Labeled;
  seen: number;
  born: number;
  /** label width in px (measured once, re-measured when the text changes) */
  width: number;
}

const HOLD = 1.1; // seconds a call-out lingers after its cause disappears

export class AnnotationLayer {
  group = new THREE.Group();
  private halos: SpriteBatch;
  private strokes: SpriteBatch;
  private live = new Map<string, Live>();
  private host: HTMLElement;
  private tmp = new THREE.Vector3();
  private offset: THREE.Vector3;
  private chainSegs: number[][] = [];

  constructor(overlay: HTMLElement, offset: THREE.Vector3, theme: Theme, clip?: THREE.Plane[]) {
    this.offset = offset;
    this.host = document.createElement('div');
    this.host.className = `anno-host theme-${theme.name}`;
    overlay.appendChild(this.host);
    this.halos = new SpriteBatch(haloTexture(), 64, { additive: false, clip, renderOrder: 8 });
    this.strokes = new SpriteBatch(solidTexture(), 160, { additive: false, clip, renderOrder: 9, depthTest: false });
    this.group.add(this.halos.mesh, this.strokes.mesh);
  }

  update(annos: Annotation[], camera: THREE.Camera, w: number, h: number, t: number, visible: boolean) {
    this.host.style.display = visible ? '' : 'none';
    this.group.visible = visible;
    for (const a of annos) {
      if (a.kind === 'chain') {
        // the zipper itself: a line through vehicles in the order they pass the merge
        const [r, g, bb] = TONE_RGB[a.tone];
        for (let i = 0; i < a.pts.length - 1; i++) {
          const p = a.pts[i];
          const q = a.pts[i + 1];
          const dx = q.x - p.x;
          const dy = q.y - p.y;
          const L = Math.hypot(dx, dy);
          if (L < 0.5) continue;
          this.chainSegs.push([p.x + dx / 2, p.y + dy / 2, Math.atan2(dy, dx), L, r, g, bb]);
        }
        continue;
      }
      let l = this.live.get(a.id);
      if (!l) {
        l = { el: this.makeEl(a), a, seen: t, born: t, width: 0 };
        this.live.set(a.id, l);
        this.host.appendChild(l.el);
        requestAnimationFrame(() => l!.el.classList.add('in'));
      }
      if (l.a.text !== a.text && a.kind !== 'badge') {
        this.setText(l.el, a);
        l.width = 0;
      }
      if (a.kind !== 'badge' && l.a.kind !== 'badge' && l.a.tone !== a.tone) {
        l.el.classList.remove(`tone-${l.a.tone}`);
        l.el.classList.add(`tone-${a.tone}`);
      }
      if (a.kind === 'badge' && l.a.text !== a.text) l.el.textContent = a.text;
      l.a = a;
      l.seen = t;
    }
    this.halos.begin();
    this.strokes.begin();
    for (const [x, y, h, L, r, g, b] of this.chainSegs) {
      this.strokes.push(x, 2.0, y, h, L, 0.55, 1, 1, 1, 0.95);
      this.strokes.push(x, 2.02, y, h, L, 0.28, r, g, b, 1);
    }
    this.chainSegs.length = 0;
    for (const [id, l] of this.live) {
      const age = t - l.seen;
      if (age > (l.a.kind === 'badge' ? 0.01 : HOLD)) {
        l.el.remove();
        this.live.delete(id);
        continue;
      }
      const fading = age > 0.05;
      l.el.classList.toggle('out', fading && age > HOLD * 0.5);
      const a = l.a;
      const ox = this.offset.x;
      const oz = this.offset.z;
      if (a.kind === 'tag') {
        const lift = a.h ?? 2.6;
        this.keepOnScreen(l, this.place(l.el, a.x + ox, lift, a.y + oz, camera, w, h), w);
        if (a.ring && !fading) {
          const [r, g, b] = TONE_RGB[a.tone];
          const s = a.ring * 2 * (1 + 0.12 * Math.sin((t - l.born) * 6));
          this.halos.push(a.x, 0.35, a.y, 0, s, s, r, g, b, 0.9);
        }
      } else if (a.kind === 'badge') {
        this.place(l.el, a.x + ox, 3.2, a.y + oz, camera, w, h);
      } else {
        const [r, g, b] = TONE_RGB[a.tone];
        const len = Math.abs(a.x1 - a.x0);
        const mx = (a.x0 + a.x1) / 2;
        if (len > 0.5) {
          this.strokes.push(mx, 0.6, a.y, 0, len, 0.7, r, g, b, 0.95);
          this.strokes.push(a.x0, 0.6, a.y, 0, 0.6, 3.2, r, g, b, 0.95);
          this.strokes.push(a.x1, 0.6, a.y, 0, 0.6, 3.2, r, g, b, 0.95);
        }
        this.keepOnScreen(l, this.place(l.el, mx + ox, 0.4, a.y + oz, camera, w, h), w);
        l.el.style.opacity = len > 0.5 ? '' : '0';
      }
    }
    this.halos.end();
    this.strokes.end();
  }

  /** Slide a label sideways so it stays on screen; its stem (if any) stays on the anchor. */
  private keepOnScreen(l: Live, sx: number, w: number) {
    const span = l.el.firstElementChild as HTMLElement | null;
    if (!span) return;
    if (!l.width) l.width = span.offsetWidth;
    const half = l.width / 2;
    const dx = Math.min(0, w - 8 - (sx + half)) + Math.max(0, 8 - (sx - half));
    span.style.transform = dx ? `translateX(${dx.toFixed(1)}px)` : '';
  }

  /** Pin an element to a world point; returns its screen x. */
  private place(el: HTMLElement, x: number, y: number, z: number, camera: THREE.Camera, w: number, h: number): number {
    const v = this.tmp.set(x, y, z).project(camera);
    const sx = (v.x + 1) * 0.5 * w;
    el.style.transform = `translate3d(${sx.toFixed(1)}px, ${((1 - v.y) * 0.5 * h).toFixed(1)}px, 0)`;
    return sx;
  }

  private makeEl(a: Labeled): HTMLElement {
    const el = document.createElement('div');
    if (a.kind === 'badge') {
      el.className = 'anno-badge';
      el.style.setProperty('--c', a.color);
      el.textContent = a.text;
    } else {
      el.className = `anno-${a.kind} tone-${a.tone}${a.kind === 'tag' && a.side === 'down' ? ' side-down' : ''}`;
      this.setText(el, a);
    }
    return el;
  }

  private setText(el: HTMLElement, a: Labeled) {
    if (a.kind === 'badge') return;
    el.innerHTML = `<span>${a.text}</span>`;
  }

  clear() {
    for (const l of this.live.values()) l.el.remove();
    this.live.clear();
  }

  dispose() {
    this.clear();
    this.host.remove();
    this.halos.dispose();
    this.strokes.dispose();
  }
}
