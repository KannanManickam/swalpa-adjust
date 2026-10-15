// Does the junction-box rule alone decide gridlock in the hero grid? Swaps only boxRule between profiles.
//   node scripts/dev/boxonly.ts
import { hero } from '../../src/sim/scenarios/gridlock.ts';
import { CIVIC, SELFISH } from '../../src/sim/core/types.ts';
const cases: [string, number, Partial<typeof SELFISH>][] = [
  ['careless drivers (today)', 0, {}],
  ['careless, but they keep the box clear', 0, { boxRule: true }],
  ['careful drivers (swalpa adjust)', 1, {}],
  ['careful, but they block the box', 1, { boxRule: false }],
];
for (const [name, share, tweak] of cases) {
  let thru = 0,
    frozenMax = 0,
    inbox = 0,
    n = 0;
  for (const seed of [5, 6, 7]) {
    const b = hero.build(seed, share);
    const w = b.world;
    w.selfishProfile = { ...SELFISH, ...(share === 0 ? tweak : {}) };
    w.civicProfile = { ...CIVIC, ...(share === 1 ? tweak : {}) };
    w.setCivicShare(share);
    w.run(330 + 120);
    for (let k = 0; k < 60; k++) {
      w.run(1);
      const s = b.sample();
      thru += s.thru;
      inbox += s.inbox;
      frozenMax = Math.max(frozenMax, s.frozen);
      n++;
    }
  }
  console.log(
    `${name.padEnd(40)} out/min ${(thru / n).toFixed(0).padStart(3)}  stuck in boxes ${(inbox / n).toFixed(0).padStart(3)}  longest gridlock ${frozenMax.toFixed(0)} s`,
  );
}
