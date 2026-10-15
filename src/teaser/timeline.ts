// The 60-second teaser, as data: scenes (one simulated scenario each) made of shots (camera,
// call-outs, caption). Framing reuses the verified chapter steps in data/stories.ts.
// Pure TypeScript so scripts/dev/teasercheck.ts can replay it headless.
import { STORIES, type StoryStep } from '../data/stories.ts';
import type { Rect } from '../render/Stage.ts';

export interface Shot {
  dur: number;
  world: 'a' | 'b';
  region: Rect;
  pitch?: number;
  yaw?: number;
  /** call-out mode passed to the scenario's annotate() */
  anno: string;
  /** multiplier on the scenario's own simulation speed */
  speed: number;
  /** red "Today" or green "Adjust a little" chip above the caption */
  tag?: 'today' | 'fix';
  title: string;
  sub?: string;
  /** big result number that pops in `at` seconds into the shot */
  stamp?: { value: string; label: string; at: number };
  /** the closing card fades in this many seconds into the shot */
  end?: number;
  /** small source line under the caption */
  source?: string;
  /** show only the call-outs whose text matches (to avoid overlapping labels at feed size) */
  only?: RegExp;
  /** slow push-in over the shot (fraction of zoom); 0 keeps a wide shot perfectly still */
  push?: number;
}

export interface Scene {
  id: string;
  scenario: string;
  seed: number;
  warmup: number;
  shots: Shot[];
}

const GRID: Rect = { minX: -128, maxX: 128, minY: -84, maxY: 84 };

// the lane-hopping road is long and thin: frame a shorter stretch so it fills a square
const LANES: Rect = { minX: -30, maxX: 30, minY: -12, maxY: 0 };

/** A shot framed like a chapter step (any field can be overridden). */
const from = (id: string, step: number, s: Partial<Shot> & Pick<Shot, 'dur' | 'title'>): Shot => {
  const st: StoryStep = STORIES[id].steps[step];
  return { world: st.world === 'a' ? 'a' : 'b', region: st.region!, pitch: st.pitch, yaw: st.yaw, anno: st.anno ?? '', speed: st.speed ?? 1, ...s };
};

export const SCENES: Scene[] = [
  {
    id: 'hook',
    scenario: 'hero',
    seed: 5,
    warmup: 330,
    shots: [
      {
        dur: 4.0,
        world: 'a',
        region: GRID,
        pitch: 0.98,
        anno: 'cost',
        speed: 1.2,
        push: 0,
        title: 'No accident. No breakdown. No rain.',
        // true of the simulated grid: the only difference between the two worlds is this habit, and only "today" locks up
        sub: 'This gridlock comes from one habit: blocking junctions.',
      },
      {
        dur: 4.4,
        push: 0,
        world: 'a',
        region: GRID,
        pitch: 0.98,
        anno: 'cost',
        speed: 1.2,
        title: 'TomTom ranks Bengaluru the world’s 2nd most congested city.',
        sub: 'Flyovers take years. Better habits take seconds.',
        source: 'TomTom Traffic Index 2025',
      },
    ],
  },
  {
    id: 'zipper',
    scenario: 'zipper',
    // a busy merge in both worlds (seed 11 leaves the zipper road nearly empty): scripts/dev/teasercheck.ts
    seed: 41,
    warmup: 480,
    shots: [
      from('zipper', 1, { dur: 4.8, tag: 'today', title: 'Forcing your way in at a merge', only: /Stand-off|Forces|Slams|early/ }),
      from('zipper', 3, { dur: 5.4, tag: 'fix', title: 'Taking turns, like a zipper', stamp: { value: '84%', label: 'shorter queue', at: 2.0 } }),
    ],
  },
  {
    id: 'box',
    scenario: 'gridlock',
    seed: 12,
    // starts the fix shot as the side street's light turns green, so "Waits: no room" is on screen
    warmup: 438,
    shots: [
      from('gridlock', 1, { dur: 4.8, tag: 'today', title: 'Entering a junction you can’t leave' }),
      from('gridlock', 3, { dur: 5.4, tag: 'fix', title: 'Waiting until there’s room', stamp: { value: '9×', label: 'more vehicles get through', at: 2.0 } }),
    ],
  },
  {
    id: 'lanes',
    scenario: 'phantom',
    seed: 14,
    // the jam is mid-road (x ≈ 109 m) for the whole shot, away from where the looping road wraps
    warmup: 215,
    shots: [
      from('phantom', 2, { dur: 4.8, tag: 'today', title: 'Lane-hopping and braking late', region: LANES, pitch: 0.9, yaw: -0.25 }),
      from('phantom', 4, {
        dur: 5.4,
        tag: 'fix',
        title: 'Holding your lane, easing off early',
        region: LANES,
        pitch: 0.9,
        yaw: -0.25,
        stamp: { value: '56%', label: 'faster on the same road', at: 2.0 },
      }),
    ],
  },
  {
    id: 'freeleft',
    scenario: 'freeleft',
    seed: 13,
    // a left-turner going on red right as the shot starts: scripts/dev/teasersweep.ts
    warmup: 276.5,
    shots: [
      from('freeleft', 3, {
        dur: 2.5,
        tag: 'fix',
        title: 'Keep the free left free',
        only: /Turns left/,
        stamp: { value: '77%', label: 'shorter wait to turn left', at: 0.3 },
      }),
    ],
  },
  {
    id: 'bay',
    scenario: 'busbay',
    seed: 15,
    warmup: 140,
    shots: [
      from('busbay', 3, { dur: 2.5, tag: 'fix', title: 'Stop in the bay, not the lane', stamp: { value: '52%', label: 'faster past the bus stop', at: 0.3 } }),
    ],
  },
  {
    id: 'zebra',
    scenario: 'zebra',
    seed: 16,
    // the walk signal is on as the shot starts: scripts/dev/teasersweep.ts
    warmup: 74,
    shots: [
      from('zebra', 3, {
        dur: 2.5,
        tag: 'fix',
        title: 'Stop on amber, walk on green',
        // simulated near misses over 6 minutes, averaged over three runs (scripts/simcompare.ts zebra)
        stamp: { value: '35 → 0', label: 'near misses with walkers, in 6 min', at: 0.3 },
      }),
    ],
  },
  {
    id: 'payoff',
    scenario: 'hero',
    seed: 5,
    warmup: 330,
    shots: [
      {
        dur: 6.5,
        world: 'b',
        region: GRID,
        pitch: 0.98,
        anno: 'after',
        speed: 1.2,
        push: 0,
        title: 'Same roads. Same traffic. Only our habits changed.',
        end: 2.8,
      },
    ],
  },
];

export interface Cue {
  scene: number;
  shot: number;
  start: number;
  sceneStart: number;
}

/** Every shot with its start time. */
export const CUES: Cue[] = [];
{
  let t = 0;
  SCENES.forEach((sc, i) => {
    const sceneStart = t;
    sc.shots.forEach((sh, j) => {
      CUES.push({ scene: i, shot: j, start: t, sceneStart });
      t += sh.dur;
    });
  });
}
export const TEASER_DURATION = SCENES.reduce((s, sc) => s + sc.shots.reduce((a, b) => a + b.dur, 0), 0);

export const cueAt = (t: number): Cue => {
  let k = 0;
  while (k < CUES.length - 1 && t >= CUES[k + 1].start) k++;
  return CUES[k];
};
