import type { Vehicle, World } from '../core/world.ts';
import type { VisualSpec } from '../visual.ts';

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  better: 'higher' | 'lower';
  digits?: number;
  /** Format as mm:ss */
  clock?: boolean;
  hero?: boolean; // headline metric for the chapter
  /** words for a change, e.g. 'shorter' / 'longer' (default 'lower' / 'higher') */
  down?: string;
  up?: string;
  /** a duration: a big drop reads as "3.8× faster" */
  time?: boolean;
  /** how to say "dropped to zero" (default 'none at all') */
  zero?: string;
}

export type Tone = 'bad' | 'warn' | 'good' | 'info';

/** World-anchored call-outs used to explain what is happening (sim coordinates). */
export type Annotation =
  | { kind: 'tag'; id: string; x: number; y: number; text: string; tone: Tone; ring?: number; side?: 'up' | 'down'; h?: number }
  | { kind: 'bracket'; id: string; x0: number; x1: number; y: number; text: string; tone: Tone }
  | { kind: 'badge'; id: string; x: number; y: number; text: string; color: string }
  | { kind: 'chain'; id: string; pts: { x: number; y: number }[]; tone: Tone };

export interface Built {
  world: World;
  vis: VisualSpec;
  sample: () => Record<string, number>;
  /** Call-outs for a given explanation mode (e.g. 'problems', 'zipper'). */
  annotate?: (mode: string) => Annotation[];
  /** Explanatory colouring (e.g. by lane of origin). Return null to keep the paint colour. */
  colorBy?: (v: Vehicle) => number | null;
  /** A point the camera should follow in a call-out mode (e.g. a drifting jam), or null to hold still. */
  track?: (mode: string) => { x: number; y: number } | null;
}

export interface ScenarioDef {
  id: string;
  /** seconds simulated before first frame */
  warmup: number;
  /** how the two worlds are laid out next to each other */
  split: 'h' | 'v';
  /** sim seconds per real second */
  speed: number;
  metrics: MetricDef[];
  build: (seed: number, civicShare: number) => Built;
  /** 'split' = two cut-out dioramas stacked; 'wipe' = one diorama with a draggable before/after divider */
  view: 'split' | 'wipe';
  /** CSS aspect ratio of the stage card on wide screens */
  aspect: string;
  /** camera framing tweaks */
  camera?: { pitch?: number; zoom?: number };
}
