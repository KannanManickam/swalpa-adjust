import * as THREE from 'three';
import { glowTexture, beamTexture, ringTexture } from './textures.ts';

export const PALETTE = {
  bg: new THREE.Color('#06080f'),
  fog: new THREE.Color('#0a0e19'),
  ground: new THREE.Color('#1a2131'),
  slabSide: new THREE.Color('#0d1018'),
  asphalt: new THREE.Color('#353b49'),
  junction: new THREE.Color('#383e4c'),
  paving: new THREE.Color('#4a5160'),
  median: new THREE.Color('#1d3326'),
  line: new THREE.Color('#cfd3da'),
  yellow: new THREE.Color('#f2c230'),
  head: new THREE.Color('#fff1d6'),
  tail: new THREE.Color('#ff2a3d'),
  amber: new THREE.Color('#ffb02e'),
  selfish: new THREE.Color('#ff4d5e'),
  civic: new THREE.Color('#38e8a6'),
};

/** Additive, unlit glow quad material (instance colours act as tint × intensity). */
export function glowMaterial(tex: THREE.Texture = glowTexture(), clip?: THREE.Plane[]): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    clippingPlanes: clip ?? null,
    fog: false,
  });
}

export const beamMaterial = (clip?: THREE.Plane[]) => glowMaterial(beamTexture(), clip);
export const ringMaterial = (clip?: THREE.Plane[]) => glowMaterial(ringTexture(), clip);

/** Flat quad lying on the ground (XZ), 1×1, facing up. */
export function flatQuad(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Procedural lit-window facade shader for instanced buildings. */
export function buildingMaterial(fog: { color: THREE.Color; near: number; far: number }, clip?: THREE.Plane[], day = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    clipping: true,
    clippingPlanes: clip ?? null,
    uniforms: {
      uFogColor: { value: fog.color },
      uFogNear: { value: fog.near },
      uFogFar: { value: fog.far },
      uTime: { value: 0 },
      uDay: { value: day ? 1 : 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vLocal;
      varying vec3 vSeed;
      #include <clipping_planes_pars_vertex>
      void main() {
        mat4 im = instanceMatrix;
        vec4 wp = modelMatrix * im * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * mat3(im) * normal);
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3(0.2);
        #endif
        vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz));
        vLocal = position * sc;
        vSeed = im[3].xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <clipping_planes_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uFogColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uDay;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying vec3 vColor;
      varying vec3 vLocal;
      varying vec3 vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      #include <clipping_planes_pars_fragment>
      void main() {
        #include <clipping_planes_fragment>
        vec3 n = normalize(vNormal);
        float lambert = 0.28 + 0.72 * max(dot(n, normalize(vec3(-0.45, 0.85, 0.35))), 0.0);
        vec3 col = vColor * lambert * 0.42;
        if (abs(n.y) < 0.5) {
          float along = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
          vec2 cell = vec2(along / 2.9, vLocal.y / 3.3);
          vec2 id = floor(cell);
          vec2 f = fract(cell);
          float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.78);
          float seed = hash(vSeed.xz * 0.37 + n.xz * 7.0);
          float on = step(0.5 + 0.25 * seed, hash(id + vSeed.xz));
          vec3 warm = mix(vec3(1.0, 0.74, 0.42), vec3(0.72, 0.86, 1.0), step(0.78, hash(id * 1.37 + seed)));
          float upper = step(1.0, id.y);
          col += win * on * warm * 0.85 * upper;
          // ground-floor shopfronts
          float shop = (1.0 - upper) * step(0.15, f.y) * step(f.y, 0.85) * step(0.35, hash(vec2(id.x, seed * 9.0)));
          col += shop * mix(vec3(1.0, 0.55, 0.25), vec3(0.4, 0.9, 1.0), step(0.7, hash(id + 5.0))) * 0.55;
          // slight darkening towards the base
          col *= 0.75 + 0.25 * smoothstep(0.0, 6.0, vLocal.y);
        } else if (n.y > 0.5) {
          col = vColor * 0.22 + vec3(0.015, 0.017, 0.022);
        }
        if (uDay > 0.5) {
          // daylight facade: sunlit walls, dark glass, pale roofs
          float sun = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.45, 1.0, 0.55))), 0.0);
          col = vColor * sun;
          if (abs(n.y) < 0.5) {
            float along2 = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
            vec2 cell2 = vec2(along2 / 2.9, vLocal.y / 3.3);
            vec2 f2 = fract(cell2);
            float win2 = step(0.2, f2.x) * step(f2.x, 0.8) * step(0.3, f2.y) * step(f2.y, 0.78) * step(1.0, floor(cell2.y));
            col = mix(col, vec3(0.34, 0.42, 0.52) * (0.8 + 0.2 * sun), win2 * 0.85);
          } else if (n.y > 0.5) {
            col = vColor * 0.92;
          }
        }
        float d = length(vWorldPos - cameraPosition);
        col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, d));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
