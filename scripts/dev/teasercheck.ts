// Replays the teaser timeline headless (same simulation steps as the browser) and reports, per shot,
// how often the call-outs that the caption relies on are actually on screen.
//   node scripts/dev/teasercheck.ts [sceneId=seed:warmup ...]   e.g. zipper=21:480 to try another seed
import { SCENES, type Shot } from '../../src/teaser/timeline.ts';
import { byId } from '../../src/sim/scenarios/index.ts';
import type { Annotation, Built } from '../../src/sim/scenarios/types.ts';

const NEED: Record<string, (a: Annotation[]) => boolean> = {
  'hook.0': (a) => a.some((x) => x.kind === 'tag' && /Box blocked/.test(x.text)),
  'hook.1': (a) => a.some((x) => x.kind === 'tag' && /Box blocked/.test(x.text)),
  'zipper.0': (a) => a.some((x) => x.kind === 'tag' && /Stand-off|Forces its way in|Slams the brakes/.test(x.text)),
  'zipper.1': (a) => a.filter((x) => x.kind === 'badge').length >= 4,
  'box.0': (a) => a.some((x) => x.kind === 'tag' && /Stuck in the box/.test(x.text)),
  'box.1': (a) => a.some((x) => x.kind === 'tag' && /Waits/.test(x.text)),
  'lanes.0': (a) => a.some((x) => x.kind === 'bracket' && /Stop-and-go wave/.test(x.text)),
  'lanes.1': (a) => a.some((x) => x.kind === 'tag' && /No waves/.test(x.text)),
  'freeleft.0': (a) => a.some((x) => x.kind === 'tag' && /Turns left on red/.test(x.text)),
  'bay.0': (a) => a.some((x) => x.kind === 'tag' && /pulled into the bay|Let back in/.test(x.text)),
  'zebra.0': (a) => a.some((x) => x.kind === 'tag' && /Walks on the walk signal|Stops behind the line/.test(x.text)),
  'payoff.0': (a) => a.filter((x) => x.kind === 'tag' && /Box clear/.test(x.text)).length >= 3,
};
const override: Record<string, [number, number]> = {};
for (const arg of process.argv.slice(2)) {
  const [id, v] = arg.split('=');
  const [s, w] = v.split(':').map(Number);
  override[id] = [s, w];
}

const FPS = 30;
const live = new Map<string, { a: Built; b: Built; acc: number }>();
const only = Object.keys(override);
for (const sc of SCENES) {
  if (only.length && !only.includes(sc.id)) continue;
  const def = byId(sc.scenario);
  const [seed, warmup] = override[sc.id] ?? [sc.seed, sc.warmup];
  const key = `${sc.scenario}:${seed}:${warmup}`;
  let w = live.get(key);
  if (!w) {
    const a = def.build(seed, 0);
    const b = def.build(seed, 1);
    a.world.run(warmup);
    b.world.run(warmup);
    w = { a, b, acc: 0 };
    live.set(key, w);
  }
  sc.shots.forEach((sh: Shot, j) => {
    const need = NEED[`${sc.id}.${j}`];
    let ok = 0;
    let firstOk = -1;
    let early = 0;
    const frames = Math.round(sh.dur * FPS);
    const texts = new Set<string>();
    for (let f = 0; f < frames; f++) {
      w!.acc += (1 / FPS) * def.speed * sh.speed;
      while (w!.acc >= w!.a.world.dt) {
        w!.a.world.step();
        w!.b.world.step();
        w!.acc -= w!.a.world.dt;
      }
      const annos = (sh.world === 'a' ? w!.a : w!.b).annotate!(sh.anno);
      for (const x of annos) if (x.kind === 'tag' || x.kind === 'bracket') texts.add(x.text.replace(/\d+(:\d+)?/g, 'N'));
      if (need(annos)) {
        ok++;
        if (firstOk < 0) firstOk = f / FPS;
        if (f < FPS * 1.5) early++;
      }
    }
    console.log(
      `${`${sc.id}.${j}`.padEnd(11)} seed ${String(seed).padEnd(3)} on screen ${String(Math.round((ok / frames) * 100)).padStart(3)}% of ${sh.dur}s, first at ${firstOk < 0 ? '—' : firstOk.toFixed(1) + 's'}, first 1.5s ${Math.round((early / Math.min(frames, FPS * 1.5)) * 100)}% | ${[...texts].slice(0, 5).join(' · ')}`,
    );
  });
}
