// Declarative description of everything static in a scenario's world, so the
// renderer can build the diorama without knowing about simulation internals.

import type { Vec2 } from './core/geom.ts';
import type { Signal } from './core/signal.ts';

export type Poly = Vec2[];

export interface LineMark {
  pts: Vec2[];
  color: 'white' | 'yellow' | 'red';
  width: number;
  dash?: [number, number];
}

export interface Building {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  rot: number;
  hue: number; // 0..1, picks window tint / facade tone
}

export interface Tree {
  x: number;
  y: number;
  r: number;
  kind: 'rain' | 'pink' | 'gulmohar' | 'palm';
}

export interface SignalPost {
  x: number;
  y: number;
  h: number; // facing (heading of traffic it controls)
  signal: Signal;
  group: number;
}

export interface Label {
  x: number;
  y: number;
  text: string;
  sub?: string;
  kind: 'place' | 'callout' | 'warn';
}

export interface VisualSpec {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  asphalt: Poly[];
  boxes: Poly[]; // junction boxes (asphalt) — yellow-box hatch if `hatch`
  hatch: Poly[];
  footpaths: Poly[];
  medians: { pts: Vec2[]; width: number }[];
  kerbs: Vec2[][]; // black–yellow painted kerb edges
  lines: LineMark[];
  stopLines: { a: Vec2; b: Vec2 }[];
  zebras: { a: Vec2; b: Vec2; depth: number }[]; // a→b across the road; stripes run along travel
  arrows: { x: number; y: number; h: number; kind: 'S' | 'L' | 'R' | 'SL' }[];
  texts: { x: number; y: number; h: number; text: string; color: 'white' | 'yellow' }[];
  signals: SignalPost[];
  barricades: { a: Vec2; b: Vec2 }[];
  cones: Vec2[];
  buildings: Building[];
  trees: Tree[];
  lamps: { x: number; y: number }[];
  busStops: { x: number; y: number; h: number; len: number }[];
  metro: { pts: Vec2[]; height: number; pillarEvery: number; color: number } | null;
  labels: Label[];
  plots: Poly[]; // raised city blocks
}

export function emptyVisual(): VisualSpec {
  return {
    bounds: { minX: -100, minY: -100, maxX: 100, maxY: 100 },
    asphalt: [],
    boxes: [],
    hatch: [],
    footpaths: [],
    medians: [],
    kerbs: [],
    lines: [],
    stopLines: [],
    zebras: [],
    arrows: [],
    texts: [],
    signals: [],
    barricades: [],
    cones: [],
    buildings: [],
    trees: [],
    lamps: [],
    busStops: [],
    metro: null,
    labels: [],
    plots: [],
  };
}
