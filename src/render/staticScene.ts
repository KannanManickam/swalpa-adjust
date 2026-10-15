// Builds the static diorama (ground slab, roads, markings, buildings, trees,
// street furniture) from a scenario's VisualSpec.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec2 } from '../sim/core/geom.ts';
import type { VisualSpec } from '../sim/visual.ts';
import { buildingMaterial, flatQuad, glowMaterial } from './materials.ts';
import type { Theme } from './theme.ts';
import { asphaltTexture, barricadeTexture, kerbTexture, lightPoolTexture, paintTexture, pavingTexture } from './textures.ts';

export interface StaticScene {
  group: THREE.Group;
  update: (t: number) => void;
  dispose: () => void;
}

const SLAB_MARGIN = 0.6;

/** Triangulated flat polygons merged into one geometry, lying in XZ at height h. */
function polysGeometry(polys: Vec2[][], h: number, uvScale = 0.12): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const poly of polys) {
    if (poly.length < 3) continue;
    const contour = poly.map((p) => new THREE.Vector2(p.x, p.y));
    const tris = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const t of tris) {
      // order so the face points up (+Y) after mapping y→z
      const a = contour[t[0]];
      const b = contour[t[1]];
      const c = contour[t[2]];
      const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
      const tri = cross > 0 ? [a, c, b] : [a, b, c];
      for (const p of tri) {
        pos.push(p.x, h, p.y);
        uv.push(p.x * uvScale, p.y * uvScale);
      }
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** Thin quads along polylines (lane lines, kerb paint, etc.). */
function stripGeometry(segs: { a: Vec2; b: Vec2; w: number }[], h: number): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const s of segs) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const L = Math.hypot(dx, dy) || 1;
    const nx = (-dy / L) * (s.w / 2);
    const ny = (dx / L) * (s.w / 2);
    const p1 = [s.a.x + nx, s.a.y + ny];
    const p2 = [s.b.x + nx, s.b.y + ny];
    const p3 = [s.b.x - nx, s.b.y - ny];
    const p4 = [s.a.x - nx, s.a.y - ny];
    const quad = [p1, p3, p2, p1, p4, p3];
    const uvs = [
      [0, 1],
      [L, 0],
      [L, 1],
      [0, 1],
      [0, 0],
      [L, 0],
    ];
    // ensure upward facing
    const cross = (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0]);
    const order = cross > 0 ? [0, 2, 1, 3, 5, 4] : [0, 1, 2, 3, 4, 5];
    for (const i of order) {
      pos.push(quad[i][0], h, quad[i][1]);
      uv.push(uvs[i][0], uvs[i][1]);
    }
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function dashed(a: Vec2, b: Vec2, on: number, off: number): [Vec2, Vec2][] {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / L;
  const uy = (b.y - a.y) / L;
  const out: [Vec2, Vec2][] = [];
  for (let s = 0; s < L; s += on + off) {
    const e = Math.min(L, s + on);
    out.push([
      { x: a.x + ux * s, y: a.y + uy * s },
      { x: a.x + ux * e, y: a.y + uy * e },
    ]);
  }
  return out;
}

/** Oriented box along a segment (kerbs, medians, barricades). */
function segBox(a: Vec2, b: Vec2, width: number, height: number, y0: number): THREE.BufferGeometry {
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  const g = new THREE.BoxGeometry(L, height, width);
  // repeat UV along length
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L);
  g.rotateY(-Math.atan2(b.y - a.y, b.x - a.x));
  g.translate((a.x + b.x) / 2, y0 + height / 2, (a.y + b.y) / 2);
  return g;
}

