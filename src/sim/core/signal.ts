// Fixed-time traffic signal controller.

export type Light = 'G' | 'Y' | 'R';

export interface Phase {
  groups: number[]; // signal groups that are green in this phase
  green: number; // seconds
}

export class Signal {
  readonly id: number;
  phases: Phase[];
  amber: number;
  allRed: number;
  private phase = 0;
  private stage: 'G' | 'Y' | 'AR' = 'G';
  private t = 0;
  /** Seconds since each group last turned red (for red-light-jumping logic). */
  private redSince = new Map<number, number>();
  cycle = 0;

  constructor(id: number, phases: Phase[], amber = 3, allRed = 2, offset = 0) {
    this.id = id;
    this.phases = phases;
    this.amber = amber;
    this.allRed = allRed;
    for (const p of phases) for (const g of p.groups) this.redSince.set(g, 99);
    this.advance(offset);
  }

  private advance(dt: number) {
    let left = dt;
    let guard = 0;
    while (left > 0 && guard++ < 1000) {
      const dur = this.stage === 'G' ? this.phases[this.phase].green : this.stage === 'Y' ? this.amber : this.allRed;
      const rem = dur - this.t;
      if (left < rem) {
        this.t += left;
        left = 0;
      } else {
        left -= rem;
        this.t = 0;
        if (this.stage === 'G') this.stage = 'Y';
        else if (this.stage === 'Y') {
          this.stage = 'AR';
          for (const g of this.phases[this.phase].groups) this.redSince.set(g, 0);
        } else {
          this.stage = 'G';
          this.phase = (this.phase + 1) % this.phases.length;
          if (this.phase === 0) this.cycle++;
        }
      }
    }
  }

  step(dt: number) {
    for (const [g, v] of this.redSince) this.redSince.set(g, v + dt);
    this.advance(dt);
  }

  state(group: number): Light {
    const p = this.phases[this.phase];
    if (!p.groups.includes(group)) return 'R';
    if (this.stage === 'G') return 'G';
    if (this.stage === 'Y') return 'Y';
    return 'R';
  }

  /** Seconds since `group` turned red (large if it has been green). */
  redFor(group: number): number {
    return this.state(group) === 'R' ? (this.redSince.get(group) ?? 99) : 0;
  }

  /** Remaining seconds in the current stage (for UI countdowns). */
  remaining(): number {
    const dur = this.stage === 'G' ? this.phases[this.phase].green : this.stage === 'Y' ? this.amber : this.allRed;
    return dur - this.t;
  }

  /** Unique key per green window, so amber decisions are made once per window. */
  windowKey(): number {
    return this.cycle * 16 + this.phase;
  }
}
