// Guided, step-by-step explanations for a chapter: problem first, then the fix.
import type { Rect } from '../render/Stage.ts';
import type { CurveWords } from '../lib/curve.ts';

export interface StoryStep {
  /** short label for the step dots */
  key: string;
  title: string;
  text: string;
  world: 'a' | 'b' | 'both';
  region?: Rect;
  /** tighter framing for phones */
  regionMobile?: Rect;
  pitch?: number;
  yaw?: number;
  /** scenario-defined call-out mode */
  anno: string | null;
  /** call-out mode on phones, when the full set would crowd the screen */
  annoMobile?: string;
  /** multiplier on the scenario's simulation speed (slower when zoomed in) */
  speed?: number;
  /** which story frame the badge at the top shows */
  badge: 'setup' | 'today' | 'fix' | 'compare';
  /** seconds this step stays up when auto-playing */
  dur: number;
  /** show the result summary card instead of a plain caption */
  summary?: boolean;
}

/** One headline number on the result card. */
export interface SummaryLine {
  /** metric key from the scenario's sample() */
  key: string;
  label: string;
  /** 'bars' draws both values to scale; 'pair' prints before → after */
  show: 'bars' | 'pair';
  /** 'duration' prints "2 min 44 s" */
  format?: 'duration';
  /** small grey note instead of the change, e.g. "so far in this run" */
  sub?: string;
}

export interface Story {
  steps: StoryStep[];
  /** short names for the two worlds: "Today" and the fix */
  names: { a: string; b: string };
  /** long badge text for the problem and fix frames */
  badges: { today: string; fix: string };
  /** what the explanatory vehicle colours mean; `pre` is dropped on phones */
  legend: { color: string; text: string; pre?: string }[];
  /** slider label: who adjusts in the swalpa-adjust world */
  slider: string;
  /** how the "how many of us need to adjust?" line talks about who adjusts and what improves */
  curve: CurveWords;
  summary: SummaryLine[];
  /** one line of fine print under the result card */
  note: string;
}

// the approach as a driver sees it: looking along the road towards the barricade
const APPROACH: Rect = { minX: -105, maxX: 40, minY: -9, maxY: 1 };
const MERGE: Rect = { minX: -36, maxX: 34, minY: -10, maxY: 0 };
const MERGE_PHONE: Rect = { minX: -12, maxX: 30, minY: -9, maxY: -1 };

