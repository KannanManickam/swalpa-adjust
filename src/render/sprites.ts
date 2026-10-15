// Instanced flat quads with a per-instance RGBA tint. Used for lights, halos,
// rings and annotation strokes; works with additive (night) or normal (day) blending.
import * as THREE from 'three';
import { flatQuad } from './materials.ts';

export class SpriteBatch {
  readonly mesh: THREE.InstancedMesh;
  private colors: THREE.InstancedBufferAttribute;
  private n = 0;
  readonly cap: number;

  constructor(tex: THREE.Texture, cap: number, opts: { additive?: boolean; clip?: THREE.Plane[]; renderOrder?: number; depthTest?: boolean } = {}) {
    this.cap = cap;
    const geo = flatQuad();
    this.colors = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    this.colors.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTint', this.colors);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: tex } },
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      clipping: true,
      clippingPlanes: opts.clip ?? null,
      vertexShader: /* glsl */ `
        attribute vec4 aTint;
        varying vec2 vUv;
        varying vec4 vTint;
        #include <clipping_planes_pars_vertex>
        void main() {
          vUv = uv;
          vTint = aTint;
          vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <clipping_planes_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec2 vUv;
        varying vec4 vTint;
        #include <clipping_planes_pars_fragment>
        void main() {
          #include <clipping_planes_fragment>
          vec4 t = texture2D(uMap, vUv);
          gl_FragColor = vec4(t.rgb * vTint.rgb, t.a * vTint.a);
        }
      `,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = opts.renderOrder ?? 5;
  }

  begin() {
    this.n = 0;
  }

  /** Quad centred at (x, y, z), rotated by yaw h (sim heading), sized sx (along h) × sz. */
  push(x: number, y: number, z: number, h: number, sx: number, sz: number, r: number, g: number, b: number, a = 1) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    const o = i * 16;
    const c = Math.cos(h);
    const s = -Math.sin(h);
    arr[o] = c * sx;
    arr[o + 1] = 0;
    arr[o + 2] = -s * sx;
    arr[o + 3] = 0;
    arr[o + 4] = 0;
    arr[o + 5] = 1;
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
    const ca = this.colors.array as Float32Array;
    ca[i * 4] = r;
    ca[i * 4 + 1] = g;
    ca[i * 4 + 2] = b;
    ca[i * 4 + 3] = a;
  }

  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