function clipSegToSquare(cx: number, cy: number, h: number, p: Vec2, d: Vec2): [Vec2, Vec2] | null {
  // parametric line p + t d clipped to the square [cx±h]×[cy±h]
  let t0 = -1e9;
  let t1 = 1e9;
  for (const [pc, dc, lo, hi] of [
    [p.x, d.x, cx - h, cx + h],
    [p.y, d.y, cy - h, cy + h],
  ]) {
    if (Math.abs(dc) < 1e-9) {
      if (pc < lo || pc > hi) return null;
    } else {
      let a = (lo - pc) / dc;
      let b = (hi - pc) / dc;
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
  }
  if (t1 <= t0) return null;
  return [
    { x: p.x + d.x * t0, y: p.y + d.y * t0 },
    { x: p.x + d.x * t1, y: p.y + d.y * t1 },
  ];
}

export function buildStatic(
  vis: VisualSpec,
  key: string,
  opts: { quality: 'high' | 'low'; fog: { color: THREE.Color; near: number; far: number }; clip?: THREE.Plane[]; theme: Theme },
): StaticScene {
  const T = opts.theme;
  const shadows = T.key.shadows;
  const group = new THREE.Group();
  const disposables: { dispose: () => void }[] = [];
  const add = (m: THREE.Object3D) => {
    group.add(m);
    return m;
  };
  const track = <T extends { dispose: () => void }>(x: T) => {
    disposables.push(x);
    return x;
  };
  const b = vis.bounds;
  const inside = (x: number, y: number, pad = 0) => x > b.minX + pad && x < b.maxX - pad && y > b.minY + pad && y < b.maxY - pad;
  vis = {
    ...vis,
    buildings: vis.buildings.filter((bd) => inside(bd.x, bd.y, Math.max(bd.w, bd.d) / 2 + 0.5)),
    trees: vis.trees.filter((t) => inside(t.x, t.y, t.r * 0.6)),
    lamps: vis.lamps.filter((l) => inside(l.x, l.y, 0.3)),
    signals: vis.signals.filter((s) => inside(s.x, s.y, 0)),
    arrows: vis.arrows.filter((a) => inside(a.x, a.y, 2)),
    texts: vis.texts.filter((a) => inside(a.x, a.y, 2)),
    cones: vis.cones.filter((c) => inside(c.x, c.y, 0)),
  };
  const W = b.maxX - b.minX + SLAB_MARGIN * 2;
  const H = b.maxY - b.minY + SLAB_MARGIN * 2;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  // --- slab (diorama base) ---
  const slabGeo = track(new THREE.BoxGeometry(W, 6, H));
  const slabMats = [
    track(new THREE.MeshStandardMaterial({ color: T.slabSide, roughness: 1 })),
    track(new THREE.MeshStandardMaterial({ color: T.slabSide, roughness: 1 })),
    track(new THREE.MeshStandardMaterial({ color: T.ground, roughness: 1 })),
    track(new THREE.MeshStandardMaterial({ color: T.slabSide, roughness: 1 })),
    track(new THREE.MeshStandardMaterial({ color: T.slabSide, roughness: 1 })),
    track(new THREE.MeshStandardMaterial({ color: T.slabSide, roughness: 1 })),
  ];
  const slab = new THREE.Mesh(slabGeo, slabMats);
  slab.receiveShadow = shadows;
  slab.position.set(cx, -3, cy);
  add(slab);
  const edges = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(slabGeo)),
    track(new THREE.LineBasicMaterial({ color: T.edges, transparent: true, opacity: 0.55 })),
  );
  edges.position.copy(slab.position);
  add(edges);
  // soft shadow under the slab
  const shadow = new THREE.Mesh(
    track(flatQuad()),
    track(new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: T.shadowOpacity, depthWrite: false })),
  );
  shadow.scale.set(W * 1.15, 1, H * 1.15);
  shadow.position.set(cx, -6.05, cy);
  add(shadow);

  // --- road surfaces ---
  const asphaltTex = asphaltTexture();
  const asphaltMat = track(new THREE.MeshStandardMaterial({ color: T.asphalt, map: asphaltTex, roughness: 0.92, metalness: 0.0 }));
  const asphaltGeo = polysGeometry([...vis.asphalt], 0.02, 0.14);
  if (asphaltGeo) add(new THREE.Mesh(track(asphaltGeo), asphaltMat)).receiveShadow = shadows;
  const boxGeo = polysGeometry(vis.boxes, 0.025, 0.14);
  if (boxGeo)
    add(new THREE.Mesh(track(boxGeo), track(new THREE.MeshStandardMaterial({ color: T.junction, map: asphaltTex, roughness: 0.92 })))).receiveShadow = shadows;
  const pav = pavingTexture();
  const fpGeo = polysGeometry(vis.footpaths, 0.16, 0.5);
  if (fpGeo) add(new THREE.Mesh(track(fpGeo), track(new THREE.MeshStandardMaterial({ color: T.paving, map: pav, roughness: 1 })))).receiveShadow = shadows;

  // --- kerbs (black/yellow) ---
  const kerbTex = kerbTexture();
  const kerbGeos: THREE.BufferGeometry[] = [];
  for (const k of vis.kerbs) for (let i = 0; i < k.length - 1; i++) kerbGeos.push(segBox(k[i], k[i + 1], 0.28, 0.2, 0));
  if (kerbGeos.length) {
    const m = mergeGeometries(kerbGeos);
    kerbGeos.forEach((g) => g.dispose());
    const t = kerbTex.clone();
    t.repeat.set(1, 1);
    t.needsUpdate = true;
    add(new THREE.Mesh(track(m), track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }))));
  }
  // --- medians ---
  const medGeos: THREE.BufferGeometry[] = [];
  const medKerbs: THREE.BufferGeometry[] = [];
  for (const md of vis.medians) {
    for (let i = 0; i < md.pts.length - 1; i++) {
      const a = md.pts[i];
      const c = md.pts[i + 1];
      medGeos.push(segBox(a, c, md.width - 0.1, 0.32, 0));
      const dx = c.x - a.x;
      const dy = c.y - a.y;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * (md.width / 2);
      const ny = (dx / L) * (md.width / 2);
      medKerbs.push(segBox({ x: a.x + nx, y: a.y + ny }, { x: c.x + nx, y: c.y + ny }, 0.12, 0.34, 0));
      medKerbs.push(segBox({ x: a.x - nx, y: a.y - ny }, { x: c.x - nx, y: c.y - ny }, 0.12, 0.34, 0));
    }
  }
  if (medGeos.length) {
    add(new THREE.Mesh(track(mergeGeometries(medGeos)), track(new THREE.MeshStandardMaterial({ color: T.median, roughness: 1 }))));
    add(new THREE.Mesh(track(mergeGeometries(medKerbs)), track(new THREE.MeshStandardMaterial({ map: kerbTex, roughness: 0.8 }))));
  }

  // --- markings ---
  const whiteSegs: { a: Vec2; b: Vec2; w: number }[] = [];
  const yellowSegs: { a: Vec2; b: Vec2; w: number }[] = [];
  const zebraSegs: { a: Vec2; b: Vec2; w: number }[] = [];
  for (const l of vis.lines) {
    const target = l.color === 'yellow' ? yellowSegs : whiteSegs;
    for (let i = 0; i < l.pts.length - 1; i++) {
      if (l.dash) for (const [a, c] of dashed(l.pts[i], l.pts[i + 1], l.dash[0], l.dash[1])) target.push({ a, b: c, w: l.width });
      else target.push({ a: l.pts[i], b: l.pts[i + 1], w: l.width });
    }
  }
  for (const s of vis.stopLines) whiteSegs.push({ a: s.a, b: s.b, w: 0.45 });
  for (const z of vis.zebras) {
    const L = Math.hypot(z.b.x - z.a.x, z.b.y - z.a.y);
    const ux = (z.b.x - z.a.x) / L;
    const uy = (z.b.y - z.a.y) / L;
    for (let s = 0.6; s < L - 0.3; s += 1.0) {
      const p = { x: z.a.x + ux * s, y: z.a.y + uy * s };
      // stripes run perpendicular to a→b (i.e. along the traffic)
      zebraSegs.push({
        a: { x: p.x - uy * (z.depth / 2), y: p.y + ux * (z.depth / 2) },
        b: { x: p.x + uy * (z.depth / 2), y: p.y - ux * (z.depth / 2) },
        w: 0.6,
      });
    }
  }
  for (const box of vis.hatch) {
    const xs = box.map((p) => p.x);
    const ys = box.map((p) => p.y);
    const hx = (Math.max(...xs) - Math.min(...xs)) / 2;
    const bx = (Math.max(...xs) + Math.min(...xs)) / 2;
    const by = (Math.max(...ys) + Math.min(...ys)) / 2;
    const hh = hx - 0.6;
    for (let c = -2 * hh; c <= 2 * hh; c += 2.6) {
      for (const d of [
        { x: 1, y: 1 },
        { x: 1, y: -1 },
      ]) {
        const seg = clipSegToSquare(bx, by, hh, { x: bx + c * 0.5, y: by - c * 0.5 * d.y }, d);
        if (seg) yellowSegs.push({ a: seg[0], b: seg[1], w: 0.24 });
      }
    }
    const sq = [
      { x: bx - hh, y: by - hh },
      { x: bx + hh, y: by - hh },
      { x: bx + hh, y: by + hh },
      { x: bx - hh, y: by + hh },
    ];
    for (let i = 0; i < 4; i++) yellowSegs.push({ a: sq[i], b: sq[(i + 1) % 4], w: 0.22 });
  }
  const wg = stripGeometry(whiteSegs, 0.045);
  if (wg) add(new THREE.Mesh(track(wg), track(new THREE.MeshBasicMaterial({ color: T.line, transparent: true, opacity: T.lineOpacity }))));
  const zg = stripGeometry(zebraSegs, 0.048);
  if (zg)
    add(
      new THREE.Mesh(
        track(zg),
        track(new THREE.MeshBasicMaterial({ color: T.name === 'day' ? '#ffffff' : '#b9bec7', transparent: true, opacity: T.name === 'day' ? 0.95 : 0.8 })),
      ),
    );
  const yg = stripGeometry(yellowSegs, 0.05);
  if (yg) add(new THREE.Mesh(track(yg), track(new THREE.MeshBasicMaterial({ color: T.yellow, transparent: true, opacity: T.name === 'day' ? 0.9 : 0.6 }))));

  // painted arrows & words
  const quad = track(flatQuad());
  for (const a of vis.arrows) {
    const m = new THREE.Mesh(
      quad,
      track(new THREE.MeshBasicMaterial({ map: paintTexture(a.kind, '#d8dbe0'), transparent: true, opacity: 0.75, depthWrite: false })),
    );
    m.scale.set(5.5, 1, 2.75);
    m.rotation.y = -a.h;
    m.position.set(a.x, 0.05, a.y);
    add(m);
  }
  for (const t of vis.texts) {
    const m = new THREE.Mesh(
      quad,
      track(
        new THREE.MeshBasicMaterial({
          map: paintTexture(t.text, t.color === 'yellow' ? '#f2c230' : '#d8dbe0'),
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      ),
    );
    m.scale.set(7.5, 1, 2.6);
    m.rotation.y = -t.h;
    m.position.set(t.x, 0.05, t.y);
    add(m);
  }

  // --- buildings ---
  if (vis.buildings.length) {
    const bg = track(new THREE.BoxGeometry(1, 1, 1));
    bg.translate(0, 0.5, 0);
    const bm = track(buildingMaterial(opts.fog, opts.clip, T.name === 'day'));
    const inst = new THREE.InstancedMesh(bg, bm, vis.buildings.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const facades = T.facades;
    vis.buildings.forEach((bd, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -bd.rot);
      m4.compose(new THREE.Vector3(bd.x, 0, bd.y), q, new THREE.Vector3(bd.w, bd.h, bd.d));
      inst.setMatrixAt(i, m4);
      col.set(facades[Math.floor(bd.hue * facades.length) % facades.length]);
      inst.setColorAt(i, col);
    });
    inst.castShadow = shadows;
    add(inst);
  }

  // --- trees ---
  if (vis.trees.length) {
    const tg = track(new THREE.IcosahedronGeometry(1, 1));
    const tm = track(new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }));
    const inst = new THREE.InstancedMesh(tg, tm, vis.trees.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const kinds: Record<string, string[]> = T.trees;
    vis.trees.forEach((t, i) => {
      const r = t.r * (T.name === 'day' ? 0.58 : 0.72);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (i * 1.7) % 6.28);
      m4.compose(new THREE.Vector3(t.x, r * 0.9 + 1.6, t.y), q, new THREE.Vector3(r, r * 0.72, r));
      inst.setMatrixAt(i, m4);
      const pal = kinds[t.kind];
      col.set(pal[i % pal.length]);
      inst.setColorAt(i, col);
    });
    inst.castShadow = shadows;
    add(inst);
  }

  // --- street lamps (poles + heads) ---
  const glow = glowMaterial();
  if (vis.lamps.length) {
    const pole = track(new THREE.CylinderGeometry(0.08, 0.12, 7.5, 6));
    pole.translate(0, 3.75, 0);
    const pm = new THREE.InstancedMesh(pole, track(new THREE.MeshStandardMaterial({ color: '#3a3f48', roughness: 0.6, metalness: 0.4 })), vis.lamps.length);
    const heads = new THREE.InstancedMesh(quad, track(glow), vis.lamps.length);
    const m4 = new THREE.Matrix4();
    const c = new THREE.Color('#ffcf94').multiplyScalar(0.9);
    vis.lamps.forEach((l, i) => {
      m4.makeTranslation(l.x, 0, l.y);
      pm.setMatrixAt(i, m4);
      m4.makeScale(2.4, 1, 2.4).setPosition(l.x, 7.6, l.y);
      heads.setMatrixAt(i, m4);
      heads.setColorAt(i, c);
    });
    if (T.nightLights) {
      add(pm);
      add(heads);
    }
  }

  // --- light pools (baked additive overlay) ---
  if (T.nightLights) {
    const extra: { x: number; y: number; r: number; a: number; c: string }[] = [];
    for (const s of vis.busStops) extra.push({ x: s.x, y: s.y + 1, r: 9, a: 0.4, c: 'rgba(160,220,255,A)' });
    for (const s of vis.signals) extra.push({ x: s.x, y: s.y, r: 6, a: 0.12, c: 'rgba(255,220,180,A)' });
    const pb = { minX: b.minX - SLAB_MARGIN, minY: b.minY - SLAB_MARGIN, maxX: b.maxX + SLAB_MARGIN, maxY: b.maxY + SLAB_MARGIN };
    const tex = lightPoolTexture(key, pb, vis.lamps, extra);
    const pm = new THREE.Mesh(
      quad,
      track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    );
    pm.scale.set(pb.maxX - pb.minX, 1, pb.maxY - pb.minY);
    pm.position.set((pb.minX + pb.maxX) / 2, 0.21, (pb.minY + pb.maxY) / 2);
    pm.renderOrder = 2;
    add(pm);
  }

  // --- barricades (metro works) with blinking lamps ---
  const blinkers: THREE.InstancedMesh[] = [];
  if (vis.barricades.length) {
    const panels: THREE.BufferGeometry[] = [];
    const lampPos: Vec2[] = [];
    for (const br of vis.barricades) {
      const L = Math.hypot(br.b.x - br.a.x, br.b.y - br.a.y);
      const n = Math.max(1, Math.round(L / 2.1));
      for (let i = 0; i < n; i++) {
        const t0 = i / n;
        const t1 = (i + 0.92) / n;
        const a = { x: br.a.x + (br.b.x - br.a.x) * t0, y: br.a.y + (br.b.y - br.a.y) * t0 };
        const c = { x: br.a.x + (br.b.x - br.a.x) * t1, y: br.a.y + (br.b.y - br.a.y) * t1 };
        panels.push(segBox(a, c, 0.2, 1.5, 0.05));
        if (i % 2 === 0) lampPos.push(a);
      }
    }
    const t = barricadeTexture().clone();
    t.repeat.set(0.5, 1);
    t.needsUpdate = true;
    add(
      new THREE.Mesh(
        track(mergeGeometries(panels)),
        track(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.45 })),
      ),
    );
    panels.forEach((g) => g.dispose());
    const bl = new THREE.InstancedMesh(quad, track(glowMaterial()), lampPos.length);
    const m4 = new THREE.Matrix4();
    lampPos.forEach((p, i) => {
      m4.makeScale(2.2, 1, 2.2).setPosition(p.x, 1.7, p.y);
      bl.setMatrixAt(i, m4);
      bl.setColorAt(i, new THREE.Color('#ff2a2a'));
    });
    bl.userData.phase = lampPos.map((_, i) => i * 0.37);
    if (T.nightLights) {
      blinkers.push(bl);
      add(bl);
    }
  }
  if (vis.cones.length) {
    const cg = track(new THREE.ConeGeometry(0.28, 0.8, 10));
    cg.translate(0, 0.4, 0);
    const cm = new THREE.InstancedMesh(
      cg,
      track(new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.6, emissive: '#ff4400', emissiveIntensity: 0.25 })),
      vis.cones.length,
    );
    const m4 = new THREE.Matrix4();
    vis.cones.forEach((c, i) => {
      m4.makeTranslation(c.x, 0, c.y);
      cm.setMatrixAt(i, m4);
    });
    add(cm);
  }

  // --- metro (pillars, optional deck) ---
  if (vis.metro) {
    const mt = vis.metro;
    const pts = mt.pts;
    const L = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
    const n = Math.floor(L / mt.pillarEvery) + 1;
    const pg = track(new THREE.CylinderGeometry(1.0, 1.0, 1, 16));
    pg.translate(0, 0.5, 0);
    const pmesh = new THREE.InstancedMesh(pg, track(new THREE.MeshStandardMaterial({ color: '#8b8e94', roughness: 0.95 })), n);
    const capG = track(new THREE.BoxGeometry(2.6, 1.2, 4.6));
    const caps = new THREE.InstancedMesh(capG, track(new THREE.MeshStandardMaterial({ color: '#9a9da3', roughness: 0.95 })), n);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const t = (i * mt.pillarEvery) / L;
      const x = pts[0].x + (pts[1].x - pts[0].x) * t;
      const y = pts[0].y + (pts[1].y - pts[0].y) * t;
      const h = mt.height > 0 ? mt.height : 5 + ((i * 3.7) % 4);
      m4.makeScale(1, h, 1).setPosition(x, 0, y);
      pmesh.setMatrixAt(i, m4);
      m4.makeTranslation(x, h + 0.6, y);
      caps.setMatrixAt(i, m4);
    }
    add(pmesh);
    if (mt.height > 0) {
      add(caps);
      const deck = new THREE.Mesh(
        track(segBox(pts[0], pts[1], 9, 1.6, mt.height + 1.2)),
        track(new THREE.MeshStandardMaterial({ color: '#a3a6ad', roughness: 0.9 })),
      );
      add(deck);
    } else {
      // construction: rebar cages glow faintly orange from work lights
      caps.count = 0;
    }
  }

  // --- bus shelters ---
  for (const s of vis.busStops) {
    const g = new THREE.Group();
    const roof = new THREE.Mesh(
      track(new THREE.BoxGeometry(s.len, 0.15, 2.2)),
      track(new THREE.MeshStandardMaterial({ color: '#c7cbd3', roughness: 0.5, metalness: 0.3 })),
    );
    roof.position.set(0, 2.7, 0);
    const back = new THREE.Mesh(
      track(new THREE.BoxGeometry(s.len, 2.5, 0.1)),
      track(new THREE.MeshStandardMaterial({ color: '#1b2a3c', emissive: '#4cc3ff', emissiveIntensity: 0.35, roughness: 0.3 })),
    );
    back.position.set(0, 1.3, -1.0);
    g.add(roof, back);
    g.rotation.y = -s.h;
    g.position.set(s.x, 0.16, s.y);
    add(g);
  }

  // --- traffic signals ---
  const signalHeads: { mats: THREE.MeshBasicMaterial[]; glow: THREE.Mesh; post: VisualSpec['signals'][number] }[] = [];
  if (vis.signals.length) {
    const poleG = track(new THREE.CylinderGeometry(0.1, 0.12, 4.2, 6));
    poleG.translate(0, 2.1, 0);
    const poleM = track(new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.5, metalness: 0.5 }));
    const headG = track(new THREE.BoxGeometry(0.42, 1.25, 0.42));
    const headM = track(new THREE.MeshStandardMaterial({ color: '#111317', roughness: 0.6 }));
    const lampG = track(new THREE.SphereGeometry(0.15, 10, 8));
    for (const s of vis.signals) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(poleG, poleM));
      const head = new THREE.Mesh(headG, headM);
      head.position.set(0, 4.6, 0);
      g.add(head);
      const mats = ['#ff2a3d', '#ffb02e', '#2bff88'].map((c) => track(new THREE.MeshBasicMaterial({ color: c, toneMapped: false })));
      mats.forEach((m, i) => {
        const l = new THREE.Mesh(lampG, m);
        l.position.set(0, 5.0 - i * 0.4, 0.22);
        g.add(l);
      });
      const gl = new THREE.Mesh(quad, track(glowMaterial()));
      gl.scale.set(3.2, 1, 3.2);
      gl.position.set(0, 5.4, 0);
      if (T.nightLights) g.add(gl);
      // face oncoming traffic
      g.rotation.y = -s.h - Math.PI / 2;
      g.position.set(s.x, 0.16, s.y);
      add(g);
      signalHeads.push({ mats, glow: gl, post: s });
    }
  }

  const tmpC = new THREE.Color();
  const update = (t: number) => {
    for (const sh of signalHeads) {
      const st = sh.post.signal.state(sh.post.group);
      const on = st === 'R' ? 0 : st === 'Y' ? 1 : 2;
      sh.mats.forEach((m, i) => {
        const base = i === 0 ? '#ff2a3d' : i === 1 ? '#ffb02e' : '#2bff88';
        m.color.set(base).multiplyScalar(i === on ? (T.nightLights ? 2.2 : 1) : T.nightLights ? 0.08 : 0.22);
      });
      const gm = sh.glow.material as THREE.MeshBasicMaterial;
      gm.color.set(on === 0 ? '#ff2a3d' : on === 1 ? '#ffb02e' : '#2bff88').multiplyScalar(0.9);
      sh.glow.position.y = 5.0 - on * 0.4;
    }
    for (const bl of blinkers) {
      const ph = bl.userData.phase as number[];
      for (let i = 0; i < ph.length; i++) {
        const k = Math.sin(t * 4 + ph[i]) > 0.2 ? 1 : 0.08;
        bl.setColorAt(i, tmpC.set('#ff2a2a').multiplyScalar(k));
      }
      if (bl.instanceColor) bl.instanceColor.needsUpdate = true;
    }
  };

  // everything outside the slab is cut away (roads run past the diorama's edges)
  if (opts.clip) {
    group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!m || o === slab || o === edges || o === shadow) return;
      for (const mm of Array.isArray(m) ? m : [m]) mm.clippingPlanes = opts.clip!;
    });
  }

  return {
    group,
    update,
    dispose: () => {
      for (const d of disposables) d.dispose();
      group.traverse((o) => {
        if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
      });
    },
  };
}
