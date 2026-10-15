# Swalpa Adjust Maadi · ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ

An interactive, simulated look at the six everyday road habits that jam Bengaluru, and how a few seconds of patience unjams it.

Each habit is a live **microsimulation**, told as a guided walkthrough on one large 3D stage: the situation, what goes wrong today, what it costs, the fix, the result, and a result card. Call-outs are pinned to the actual vehicles, and vehicles are coloured to explain what they are doing. Behind the stage run two worlds of the same road: *status quo* (nobody adjusts) and *swalpa adjust* (a share of drivers you choose with a slider). Both get exactly the same vehicles arriving at the same moments. Only behaviour differs, and the numbers update live. Day view by default; the sun/moon button switches to night.

| # | Habit | What the simulation shows |
|---|---|---|
| 01 | **The Zipper:** merging at Namma Metro barricades | nose-to-nose stand-offs vs one-by-one merging at speed |
| 02 | **The Box:** entering a junction you can't exit | four junctions locking into gridlock vs side streets that keep flowing |
| 03 | **Free Left:** straight-goers parked in the free-left lane | left-turners stuck behind a red they never needed |
| 04 | **Lane & Gap:** lane-hopping and tailgating | stop-and-go "phantom jams" vs smooth flow at the same density |
| 05 | **The Bay:** buses and autos stopping in the lane | a running lane deleted vs a proper bus bay |
| 06 | **Red Means Red:** amber-running, zebra-blocking, jaywalking | near misses with pedestrians vs a crossing that works |

Also on the page: a live city grid on the landing screen that switches between *Today* and *Swalpa adjust*, Bengaluru's numbers as small charts (TomTom 2025, transport and traffic-police data), a hotspot map with the longest recorded queues, a "your few seconds" queue calculator, and sources. Off the page for now: the pledge-card generator (`RoadCode.tsx`) and the 90-second film (local only, see below).

## Run it

```bash
npm install
npm run dev          # http://localhost:5178
```

- **Production build:** `npm run build`, which outputs static files in `dist/` that you can host anywhere. `npm run preview` serves that build on port 5179.

## Deploy (Vercel)

Live at **https://swalpa-adjust.vercel.app** (Vercel team "Spark's projects", project `swalpa-adjust`; this folder is linked through `.vercel/`). Page views go to Vercel Web Analytics (`@vercel/analytics` in `src/main.tsx`, cookie-free). When this moves to GitHub, connect the repo to the existing `swalpa-adjust` project so the address and analytics carry over.

The site is fully static. `vercel.json` sets the build (`npm run build`, output `dist/`), and `.vercelignore` keeps the film renders in `video/` (about 150 MB) out of the upload. Node 22.12 or newer.

```bash
npx vercel          # first time: log in and link the project
npx vercel --prod   # publish
```

Or push the folder to GitHub and import it at vercel.com; it detects Vite. `.gitignore` also leaves out `video/`.

## The 90-second film (local only)

The film is the older night-time, two-diorama version and is not part of the deployed site: `?film` does nothing in a normal build.

- **Watch it:** open `http://localhost:5178/?film` with `npm run dev` running.
- **Render it to MP4** (needs Google Chrome and `ffmpeg`): build with the film switched on, serve it, then render.

  ```bash
  npm run build:film && npm run preview   # film-enabled build on port 5179
  npm run film:render                     # writes video/swalpa-adjust-film.mp4 (1080p30)
  ```

## Check the simulations headless

```bash
npm run sim:test                         # every scenario: 0%, 50%, 100% civic
node scripts/simcompare.ts zipper 300 4  # one scenario, averaged over 4 random seeds
node scripts/sharecurve.ts               # every slider position × 10 seeds → src/data/curves.json (~10 min)
node scripts/dev/curvelines.ts           # the measured curves and the line each chapter says about them
```

The "How many of us need to adjust?" chart under each chapter's slider is drawn from `src/data/curves.json`; re-run `scripts/sharecurve.ts` after changing a simulation.

Every call-out in the guided chapters is checked against the simulation it points at:

```bash
node scripts/dev/zipalt.ts               # 01 zipper: merge order really alternates
node scripts/dev/gridverify.ts           # 02 box: stuck vehicles, blocked cross street, gridlock timer
node scripts/dev/flverify.ts             # 03 free left: plugged free lefts, left-turners on red
node scripts/dev/phverify.ts             # 04 lane & gap: cut-ins, the backward-moving wave
node scripts/dev/bbverify.ts             # 05 bay: stops in running lanes vs in the bay
node scripts/dev/zbverify.ts             # 06 zebra: light runners, near misses, jaywalking
node scripts/dev/storyshots.ts <dir> <chapterId> day   # screenshot every step (dev server running)
node scripts/dev/curveshot.ts <dir> 1440 day          # screenshot every chapter's share curve (BASE=dev server URL)
```

## How it's built

```
src/
  sim/                 pure TypeScript traffic model (no DOM; runs in Node too)
    core/world.ts      IDM car-following, MOBIL-style lane changes, signals,
                       junction conflict zones, "don't block the box" rule,
                       zipper merging, nose-in stand-offs, bus dwell, metrics
    core/types.ts      vehicle classes (bike, car, cab, auto, BMTC bus, truck)
                       and the two behaviour profiles (selfish / civic)
    net.ts             road + junction builder (left-hand traffic), decor
    scenarios/*.ts     the six habits + hero scene, each with its metrics
  render/              Three.js renderer: day/night themes, instanced vehicles,
                       camera focus + tracking, call-outs pinned to vehicles
  components/          React UI (nav, hero, chapters, map, calculator; pledge and film kept but off the page)
  data/                cited copy, stats, hotspots and the guided steps (stories.ts)
docs/                  research briefs with sources
scripts/               headless sim tests, screenshots, film renderer
```

Stack: Vite 8 · React 19 · TypeScript 7 · Three.js r186 · Motion · Lenis · Tailwind CSS 4.

## Honesty notes

- The simulations are illustrative models tuned to Bengaluru-like mixed traffic, not predictions for any specific junction. The direction and rough size of each effect is checked against field studies (see `docs/RESEARCH-behaviour-science.md`).
- All statistics are cited at the point of use. Figures marked uncertain in `docs/RESEARCH-bengaluru.md` were left out or worded carefully.
- This is an independent civic-sense project. It is not affiliated with Bengaluru Traffic Police or any government body.
