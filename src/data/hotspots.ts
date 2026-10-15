// Congestion hotspots (approximate coordinates; OSM geocoded, rounded).
// Causes summarised from news reports 2024–2026: docs/RESEARCH-bengaluru.md

export type Cause = 'merge' | 'box' | 'freeleft' | 'lanes' | 'bay' | 'signal' | 'works' | 'water' | 'load';

export const CAUSES: Record<Cause, { label: string; chapter?: string; color: string }> = {
  merge: { label: 'Lanes merging', chapter: 'zipper', color: '#ffb02e' },
  box: { label: 'Junction blocking', chapter: 'gridlock', color: '#ff4d5e' },
  freeleft: { label: 'Free left blocked', chapter: 'freeleft', color: '#ff8a3d' },
  lanes: { label: 'Lane hopping', chapter: 'phantom', color: '#c084fc' },
  bay: { label: 'Buses stopping in lane', chapter: 'busbay', color: '#38bdf8' },
  signal: { label: 'Signal & zebra', chapter: 'zebra', color: '#f472b6' },
  works: { label: 'Metro / road works', color: '#a3a3a3' },
  water: { label: 'Waterlogging', color: '#60a5fa' },
  load: { label: 'Peak load', color: '#9ca3af' },
};

export interface Hotspot {
  name: string;
  lat: number;
  lng: number;
  severity: 1 | 2 | 3;
  causes: Cause[];
  note: string;
  /** one sourced headline number (docs/RESEARCH-bengaluru.md, section 4) */
  figure?: { value: string; label: string };
}

/** Longest queues reported (docs/RESEARCH-bengaluru.md, section 4). `after` = queue after a fix. */
export const QUEUES: { name: string; km: number; after?: number; when: string; hotspot?: string }[] = [
  { name: 'Central Silk Board', km: 19, after: 10, when: 'average queue, before → after the new ramps (2024)', hotspot: 'Central Silk Board' },
  { name: 'Veerannapalya (ORR)', km: 15.8, when: 'average evening queue, 5–9 pm (Dec 2025)', hotspot: 'Veerannapalya (ORR)' },
  { name: 'Hebbal', km: 12, when: 'at its worst (Jun 2025)', hotspot: 'Hebbal' },
  { name: 'Gokaldas Images Jn', km: 9.9, when: 'average morning queue (Dec 2025)' },
  { name: 'Horamavu', km: 1, when: 'at the signal (Jul 2026)', hotspot: 'Horamavu' },
];