const ZIPPER_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'A lane is closing',
    text: 'Metro works block the orange lane ahead. Two lanes have to become one.',
    world: 'a',
    region: APPROACH,
    pitch: 0.62,
    yaw: -0.9,
    anno: 'setup',
    speed: 0.9,
    badge: 'setup',
    dur: 7,
  },
  {
    key: 'Today',
    title: 'Today, nobody gives way',
    text: 'Orange vehicles race to the barricade and force their way in. Blue vehicles close every gap. Watch the merge point.',
    world: 'a',
    region: MERGE,
    regionMobile: MERGE_PHONE,
    pitch: 1.22,
    anno: 'problems',
    speed: 0.45,
    badge: 'today',
    dur: 12,
  },
  {
    key: 'Cost',
    title: 'Every stand-off stops both lanes',
    text: 'Each time two vehicles meet nose to nose, everyone behind them brakes. The queue keeps growing.',
    world: 'a',
    region: APPROACH,
    pitch: 0.62,
    yaw: -0.9,
    anno: 'queue',
    speed: 1,
    badge: 'today',
    dur: 9,
  },
  {
    key: 'Zipper',
    title: 'The zipper: take turns',
    text: 'Stay in your lane right up to the barricade. Whenever both lanes have someone waiting, go one by one: one blue, one orange. The numbers show the order.',
    world: 'b',
    region: MERGE,
    regionMobile: MERGE_PHONE,
    pitch: 1.22,
    anno: 'zipper',
    speed: 0.45,
    badge: 'fix',
    dur: 12,
  },
  {
    key: 'After',
    title: 'Same vehicles. A much shorter queue.',
    text: 'Both lanes are used to the end and nobody blocks the merge, so traffic keeps creeping forward instead of stalling.',
    world: 'b',
    region: APPROACH,
    pitch: 0.62,
    yaw: -0.9,
    anno: 'queue',
    speed: 1,
    badge: 'fix',
    dur: 8,
  },
  {
    key: 'Result',
    title: 'Same road. Same traffic. Only the merging changed.',
    text: '',
    world: 'b',
    region: APPROACH,
    pitch: 0.62,
    yaw: -0.9,
    anno: 'queue',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

// 02 · the box: four junctions; the story zooms in on the bottom-left one
const GRID: Rect = { minX: -128, maxX: 128, minY: -84, maxY: 84 };
// phones: the left pair of junctions, where the call-outs are
const GRID_PHONE: Rect = { minX: -114, maxX: 6, minY: -80, maxY: 80 };
const BOX_BL: Rect = { minX: -82, maxX: -22, minY: 16, maxY: 68 };
const BOX_BL_PHONE: Rect = { minX: -68, maxX: -36, minY: 24, maxY: 60 };

const BOX_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'Four junctions, one jammed main road',
    text: 'Blue vehicles are on the main road, which is backed up further on. Orange vehicles are on the side streets, which are clear beyond the junctions.',
    world: 'a',
    region: GRID,
    regionMobile: GRID_PHONE,
    pitch: 0.98,
    anno: 'setup',
    annoMobile: 'setup-phone',
    speed: 1,
    badge: 'setup',
    dur: 8,
  },
  {
    key: 'Today',
    title: 'Today, green means go, room or not',
    text: 'Main-road vehicles follow the car ahead into the junction and stop inside it. The side street gets its green and still can’t cross.',
    world: 'a',
    region: BOX_BL,
    regionMobile: BOX_BL_PHONE,
    pitch: 1.2,
    anno: 'problems',
    speed: 0.6,
    badge: 'today',
    dur: 14,
  },
  {
    key: 'Cost',
    title: 'One blocked box blocks the next',
    text: 'Each stuck junction backs up into its neighbour until all four lock into a loop, and nothing moves at all.',
    world: 'a',
    region: GRID,
    regionMobile: GRID_PHONE,
    pitch: 0.98,
    anno: 'cost',
    speed: 1,
    badge: 'today',
    dur: 10,
  },
  {
    key: 'Keep clear',
    title: 'Wait behind the line until there’s room',
    text: 'Same green light. These drivers wait until their whole vehicle fits on the other side, so the box stays clear for the side street.',
    world: 'b',
    region: BOX_BL,
    regionMobile: BOX_BL_PHONE,
    pitch: 1.2,
    anno: 'fix',
    speed: 0.6,
    badge: 'fix',
    dur: 14,
  },
  {
    key: 'After',
    title: 'Same traffic. No gridlock.',
    text: 'The main road is still slow, because it is jammed further on. But the junctions never lock, and the side streets keep moving.',
    world: 'b',
    region: GRID,
    regionMobile: GRID_PHONE,
    pitch: 0.98,
    anno: 'after',
    speed: 1,
    badge: 'fix',
    dur: 8,
  },
  {
    key: 'Result',
    title: 'Same junctions. Same traffic. Only the waiting changed.',
    text: '',
    world: 'b',
    region: GRID,
    regionMobile: GRID_PHONE,
    pitch: 0.98,
    anno: 'after',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

// 03 · free left: one signalised junction, the kerb lane of each approach may turn left on red
const FL_APPROACH: Rect = { minX: -78, maxX: 22, minY: -30, maxY: 18 };
const FL_JUNCTION: Rect = { minX: -48, maxX: 48, minY: -36, maxY: 36 };
const FL_JUNCTION_PHONE: Rect = { minX: -24, maxX: 24, minY: -28, maxY: 28 };
const FL_WIDE: Rect = { minX: -72, maxX: 72, minY: -50, maxY: 50 };
const FL_WIDE_PHONE: Rect = { minX: -38, maxX: 38, minY: -48, maxY: 40 };

const FREELEFT_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'A free left turn',
    text: 'The kerb lane is a free left: orange vehicles turning left may go even on red. Blue vehicles going straight wait for green in the other lanes.',
    world: 'a',
    region: FL_APPROACH,
    pitch: 0.7,
    yaw: -0.8,
    anno: 'setup',
    speed: 0.9,
    badge: 'setup',
    dur: 8,
  },
  {
    key: 'Today',
    title: 'Today, it’s a shortcut to the front',
    text: 'Blue vehicles going straight slip into the free left to get ahead, then sit at the red light. Every left-turner behind them is stuck.',
    world: 'a',
    region: FL_JUNCTION,
    regionMobile: FL_JUNCTION_PHONE,
    pitch: 1.2,
    anno: 'problems',
    speed: 0.6,
    badge: 'today',
    dur: 14,
  },
  {
    key: 'Cost',
    title: 'A free left that isn’t free',
    text: 'Left-turners end up waiting for a signal they never needed, nearly as long as everyone going straight.',
    world: 'a',
    region: FL_WIDE,
    regionMobile: FL_WIDE_PHONE,
    pitch: 1.05,
    anno: 'cost',
    speed: 1,
    badge: 'today',
    dur: 10,
  },
  {
    key: 'Keep it free',
    title: 'Going straight? Stay out of the free left',
    text: 'Straight-goers wait in the straight lanes. The free left stays empty, so left-turners keep moving, even on red.',
    world: 'b',
    region: FL_JUNCTION,
    regionMobile: FL_JUNCTION_PHONE,
    pitch: 1.2,
    anno: 'fix',
    speed: 0.6,
    badge: 'fix',
    dur: 14,
  },
  {
    key: 'After',
    title: 'Left-turners barely stop',
    text: 'Going straight takes a few seconds longer, as it now uses two lanes, not three. But overall, people lose less time.',
    world: 'b',
    region: FL_WIDE,
    regionMobile: FL_WIDE_PHONE,
    pitch: 1.05,
    anno: 'after',
    speed: 1,
    badge: 'fix',
    dur: 9,
  },
  {
    key: 'Result',
    title: 'Same junction. Same traffic. Only the lane choice changed.',
    text: '',
    world: 'b',
    region: FL_WIDE,
    regionMobile: FL_WIDE_PHONE,
    pitch: 1.05,
    anno: 'after',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

// 04 · lane & gap: a busy three-lane loop with nothing in the way
const PH_LONG: Rect = { minX: -100, maxX: 100, minY: -12, maxY: 0 };
const PH_LONG_PHONE: Rect = { minX: -45, maxX: 45, minY: -12, maxY: 0 };
// the camera follows the jam (Built.track), so this only sets the zoom
const PH_WAVE: Rect = { minX: -55, maxX: 55, minY: -12, maxY: 0 };
const PH_WAVE_PHONE: Rect = { minX: -28, maxX: 28, minY: -12, maxY: 0 };
const PH_ZOOM: Rect = { minX: -36, maxX: 36, minY: -13, maxY: -1 };
const PH_ZOOM_PHONE: Rect = { minX: -18, maxX: 18, minY: -13, maxY: -1 };

const PHANTOM_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'Three lanes, nothing in the way',
    text: 'No signal, no merge, no pothole: just busy traffic. Each vehicle turns amber when it slows and red when it stops.',
    world: 'a',
    region: PH_LONG,
    regionMobile: PH_LONG_PHONE,
    pitch: 0.72,
    yaw: -0.4,
    anno: 'setup',
    speed: 1,
    badge: 'setup',
    dur: 8,
  },
  {
    key: 'Today',
    title: 'Today, we hop lanes and brake late',
    text: 'Every cut-in forces the driver behind to brake, and the braking passes down the line.',
    world: 'a',
    region: PH_ZOOM,
    regionMobile: PH_ZOOM_PHONE,
    pitch: 1.1,
    anno: 'problems',
    speed: 0.6,
    badge: 'today',
    dur: 14,
  },
  {
    key: 'Cost',
    title: 'The braking turns into a jam that moves backwards',
    text: 'A band of stopped traffic drifts back against the flow. Nobody caused it, and everyone drives into it.',
    world: 'a',
    region: PH_WAVE,
    regionMobile: PH_WAVE_PHONE,
    pitch: 0.8,
    yaw: -0.3,
    anno: 'wave',
    speed: 1.2,
    badge: 'today',
    dur: 12,
  },
  {
    key: 'Hold your lane',
    title: 'Hold your lane, ease off early',
    text: 'Pick a lane and stay in it. Ease off smoothly instead of braking late, so small slowdowns fade out.',
    world: 'b',
    region: PH_ZOOM,
    regionMobile: PH_ZOOM_PHONE,
    pitch: 1.1,
    anno: 'fix',
    speed: 0.6,
    badge: 'fix',
    dur: 12,
  },
  {
    key: 'After',
    title: 'Same vehicles. No waves.',
    text: 'Everyone moves at a steady pace, and the whole stretch flows faster.',
    world: 'b',
    region: PH_LONG,
    regionMobile: PH_LONG_PHONE,
    pitch: 0.72,
    yaw: -0.4,
    anno: 'after',
    speed: 1,
    badge: 'fix',
    dur: 8,
  },
  {
    key: 'Result',
    title: 'Same road. Same traffic. Only the driving changed.',
    text: '',
    world: 'b',
    region: PH_LONG,
    regionMobile: PH_LONG_PHONE,
    pitch: 0.72,
    yaw: -0.4,
    anno: 'after',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

// 05 · the bay: a BMTC stop with a bay on a three-lane road (the stop is at x ≈ 37)
const BB_WIDE: Rect = { minX: -80, maxX: 70, minY: -18, maxY: 2 };
const BB_WIDE_PHONE: Rect = { minX: -20, maxX: 56, minY: -18, maxY: 2 };
const BB_STOP: Rect = { minX: -28, maxX: 62, minY: -20, maxY: 2 };
const BB_STOP_PHONE: Rect = { minX: 4, maxX: 54, minY: -20, maxY: 2 };

const BUSBAY_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'A bus stop with a proper bay',
    text: 'Orange vehicles stop for passengers: every bus, and some autos picking up a fare. The bay lets them do it off the road.',
    world: 'a',
    region: BB_WIDE,
    regionMobile: BB_WIDE_PHONE,
    pitch: 0.75,
    yaw: -0.4,
    anno: 'setup',
    speed: 1,
    badge: 'setup',
    dur: 8,
  },
  {
    key: 'Today',
    title: 'Today, they stop wherever the crowd is',
    text: 'Buses and autos halt in a running lane. Everyone behind them brakes and swerves around.',
    world: 'a',
    region: BB_STOP,
    regionMobile: BB_STOP_PHONE,
    pitch: 1.15,
    anno: 'problems',
    speed: 0.6,
    badge: 'today',
    dur: 14,
  },
  {
    key: 'Cost',
    title: 'Every stop deletes a lane',
    text: 'Traffic squeezes into the lanes that are left, changing lanes constantly, and slows right down near the stop.',
    world: 'a',
    region: BB_WIDE,
    regionMobile: BB_WIDE_PHONE,
    pitch: 0.75,
    yaw: -0.4,
    anno: 'cost',
    speed: 1,
    badge: 'today',
    dur: 10,
  },
  {
    key: 'Use the bay',
    title: 'Pull into the bay, let the bus back out',
    text: 'Buses and autos stop fully inside the bay. Drivers behind leave a gap so they can rejoin, one at a time.',
    world: 'b',
    region: BB_STOP,
    regionMobile: BB_STOP_PHONE,
    pitch: 1.15,
    anno: 'fix',
    speed: 0.6,
    badge: 'fix',
    dur: 14,
  },
  {
    key: 'After',
    title: 'All three lanes keep moving',
    text: 'No lane is lost, so through traffic passes the stop without slowing down.',
    world: 'b',
    region: BB_WIDE,
    regionMobile: BB_WIDE_PHONE,
    pitch: 0.75,
    yaw: -0.4,
    anno: 'after',
    speed: 1,
    badge: 'fix',
    dur: 8,
  },
  {
    key: 'Result',
    title: 'Same stop. Same traffic. Only where they stop changed.',
    text: '',
    world: 'b',
    region: BB_WIDE,
    regionMobile: BB_WIDE_PHONE,
    pitch: 0.75,
    yaw: -0.4,
    anno: 'after',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

// 06 · red means red: a signalised zebra at x = 0 on a two-way road
const ZB_SETUP: Rect = { minX: -45, maxX: 45, minY: -16, maxY: 16 };
const ZB_SETUP_PHONE: Rect = { minX: -20, maxX: 20, minY: -16, maxY: 16 };
const ZB_CROSS: Rect = { minX: -28, maxX: 28, minY: -14, maxY: 14 };
const ZB_CROSS_PHONE: Rect = { minX: -14, maxX: 14, minY: -14, maxY: 14 };
const ZB_WIDE: Rect = { minX: -85, maxX: 85, minY: -14, maxY: 14 };
const ZB_WIDE_PHONE: Rect = { minX: -40, maxX: 40, minY: -14, maxY: 14 };

const ZEBRA_STEPS: StoryStep[] = [
  {
    key: 'Setup',
    title: 'A zebra crossing with a signal',
    text: 'On red, vehicles wait behind the stop line. On the walk signal, people cross on the zebra. That’s the deal.',
    world: 'a',
    region: ZB_SETUP,
    regionMobile: ZB_SETUP_PHONE,
    pitch: 0.9,
    anno: 'setup',
    speed: 0.9,
    badge: 'setup',
    dur: 8,
  },
  {
    key: 'Today',
    title: 'Today, amber means hurry',
    text: 'Drivers speed through the amber and the first seconds of red, then stop on the zebra itself. Red vehicles ran the light.',
    world: 'a',
    region: ZB_CROSS,
    regionMobile: ZB_CROSS_PHONE,
    pitch: 1.15,
    anno: 'problems',
    speed: 0.6,
    badge: 'today',
    dur: 14,
  },
  {
    key: 'Cost',
    title: 'So people stop trusting the signal',
    text: 'They give up waiting and cross wherever there’s a gap, often well away from the zebra. Near misses follow.',
    world: 'a',
    region: ZB_WIDE,
    regionMobile: ZB_WIDE_PHONE,
    pitch: 0.8,
    yaw: -0.35,
    anno: 'cost',
    speed: 0.8,
    badge: 'today',
    dur: 12,
  },
  {
    key: 'Keep the deal',
    title: 'Stop on amber. Walk on green.',
    text: 'Drivers stop behind the line when they safely can. People wait for the walk signal, then cross on the zebra.',
    world: 'b',
    region: ZB_CROSS,
    regionMobile: ZB_CROSS_PHONE,
    pitch: 1.15,
    anno: 'fix',
    speed: 0.6,
    badge: 'fix',
    dur: 14,
  },
  {
    key: 'After',
    title: 'A little more waiting, no dodging',
    text: 'People wait about 10 seconds longer for the walk signal. In return there are no near misses, and vehicles get through just as well.',
    world: 'b',
    region: ZB_WIDE,
    regionMobile: ZB_WIDE_PHONE,
    pitch: 0.8,
    yaw: -0.35,
    anno: 'after',
    speed: 1,
    badge: 'fix',
    dur: 9,
  },
  {
    key: 'Result',
    title: 'Same crossing. Same people. Only the deal was kept.',
    text: '',
    world: 'b',
    region: ZB_WIDE,
    regionMobile: ZB_WIDE_PHONE,
    pitch: 0.8,
    yaw: -0.35,
    anno: 'after',
    speed: 1,
    badge: 'compare',
    dur: 0,
    summary: true,
  },
];

export const STORIES: Record<string, Story> = {
  zipper: {
    steps: ZIPPER_STEPS,
    names: { a: 'Today', b: 'Zipper' },
    badges: { today: 'Status quo · how we merge today', fix: 'Swalpa adjust · the zipper' },
    legend: [
      { color: '#2f6fed', pre: 'lane that', text: 'carries on' },
      { color: '#ff8a1f', pre: 'lane that', text: 'closes' },
    ],
    slider: 'Drivers who zip',
    curve: { who: 'drivers zip', whoIng: 'drivers zipping', gain: 'the queue is {already}{change}' },
    summary: [
      { key: 'queue', label: 'Queue behind the barricade', show: 'bars' },
      { key: 'trip', label: 'Time to get past', show: 'pair', format: 'duration' },
      { key: 'forced', label: 'Stand-offs & forced nose-ins', show: 'pair', sub: 'so far in this run' },
    ],
    note: 'Both roads get exactly the same vehicles, about 33 a minute.',
  },
  gridlock: {
    steps: BOX_STEPS,
    names: { a: 'Today', b: 'Keep clear' },
    badges: { today: 'Status quo · go on green, room or not', fix: 'Swalpa adjust · wait for room' },
    legend: [
      { color: '#2f6fed', text: 'main road' },
      { color: '#ff8a1f', text: 'side street' },
    ],
    slider: 'Drivers who wait for room',
    curve: { who: 'drivers wait for room', whoIng: 'drivers waiting for room', gain: '{change} vehicles {already}get through' },
    summary: [
      { key: 'thru', label: 'Vehicles getting through, per minute', show: 'bars' },
      { key: 'sideThru', label: 'Side street, across per minute', show: 'pair' },
      { key: 'inbox', label: 'Stuck inside the boxes', show: 'pair', sub: 'right now' },
    ],
    note: 'Both grids get exactly the same vehicles, about 110 a minute.',
  },
  freeleft: {
    steps: FREELEFT_STEPS,
    names: { a: 'Today', b: 'Kept free' },
    badges: { today: 'Status quo · the free left as a shortcut', fix: 'Swalpa adjust · keep the free left free' },
    legend: [
      { color: '#ff8a1f', text: 'turning left' },
      { color: '#2f6fed', text: 'going straight' },
    ],
    slider: 'Straight-goers who keep out of the free left',
    curve: { who: 'straight-goers keep out', whoIng: 'straight-goers keeping out', gain: 'the wait to turn left is {already}{change}' },
    summary: [
      { key: 'leftDelay', label: 'Delay for each left-turner', show: 'bars' },
      { key: 'straightDelay', label: 'Delay going straight', show: 'pair' },
      { key: 'lost', label: 'People-minutes lost', show: 'pair', sub: 'so far in this run' },
    ],
    note: 'Both junctions get exactly the same vehicles, about 75 a minute, more than half of them turning left.',
  },
  phantom: {
    steps: PHANTOM_STEPS,
    names: { a: 'Today', b: 'Steady' },
    badges: { today: 'Status quo · hop lanes, brake late', fix: 'Swalpa adjust · hold your lane' },
    legend: [
      { color: '#e2364a', text: 'stopped' },
      { color: '#f5a524', text: 'slow' },
      { color: '#2f6fed', text: 'moving' },
    ],
    slider: 'Drivers who hold their lane',
    curve: { who: 'drivers hold their lane', whoIng: 'drivers holding their lane', gain: 'traffic {already}moves {change}' },
    summary: [
      { key: 'speed', label: 'Average speed', show: 'bars' },
      { key: 'stopped', label: 'At a standstill', show: 'pair' },
      { key: 'brakes', label: 'Hard brakes per minute', show: 'pair' },
    ],
    note: 'Both roads carry exactly the same vehicles, about 85 per km in each lane.',
  },
  busbay: {
    steps: BUSBAY_STEPS,
    names: { a: 'Today', b: 'Bay used' },
    badges: { today: 'Status quo · stop wherever', fix: 'Swalpa adjust · use the bay' },
    legend: [
      { color: '#ff8a1f', text: 'stops for passengers' },
      { color: '#2f6fed', text: 'through traffic' },
    ],
    slider: 'Drivers who use the bay',
    curve: { who: 'drivers use the bay', whoIng: 'drivers using the bay', gain: 'traffic past the stop {already}moves {change}' },
    summary: [
      { key: 'zone', label: 'Speed past the stop', show: 'bars' },
      { key: 'blocked', label: 'A running lane blocked', show: 'pair' },
      { key: 'lcs', label: 'Lane changes near the stop', show: 'pair' },
    ],
    note: 'Both roads get exactly the same vehicles, about 55 a minute, buses included.',
  },
  zebra: {
    steps: ZEBRA_STEPS,
    names: { a: 'Today', b: 'Deal kept' },
    badges: { today: 'Status quo · amber means hurry', fix: 'Swalpa adjust · stop on amber, walk on green' },
    legend: [
      { color: '#e2364a', text: 'ran amber or red' },
      { color: '#ff8a1f', text: 'stopped on the zebra' },
      { color: '#2f6fed', pre: 'other', text: 'vehicles' },
    ],
    slider: 'Drivers and walkers who keep the deal',
    curve: { who: 'of us keep the deal', whoIng: 'of us keeping the deal', gain: 'there are {already}{change} near misses' },
    summary: [
      { key: 'near', label: 'Near misses with people walking, so far', show: 'bars' },
      { key: 'jay', label: 'Crossing away from the zebra', show: 'pair' },
      { key: 'pedWait', label: 'Wait to cross', show: 'pair' },
    ],
    note: 'Both roads get exactly the same vehicles, about 53 a minute, and the same 13 people a minute arriving to cross.',
  },
};
