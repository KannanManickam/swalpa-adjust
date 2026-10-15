# Swalpa Adjust Maadi: concept and roadmap

## The idea in one line

Bengaluru can't build lanes fast enough, but it can change how we use the lanes we already have overnight. **Show people, with a live simulation of their own roads, that a few seconds of patience saves everyone minutes.**

## Why this framing works

- **"Swalpa adjust maadi"** is already the city's catchphrase for give-and-take. The campaign does not invent a new message; it points an old, beloved one at the road.
- **Show, don't scold.** Civic-sense campaigns usually lecture. Here people see the jam form on one side and dissolve on the other, with the same vehicles and the same road. The only variable is behaviour. People can move a slider and try it for themselves.
- **Self-interest, not sacrifice.** Every chapter ends with "this gets *you* home faster too": zipper merging shortens the queue you are in, and an unblocked box means your own green actually moves.

## The six habits (v1)

| Habit | The rule | Evidence |
|---|---|---|
| Merging at barricades | Use both lanes to the merge point, then take turns | MnDOT: 40–50% shorter backups |
| Blocking the box | Enter only if your exit is clear | TfL: flow improved at 73% of enforced sites |
| Free-left blocking | Going straight? Stay out of the free-left lane | Hyderabad: 1,015 cases in one week |
| Lane hopping and tailgating | Pick a lane, keep ~2 s, ease off early | Sugiyama 2008; Stern 2018 (braking 8.58 → 0.12 /veh-km) |
| Stopping in the lane | Pull fully into the bay; let the bus back out | Delhi: −26–38% speed over 140–170 m |
| Amber and zebra | Stop on amber; the zebra belongs to people | 1 in 4 road deaths in Bengaluru is a pedestrian |

Candidates for v2: wrong-side driving (8,327 deaths in India in 2024), footpath riding, U-turns through broken medians, double parking, and honking.

## Getting it to a bigger audience

**1. Short-form video (fastest reach)**
- Cut the 90-second film into six 12–15 s vertical reels, one per habit. The renderer already produces frame-exact video, so 1080×1920 portrait cut-downs need a layout tweak, not new footage.
- Each reel ends on one rule and the Kannada line. Post in Kannada, English and Hinglish variants.
- Seed with Bengaluru meme and civic pages (r/bangalore, local Instagram creators, ORR commuter groups).

**2. Places people wait**
- Auto-rickshaw back panels and BMTC bus backs: one rule each, plus a QR code to the simulation.
- Screens at big signals and metro stations: loop the film silently. It was designed to read without sound.
- Tech parks on the ORR (Ecospace, Embassy Tech Village, Manyata): lobby screens, internal mailers, "Commute Week".

**3. Partners**
- **Bengaluru Traffic Police**: co-brand the rules, link challan reminders to the relevant chapter, and use ASTraM hotspot data to pick which junctions to feature.
- **GBA / BBMP and BMRCL**: run the "zipper" message at every Namma Metro barricade, as a sign at the taper.
- **Schools and driving schools**: the simulation as a 10-minute classroom module. The sliders make it an experiment, not a lecture.
- **Ride-hailing and delivery platforms**: in-app nudges to riders, who are a large share of two-wheeler traffic.

**4. Make it personal**
- The pledge card already exists (download and share, all made in the browser). Next: a shared counter of pledges per neighbourhood, plus WhatsApp stickers per rule.
- "Your junction": let people pick a real hotspot (Silk Board, Hebbal, Goraguntepalya) and see its specific failure mode simulated.

## Product roadmap (toward an app)

| Phase | What | Notes |
|---|---|---|
| v1 (this) | Web experience, six habits, film, pledge | Static site, no backend; host on any CDN |
| v1.1 | Kannada UI toggle, portrait reels, accessibility pass, audio bed | Copy is centralised in `src/data/` |
| v2 | Real junction geometry from OpenStreetMap for 10 hotspots | The `net.ts` builder already takes roads and junctions; add an OSM importer |
| v2 | Live mode: overlay ASTraM or Google traffic speeds for context | Needs a data partnership or API |
| v3 | Mobile app (React Native or Capacitor wrapper of the same code) | The sim core is framework-free TypeScript |
| v3 | "Driving coach" mode: after a trip, show which habit cost the most | Needs phone sensor heuristics; privacy-first and on-device |

## Measuring whether it works

- Reach: views, completion rate of the film, slider interactions per visit.
- Intent: pledges per week, and shares.
- Behaviour (with BTP): before/after violation counts at the junctions featured in placements, for example yellow-box and free-left obstruction bookings, and queue lengths from ASTraM at a barricade where the zipper sign is installed.