export const HOTSPOTS: Hotspot[] = [
  {
    name: 'Hebbal',
    lat: 13.04,
    lng: 77.59,
    severity: 3,
    causes: ['merge', 'bay', 'works', 'water'],
    note: 'Seven lanes once funnelled into two at the flyover. New loops (2025) cut congestion by about a quarter to a third, but the jam moved to the Baptist Hospital descent, where five streams merge and buses block two lanes.',
    figure: { value: '12 km', label: 'queue at its worst, June 2025' },
  },
  {
    name: 'Mekhri Circle',
    lat: 13.015,
    lng: 77.584,
    severity: 2,
    causes: ['box', 'merge'],
    note: 'Tailback from the Hebbal loops reaches the circle; a free left is under consideration.',
  },
  {
    name: 'Veerannapalya (ORR)',
    lat: 13.042,
    lng: 77.614,
    severity: 3,
    causes: ['works', 'merge', 'load'],
    note: 'The city’s worst evening queue, 15.8 km on average (5–9 pm), along Blue Line metro construction.',
    figure: { value: '15.8 km', label: 'average evening queue, 5–9 pm (Dec 2025)' },
  },
  {
    name: 'Central Silk Board',
    lat: 12.916,
    lng: 77.622,
    severity: 3,
    causes: ['merge', 'box', 'works', 'water'],
    note: 'ORR meets Hosur Road. The double-decker flyover is fully open (Apr 2026) and queue alerts have halved, but Blue Line pillar work keeps barricades up.',
    figure: { value: '19 → 10 km', label: 'average queue, before and after the new ramps (2024)' },
  },
  {
    name: 'Goraguntepalya',
    lat: 13.029,
    lng: 77.54,
    severity: 3,
    causes: ['bay', 'freeleft', 'load', 'works'],
    note: 'Highway traffic from ~20 districts, spillback from the CMTI signal and BMTC buses stopping at the roadside. An extra lane and a free left are being added.',
  },
  {
    name: 'KR Puram / Tin Factory',
    lat: 12.997,
    lng: 77.669,
    severity: 3,
    causes: ['merge', 'bay', 'works'],
    note: 'A bridge pillar narrows the junction and buses halting at the ramp back traffic up.',
  },
  {
    name: 'Marathahalli bridge',
    lat: 12.957,
    lng: 77.703,
    severity: 2,
    causes: ['merge', 'box', 'works'],
    note: 'A rail-bridge bottleneck with U-turns on the bridge and pending metro work.',
  },
  {
    name: 'Bellandur / Ecospace',
    lat: 12.924,
    lng: 77.681,
    severity: 3,
    causes: ['lanes', 'load', 'water'],
    note: 'IT-corridor peaks. One bus breakdown plus road work caused a 4-hour standstill in Sep 2025; about 70 vehicles break down on the ORR every day.',
    figure: { value: '4 h', label: 'standstill after one bus broke down (Sep 2025)' },
  },
  {
    name: 'Iblur',
    lat: 12.923,
    lng: 77.663,
    severity: 2,
    causes: ['box', 'load', 'works'],
    note: 'Sarjapur Road traffic pours into the ORR; metro utility work adds pinch points.',
  },
  {
    name: 'Hope Farm, Whitefield',
    lat: 12.987,
    lng: 77.754,
    severity: 3,
    causes: ['bay', 'lanes', 'works'],
    note: 'Worst of 142 recurring East Bengaluru bottlenecks (+4.3 min per km): metro pillars, buses halting in the running lane, broken medians used for U-turns.',
    figure: { value: '+4.3 min', label: 'extra per km at peak, worst in East Bengaluru (2026)' },
  },
  {
    name: 'Horamavu',
    lat: 13.019,
    lng: 77.656,
    severity: 2,
    causes: ['works', 'signal'],
    note: 'Barricades squeeze the signal approach to one lane; about 1 km queues.',
    figure: { value: '1 km', label: 'queue at the signal (Jul 2026)' },
  },
  {
    name: 'Electronic City',
    lat: 12.857,
    lng: 77.663,
    severity: 2,
    causes: ['load', 'water'],
    note: 'Hosur Road (NH-44) inflow; the Yellow Line opened in Aug 2025.',
  },
  {
    name: 'Madiwala',
    lat: 12.922,
    lng: 77.618,
    severity: 2,
    causes: ['load', 'box'],
    note: 'Morning inflow from Tamil Nadu and Kerala on Hosur Road; trial diversions 8–10:30 am.',
  },
  {
    name: 'Jayadeva / Bannerghatta Rd',
    lat: 12.917,
    lng: 77.6,
    severity: 2,
    causes: ['works', 'merge'],
    note: 'Years of Pink Line works; new bottlenecks expected at Dairy Circle.',
  },
  { name: 'Panathur underpass', lat: 12.935, lng: 77.705, severity: 1, causes: ['water', 'works'], note: 'Repeatedly waterlogged; white-topping diversions.' },
];

// ---- stylised map geometry (approximate) ----
export type LL = [number, number]; // [lat, lng]

export const ORR: LL[] = [
  [13.04, 77.59],
  [13.042, 77.614],
  [13.033, 77.638],
  [13.022, 77.65],
  [13.016, 77.66],
  [13.0, 77.675],
  [12.99, 77.69],
  [12.973, 77.698],
  [12.957, 77.703],
  [12.937, 77.694],
  [12.924, 77.681],
  [12.923, 77.663],
  [12.924, 77.646],
  [12.918, 77.635],
  [12.916, 77.622],
  [12.913, 77.607],
  [12.912, 77.594],
  [12.906, 77.582],
  [12.915, 77.564],
  [12.928, 77.54],
  [12.946, 77.524],
  [12.966, 77.512],
  [12.985, 77.513],
  [13.005, 77.521],
  [13.029, 77.54],
  [13.037, 77.56],
  [13.04, 77.575],
];

