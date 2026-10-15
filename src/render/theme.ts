// Visual themes. "night" is the cinematic look; "day" is a clean, high-contrast
// look for explaining what is going on.
import * as THREE from 'three';

export type ThemeName = 'night' | 'day';

export interface Theme {
  name: ThemeName;
  bg: THREE.Color;
  fog: THREE.Color;
  ground: THREE.Color;
  slabSide: THREE.Color;
  edges: string;
  asphalt: THREE.Color;
  junction: THREE.Color;
  paving: THREE.Color;
  median: THREE.Color;
  line: THREE.Color;
  lineOpacity: number;
  yellow: THREE.Color;
  hemi: [string, string, number];
  key: { color: string; intensity: number; dir: [number, number, number]; shadows: boolean };
  fill: { color: string; intensity: number; dir: [number, number, number] };
  exposure: number;
  bloom: boolean;
  /** headlights, beams, street-light pools, glowing lamps */
  nightLights: boolean;
  facades: string[];
  trees: Record<'rain' | 'pink' | 'gulmohar' | 'palm', string[]>;
  shadowOpacity: number;
}

export const NIGHT: Theme = {
  name: 'night',
  bg: new THREE.Color('#06080f'),
  fog: new THREE.Color('#0a0e19'),
  ground: new THREE.Color('#1a2131'),
  slabSide: new THREE.Color('#0d1018'),
  edges: '#334055',
  asphalt: new THREE.Color('#353b49'),
  junction: new THREE.Color('#383e4c'),
  paving: new THREE.Color('#4a5160'),
  median: new THREE.Color('#1d3326'),
  line: new THREE.Color('#cfd3da'),
  lineOpacity: 0.62,
  yellow: new THREE.Color('#f2c230'),
  hemi: ['#7c8fcc', '#0c1018', 1.9],
  key: { color: '#b8c6ff', intensity: 1.5, dir: [-0.5, 1, 0.35], shadows: false },
  fill: { color: '#ffb27a', intensity: 0.35, dir: [0.3, 0.4, -1] },
  exposure: 1.3,
  bloom: true,
  nightLights: true,
  facades: ['#5b6476', '#6f6a63', '#4f5a6b', '#7a7166', '#5e6b74', '#696f7d', '#80776c', '#4b5563'],
  trees: {
    rain: ['#1d4a2c', '#24563a', '#1a3f2a', '#2a5c34'],
    pink: ['#d9649a', '#e57bb0', '#c45289'],
    gulmohar: ['#d9502e', '#e8673a'],
    palm: ['#2f6b3a'],
  },
  shadowOpacity: 0.55,
};

export const DAY: Theme = {
  name: 'day',
  bg: new THREE.Color('#e4e9ef'),
  fog: new THREE.Color('#e4e9ef'),
  ground: new THREE.Color('#cdd5c3'),
  slabSide: new THREE.Color('#a9b39f'),
  edges: '#8f9a86',
  asphalt: new THREE.Color('#62676f'),
  junction: new THREE.Color('#686d75'),
  paving: new THREE.Color('#d9d6cd'),
  median: new THREE.Color('#7da35f'),
  line: new THREE.Color('#ffffff'),
  lineOpacity: 0.95,
  yellow: new THREE.Color('#f5c518'),
  hemi: ['#ffffff', '#9aa38c', 1.55],
  key: { color: '#fff4e2', intensity: 2.4, dir: [-0.45, 1, 0.55], shadows: true },
  fill: { color: '#cfe0ff', intensity: 0.45, dir: [0.5, 0.6, -0.6] },
  exposure: 1.0,
  bloom: false,
  nightLights: false,
  facades: ['#e9e4da', '#ddd6ca', '#d3dae1', '#e6dccb', '#cfd4d9', '#efe9df', '#d8cfc2', '#c9d1d8'],
  trees: {
    rain: ['#4f8a3f', '#5c9a49', '#467d38', '#62a04e'],
    pink: ['#e88fba', '#f0a3c7', '#dc7aaa'],
    gulmohar: ['#e2633a', '#ec7a49'],
    palm: ['#5b9446'],
  },
  shadowOpacity: 0.25,
};

export const themeByName = (n: ThemeName): Theme => (n === 'day' ? DAY : NIGHT);
