// Small, fast, seedable PRNG (mulberry32) so that the "status quo" and the
// "swalpa adjust" worlds receive exactly the same stream of arriving traffic.

export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** Exponential inter-arrival time for a Poisson process of `rate` per second. */
  exp(rate: number): number {
    return -Math.log(1 - this.next()) / Math.max(rate, 1e-6);
  }
  weighted<T extends string>(w: Partial<Record<T, number>>): T {
    let total = 0;
    for (const k in w) total += w[k] ?? 0;
    let r = this.next() * total;
    for (const k in w) {
      r -= w[k] ?? 0;
      if (r <= 0) return k as T;
    }
    return Object.keys(w)[0] as T;
  }
}