export const RADIALS: { name: string; pts: LL[] }[] = [
  {
    name: 'Hosur Rd',
    pts: [
      [12.957, 77.61],
      [12.935, 77.616],
      [12.916, 77.622],
      [12.9, 77.63],
      [12.875, 77.645],
      [12.845, 77.663],
      [12.815, 77.69],
    ],
  },
  {
    name: 'Bellary Rd',
    pts: [
      [12.99, 77.585],
      [13.015, 77.584],
      [13.04, 77.59],
      [13.07, 77.594],
      [13.1, 77.596],
      [13.15, 77.62],
    ],
  },
  {
    name: 'Tumakuru Rd',
    pts: [
      [12.99, 77.57],
      [13.022, 77.55],
      [13.029, 77.54],
      [13.04, 77.515],
      [13.065, 77.48],
    ],
  },
  {
    name: 'Mysuru Rd',
    pts: [
      [12.963, 77.577],
      [12.955, 77.548],
      [12.946, 77.524],
      [12.925, 77.495],
      [12.905, 77.47],
    ],
  },
  {
    name: 'Old Madras Rd',
    pts: [
      [12.978, 77.62],
      [12.99, 77.645],
      [12.997, 77.669],
      [13.01, 77.71],
      [13.04, 77.76],
    ],
  },
  {
    name: 'Old Airport Rd',
    pts: [
      [12.97, 77.62],
      [12.961, 77.638],
      [12.958, 77.67],
      [12.957, 77.703],
      [12.958, 77.715],
      [12.975, 77.74],
      [12.987, 77.754],
    ],
  },
  {
    name: 'Sarjapur Rd',
    pts: [
      [12.935, 77.625],
      [12.925, 77.645],
      [12.923, 77.663],
      [12.905, 77.69],
      [12.87, 77.74],
    ],
  },
  {
    name: 'Bannerghatta Rd',
    pts: [
      [12.945, 77.598],
      [12.917, 77.6],
      [12.89, 77.598],
      [12.86, 77.595],
    ],
  },
  {
    name: 'Kanakapura Rd',
    pts: [
      [12.945, 77.578],
      [12.915, 77.572],
      [12.88, 77.555],
      [12.85, 77.54],
    ],
  },
  {
    name: 'Magadi Rd',
    pts: [
      [12.975, 77.56],
      [12.978, 77.53],
      [12.982, 77.5],
    ],
  },
];

export const METRO: { name: string; color: string; pts: LL[]; dashed?: boolean }[] = [
  {
    name: 'Purple',
    color: '#8b5cf6',
    pts: [
      [12.897, 77.461],
      [12.946, 77.53],
      [12.976, 77.572],
      [12.975, 77.607],
      [12.978, 77.639],
      [12.991, 77.652],
      [13.0, 77.675],
      [12.996, 77.715],
      [12.996, 77.758],
    ],
  },
  {
    name: 'Green',
    color: '#22c55e',
    pts: [
      [13.057, 77.473],
      [13.033, 77.533],
      [13.023, 77.55],
      [12.976, 77.572],
      [12.946, 77.58],
      [12.93, 77.58],
      [12.9, 77.57],
      [12.861, 77.53],
    ],
  },
  {
    name: 'Yellow',
    color: '#facc15',
    pts: [
      [12.921, 77.58],
      [12.917, 77.6],
      [12.916, 77.622],
      [12.9, 77.63],
      [12.845, 77.663],
      [12.816, 77.692],
    ],
  },
  {
    name: 'Pink',
    color: '#f472b6',
    pts: [
      [12.874, 77.598],
      [12.917, 77.6],
      [12.94, 77.6],
      [12.975, 77.61],
      [13.01, 77.615],
      [13.042, 77.62],
    ],
    dashed: true,
  },
  {
    name: 'Blue',
    color: '#38bdf8',
    pts: [
      [12.916, 77.622],
      [12.924, 77.681],
      [12.957, 77.703],
      [13.0, 77.675],
      [13.042, 77.614],
      [13.04, 77.59],
      [13.1, 77.62],
      [13.199, 77.707],
    ],
    dashed: true,
  },
];

export const LAKES: { lat: number; lng: number; rx: number; ry: number; rot: number }[] = [
  { lat: 12.935, lng: 77.668, rx: 1.6, ry: 0.75, rot: -20 },
  { lat: 12.94, lng: 77.745, rx: 1.0, ry: 0.55, rot: 10 },
  { lat: 12.983, lng: 77.62, rx: 0.45, ry: 0.35, rot: 0 },
  { lat: 13.045, lng: 77.59, rx: 0.55, ry: 0.4, rot: 30 },
  { lat: 12.91, lng: 77.62, rx: 0.45, ry: 0.3, rot: 0 },
  { lat: 13.011, lng: 77.574, rx: 0.3, ry: 0.2, rot: 0 },
  { lat: 12.923, lng: 77.643, rx: 0.4, ry: 0.25, rot: 0 },
];

export const PARKS: { lat: number; lng: number; rx: number; ry: number; name: string }[] = [
  { lat: 12.976, lng: 77.593, rx: 0.75, ry: 0.6, name: 'Cubbon Park' },
  { lat: 12.95, lng: 77.585, rx: 0.55, ry: 0.5, name: 'Lalbagh' },
];

const LAT0 = 12.97;
const LNG0 = 77.6;
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111.32;
const KY = 110.57;
/** Project lat/lng to kilometres (x east, y south) around the city centre. */
export const proj = (lat: number, lng: number): [number, number] => [(lng - LNG0) * KX, -(lat - LAT0) * KY];
