// Vehicle classes and behaviour profiles.
// Parameters follow the Intelligent Driver Model (Treiber, Hennecke & Helbing 2000)
// and the MOBIL lane-change model (Kesting, Treiber & Helbing 2007), tuned for
// slow, dense, mixed Bengaluru city traffic.

export type VType = 'bike' | 'car' | 'cab' | 'auto' | 'bus' | 'truck';
export type Move = 'S' | 'L' | 'R';

export interface VSpec {
  len: number;
  wid: number;
  v0: number; // desired speed m/s
  a: number; // max acceleration m/s²
  b: number; // comfortable deceleration m/s²
  T: number; // safe time headway s
  s0: number; // jam distance m
  occupancy: number; // average people on board
  colors: number[];
}

export const VSPECS: Record<VType, VSpec> = {
  bike: {
    len: 2.0,
    wid: 0.8,
    v0: 12.5,
    a: 2.2,
    b: 2.6,
    T: 0.95,
    s0: 0.9,
    occupancy: 1.3,
    colors: [0x22252b, 0x30343c, 0x8a1c1c, 0x1d3f7a, 0x3a3f47, 0x14161a],
  },
  car: {
    len: 4.2,
    wid: 1.8,
    v0: 12.5,
    a: 1.6,
    b: 2.3,
    T: 1.25,
    s0: 1.7,
    occupancy: 1.6,
    colors: [0xeef0f2, 0xd9dde2, 0xb8bec6, 0x8a9099, 0x2e3440, 0x9c1f26, 0x1f4e8c, 0x6b6f75, 0xf2efe8, 0x444b55],
  },
  cab: { len: 4.3, wid: 1.8, v0: 12.5, a: 1.6, b: 2.3, T: 1.2, s0: 1.7, occupancy: 1.5, colors: [0xf7f7f5, 0xeeeeea] },
  auto: { len: 2.7, wid: 1.35, v0: 10.5, a: 1.3, b: 2.2, T: 1.05, s0: 1.2, occupancy: 2.2, colors: [0x1f8a4c] },
  bus: { len: 11.5, wid: 2.6, v0: 10.5, a: 0.9, b: 1.9, T: 1.5, s0: 2.4, occupancy: 45, colors: [0x2563c9, 0xc8462b, 0x16a34a] },
  truck: { len: 8.0, wid: 2.45, v0: 10, a: 0.8, b: 1.9, T: 1.6, s0: 2.4, occupancy: 1.5, colors: [0xe8742a, 0xd4a017, 0x3b6ea5] },
};

export type Mix = Partial<Record<VType, number>>;

/** Typical Bengaluru arterial mix (two-wheelers dominate). */
export const BLR_MIX: Mix = { bike: 0.46, car: 0.27, cab: 0.08, auto: 0.11, bus: 0.04, truck: 0.04 };

/** How a driver behaves. Two archetypes, blended per vehicle by the civic-share slider. */
export interface Profile {
  name: 'selfish' | 'civic';
  Tmul: number; // headway multiplier (tailgating < 1)
  s0mul: number;
  politeness: number; // MOBIL p
  lcThresh: number; // MOBIL Δa_th
  bSafe: number; // max braking imposed on others when changing lanes
  lcCooldown: [number, number];
  lcEvalPeriod: number; // s between lane-change evaluations
  boxRule: boolean; // don't enter a junction unless the exit is clear
  ambRun: number; // probability of running an amber they could have stopped for
  redRun: number; // probability of jumping the first seconds of red
  zipper: boolean; // let one merging vehicle in, merge late at speed
  forceMerge: boolean; // nose in with tiny gaps
  keepFreeLeft: boolean;
  useBay: boolean;
  honkRate: number; // honks per second while stuck
  react: number; // start-up reaction time s
  lag?: number; // response lag on acceleration (s); overrides the world default
}

export const SELFISH: Profile = {
  name: 'selfish',
  Tmul: 0.85,
  s0mul: 0.85,
  politeness: 0,
  lcThresh: 0.05,
  bSafe: 5.5,
  lcCooldown: [1.2, 3],
  lcEvalPeriod: 0.35,
  boxRule: false,
  ambRun: 0.75,
  redRun: 0.35,
  zipper: false,
  forceMerge: true,
  keepFreeLeft: false,
  useBay: false,
  honkRate: 0.22,
  react: 0.95,
};

export const CIVIC: Profile = {
  name: 'civic',
  Tmul: 0.85,
  s0mul: 0.85,
  politeness: 0.5,
  lcThresh: 0.35,
  bSafe: 2.2,
  lcCooldown: [5, 9],
  lcEvalPeriod: 0.8,
  boxRule: true,
  ambRun: 0,
  redRun: 0,
  zipper: true,
  forceMerge: false,
  keepFreeLeft: true,
  useBay: true,
  honkRate: 0.01,
  react: 0.95,
};
