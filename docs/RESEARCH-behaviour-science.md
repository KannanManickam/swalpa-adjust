# Traffic science behind civic-sense driving: evidence brief for Bengaluru

**How to read the tags.** [verified] means I read the number in the primary text or the official dataset. [secondary] means it comes from a summary or press report of the source. [derived] means it is my own calculation. Uncertain items are flagged where they appear.

**Bengaluru in numbers**
- **Vehicles:** about 1.28 crore registered vehicles, of which about 87 lakh (~68%) are two-wheelers, as of 30 Jun 2026 [secondary]. Source: Outlook Business, 2026, https://www.outlookbusiness.com/economy-and-policy/128-mn-vehicles-1-metro-network-inside-bengalurus-mobility-challenge
- **Congestion:** TomTom Traffic Index 2025 ranks Bengaluru the world's #2 most congested city, with a 74.4% congestion level and about 36 min 9 s per 10 km [secondary]. Sources: Down To Earth, 2026, https://www.downtoearth.org.in/amp/story/urbanisation/bengaluru-kolkata-among-worlds-slowest-cities-as-india-ranks-high-on-congestion-index ; Deccan Chronicle, 2026, https://deccanchronicle.com/nation/bengaluru-named-worlds-second-most-congested-city-in-2025-1931959
- **Deaths (2024):** 894 road deaths in Bengaluru. Of these, 246 were pedestrians (27.5%) and 467 were two-wheeler users (52%) [verified]. Source: MoRTH, *Road Accidents in India 2024*, city tables, via OpenCity (2026): https://data.opencity.in/dataset/road-accidents-in-india-2024

---

## 1. Zipper (late) merge and the capacity drop

**(a) Mechanism**
- Merging early leaves one lane empty, so the queue gets about twice as long.
- Drivers who refuse to let others in, and nose-in standoffs, briefly stop flow at the merge point.
- Each forced or abrupt merge makes the driver behind brake. Once a queue forms, the bottleneck then discharges fewer vehicles than its true capacity. This is the "capacity drop."

**(b) Evidence**
- **MnDOT (2008):**
  - Backup length fell "by up to 50% (40% is common)."
  - Speed differential between lanes was lower and road rage was reduced.
  - **Caveat:** travel time through the work zone was "approximately the same."
  - Source: MnDOT, *Late Merge… the Zipper System*, 2008, https://www.dot.state.mn.us/trafficeng/workzone/doc/When-latemerge-zipper.pdf . MnDOT's current page says "as much as 40 percent": https://dot.state.mn.us/zippermerge/
- **PennDOT and University of Nebraska–Lincoln late-merge studies:**
  - Capacity up by as much as 15% (PennDOT).
  - UNL field study: about 75% fewer forced merges, 30% fewer lane straddles, and capacity nearly 20% higher than a conventional merge.
  - UNL observed no conflicts with the late merge below 25 vehicles per mile.
  - Source: CDOT, *Late Merge Work Zone Traffic Control Strategy*, 2015 (summarising McCoy, Pesti & Byrd 1999), https://www.codot.gov/safety/traffic-safety/assets/work-zones/work-zone-traffic-operations-strategies/travel-demand-management/late-merge-work-zone-traffic-control-strategy/LateMergeWorkZoneTrafficControlStrategyOverview.pdf
- **Virginia (Beacher, Fontaine & Garber, VTRC 05-R6, 2004):**
  - Simulation showed a significant throughput gain only for 3-to-1 lane closures.
  - The 2-to-1 field gain was not statistically significant.
  - This is a counterweight to the positive findings. Source: https://vtrc.virginia.gov/reports/all-reports/05-r6/
- **Kansas DOT (Senate testimony, 2022):**
  - Uses a zipper merge only for 2→1 merges, projects of at least 4 weeks, at least 1,500 vehicles/lane/h for ≥6 h (dynamic) or ≥9 h (static), and ≤5% heavy vehicles.
  - Only one true deployment so far (US-69, 2016).
  - Source: https://kslegislature.gov/li_2022/b2021_22/committees/ctte_s_trnsprt_1/documents/testimony/20220127_04.pdf
- **Germany:**
  - The zipper rule is in StVO §7(4) and has been law since 2001. Drivers alternate "immediately before" the narrowing.
  - A fine of about €20 for obstructing it is reported by bussgeldkatalog.net. Uncertain: other sites dispute it.
  - Source: ACE, https://www.ace.de/verkehrssicherheit/tipps-sicheres-fahren/reissverschlussverfahren/
- **Washington DOT:** I found no quantitative WSDOT study.
- **Capacity drop:**
  - About 10% at a San Diego merge (9,600 → 8,700 veh/h). It coincided with a sharp surge in lane changes, and ramp metering that curbed lane changes restored the outflow [verified]. Source: Cassidy & Rudjanakanoknad, PATH UCB-ITS-PRR-2005-28, 2005, https://escholarship.org/uc/item/9qn968pb
  - 3–18% at three bottlenecks [secondary]. Source: Chung, Rudjanakanoknad & Cassidy, *TR-B* 41(1), 2007, https://ideas.repec.org/a/eee/transb/v41y2007i1p82-95.html
  - A typical 5–15% range is reported in reviews [secondary].

**(c) Takeaway:** In slow traffic, use both lanes up to the merge point and then take turns. Letting one car in keeps the whole line moving.

## 2. Don't block the box (yellow box junctions and gridlock)

**(a) Mechanism**
- A car that stops inside a junction blocks cross-traffic during that traffic's green, so the cross street's queue spills back into the next junction upstream.
- In a grid, these spillbacks can close into a loop where no one can move: gridlock.
- At network scale, outflow rises with the number of vehicles until a critical accumulation, then falls. Source: Daganzo, *TR-B* 41(1):49–62, 2007, https://ideas.repec.org/a/eee/transb/v41y2007i1p49-62.html
- Once a queue spills back onto other links, delay grows even faster than the square of the blockage duration [verified]. Source: Knoop, Hoogendoorn & van Zuylen, TRB 2010, paper 10-1107, https://repository.tudelft.nl/file/File_dc28ac66-8e72-48ae-bc2a-eef56ebc614d

**(b) Evidence**
- **London (TfL, 2007):**
  - Rule-breaking at yellow box junctions fell 35% under CCTV enforcement.
  - In the June 2004 pilot of moving-traffic enforcement, traffic flow increased at 73% of enforced sites and casualties fell 19.4%. The pilot's exact offence scope is not stated; the notes list yellow boxes and banned turns among moving-vehicle offences.
  - Source: https://tfl.gov.uk/info-for/media/press-releases/2007/september/effective-enforcement-by-transport-for-london-keeps-the-capitals-roads-moving
- **London (TfL, 2018):** 123,071 penalty notices for yellow-box stops in 2017/18. Source: https://www.tfl.gov.uk/info-for/media/press-releases/2018/november/stopping-in-yellow-boxes-could-delay-emergency-responses
- **NYC:**
  - In 2008 the fine rose from $50 to $115, and the offence was reclassified so that about 2,800 traffic agents could issue tickets. Source: Streetsblog, 2008, https://nyc.streetsblog.org/2008/06/23/dont-block-the-box-bill-clears-albany
  - Enhanced enforcement at 50 key intersections in 2018. Source: NBC NY, https://www.nbcnewyork.com/news/local/dont-block-the-box-coming-back-to-50-key-nyc-intersections/1799044/?amp=1
  - I found no published effect on travel speed.
- **Bengaluru:**
  - Criss-cross yellow boxes at about 10 "zero-tolerance" junctions, including Trinity Circle, Sony World and Cubbon Road.
  - Fines of ₹500 for two-wheelers and ₹700 for four-wheelers, enforced with red-light violation cameras. Uncertain: the article is undated, likely from the 2010s. Source: Deccan Herald, https://www.deccanherald.com/content/191833/right-move.html
- **Gap:** I found no Indian before/after evaluation of box junctions (Bengaluru, Mumbai, Delhi or Pune). Indonesian studies are mixed and mostly measure compliance.

**(c) Takeaway:** Don't enter a junction unless your exit is clear. Waiting 5 seconds at the line is better than locking up four roads.

## 3. Blocked free-left turns

**(a) Mechanism**
- A "free left" lets left-turners in left-hand traffic go continuously, even when the signal is red.
- A car or two-wheeler waiting at the stop line in the left lane turns that continuous flow into signal-controlled flow.
- Left-turners then queue behind it, spill into the through lanes, and use up the through green.

**(b) Evidence**
- **Simulation (IIT Madras):** in Indian heterogeneous traffic, left-turn channelisation cut waiting times at high volumes [secondary]. Source: Gowri & Sivanandan, *Transport*, 2008, https://aviation.vgtu.lt/index.php/Transport/article/download/6666/5762
- **Hyderabad enforcement:**
  - 1,015 free-left obstruction cases in one week (12–18 Aug 2026). Source: Telangana Today, 2026, https://telanganatoday.com/hyderabad-traffic-police-book-1349-cases-in-week-long-drive
  - Fine of up to ₹1,000 under the Hyderabad City Police Act, s.39(b). The article's year is unclear. Source: TNM, https://www.thenewsminute.com/article/hyderabad-police-fine-traffic-violators-two-special-drives-oct-3-168466
- **Bengaluru:** the police clarified that a left turn is free only where it is signed. Source: Deccan Herald, https://www.deccanherald.com/india/karnataka/bengaluru/dh-impact-no-free-left-signboard-reinstalled-at-siddalingaiah-circle-1006956.html
- **Gap:** I found no Bengaluru capacity study or Bengaluru Traffic Police data on free-left blocking.

**(c) Takeaway:** If you're going straight, keep out of the free-left lane. One parked bumper there can hold up a whole lane of turning traffic.

## 4. Lane discipline, lane hopping, tailgating and phantom jams

**(a) Mechanism**
- At high density, small speed fluctuations grow into backward-moving stop-and-go waves.
- Lane changes into short gaps trigger and amplify these waves.
- Short following gaps leave no buffer to absorb them.

**(b) Evidence**
- **Sugiyama et al. (2008):**
  - 22 cars on a 230 m circle, asked to cruise at about 30 km/h.
  - A jam formed with no bottleneck at all. It moved backward at about 20 km/h, and cars outside it moved at about 40 km/h.
  - The paper cites a critical density of about 25 veh/km [verified].
  - Source: *New Journal of Physics* 10:033001, 2008, https://ir.library.osaka-u.ac.jp/repo/ouka/all/93262/NewJPhys_10_033001.pdf
- **Stern et al. (2018):** 260 m ring with 21–22 vehicles. One wave-dampening car (Experiment A) produced these results [verified from the arXiv preprint; the published version may differ slightly]:

  | Metric | Change |
  |---|---|
  | Speed standard deviation | −80.8% |
  | Fuel use | −42.5% |
  | Excessive braking events | 8.58 → 0.12 per vehicle-km |
  | Throughput | +14.1% |

  - In Experiment C, the onset of a wave raised fuel use by 63.8% and cut throughput by 18.8%.
  - Source: *Transportation Research Part C* 89:205–221, 2018, https://arxiv.org/abs/1705.01693
- **Ahn & Cassidy (2007):** freeway oscillations started in individual lanes when drivers squeezed in from neighbouring lanes, and lane changes made them grow [secondary]. Source: https://its.berkeley.edu/publications/freeway-traffic-oscillations-observations-and-predictions
- **Lane changes and capacity drop:** the about-10% drop above coincided with a lane-change surge. Source: Cassidy 2005, above.
- **Tailgating in India:** "hit from back" was the largest collision type in 2024: 113,907 crashes (23.4%) and 37,404 deaths (21.1%) [verified]. Source: MoRTH RAI 2024, https://data.opencity.in/dataset/road-accidents-in-india-2024
- **Two-second rule:** the UK Highway Code (rule 126) advises "at least a two-second gap": https://www.gov.uk/guidance/the-highway-code/general-rules-techniques-and-advice-for-all-drivers-and-riders-103-to-158

**(c) Takeaway:** Stay in your lane, keep a gap and drive smoothly. You'll absorb the jam instead of passing it on.

## 5. Buses and autos stopping in the carriageway

**(a) Mechanism**
- A vehicle stopped in a lane removes that lane.
- Vehicles merging around it brake and swerve, which also lowers flow in the adjacent lanes.

**(b) Evidence**
- **Delhi (Bansal, Agrawal & Tiwari, 2014):** bus stops affect a zone of 140–170 m. Within it, the average speed of other motor vehicles drops by 26–38% of free-flow speed [verified from abstract]. Source: *IJTST* 3(2):167–178, 2014, https://doaj.org/article/72f1f8593c77402382f75f159cf762b1
- **Dutch motorways (Knoop, Hoogendoorn & Adams, 2009, 90 incidents):**
  - With one lane blocked, the discharge rate of each remaining lane fell by 50%.
  - With an incident on the shoulder only, discharge fell 30%.
  - Treat this as an analogy for a stopped bus or auto. Source: *EJTIR* 9(4), 2009, https://journals.open.tudelft.nl/ejtir/article/view/3318
- **Curbside-stop capacity loss:** depends on bus frequency, dwell time and the road width lost. The Indo-HCM 2017 method overestimates the loss. Source: Pallela & Mehar, *IATSS Research*, 2024, https://doaj.org/article/83120e38c2774ddd9f4b28d69772a972
- **Reported range:** about 6% to over 50% capacity loss. Uncertain: secondary sources with mixed methods; I could not verify the frequently quoted Delhi figure of "6.6–28.3% for 20–120 buses/h."
- **Delhi causes of improper stopping:** passengers waiting on the roadway, and autos standing in the curb lane [secondary]. Source: Springer, 2017, https://link.springer.com/doi/10.1007/s40890-017-0033-1

**(c) Takeaway:** Pull fully into the bay or kerb. A bus or auto stopped mid-lane slows everything for the next 150 m.

## 6. Wrong-side driving

**(a) Mechanism**
- Oncoming vehicles must brake or swerve, which causes the same wave-triggering disturbances as a cut-in.
- Crashes are usually head-on, so they are severe.

**(b) Evidence**
- **India 2024:**
  - "Driving on wrong side/lane indiscipline" caused 22,530 crashes and **8,327 deaths (4.7%)**. That is second only to over-speeding (124,522 deaths, 70.3%).
  - In 2023 the figure was 9,432 deaths (5.46%) [verified].
  - Source: MoRTH RAI 2024 violation table, https://data.opencity.in/dataset/road-accidents-in-india-2024
- **Head-on collisions, India 2024:** 28,400 deaths (16.0%) [verified]. Source: same.
- **Bengaluru 2024:** only 15 deaths were attributed to wrong-side driving, against 776 attributed to over-speeding. This is likely an attribution artefact. Source: same, city table.
- **Bengaluru enforcement:** about 6,872 criminal-code cases for rash or negligent driving and wrong-direction driving in 2025, up 82% from 3,774 [secondary]. Source: Deccan Herald, 2026, https://www.deccanherald.com/amp/story/india%2Fkarnataka%2Fbengaluru%2Frash-negligent-driving-cases-surge-82-in-bengaluru-in-2025-3862437
- **US divided highways:** wrong-way crashes are 3.7% of fatal crashes (2010–18) [secondary]. Source: AAA Foundation, https://newsroom.aaa.com/2021/03/heading-the-wrong-way-with-wrong-way-driving/

**(c) Takeaway:** The "short-cut" against traffic is how 8,000+ Indians died in one year. The U-turn is worth the 200 m.

## 7. Red-light running and amber behaviour

**(a) Mechanism**
- A late entrant occupies the conflict zone at the start of the next phase. This eats that phase's green and causes box blocking.
- Jumping the start of green raises the risk of crashes into late runners.

**(b) Evidence**
- **US (IIHS):**
  - 1,119 people were killed in red-light-running crashes in 2024; about half were not the runner.
  - Cameras cut the fatal red-light-running crash rate by 21%, and all fatal crashes at signalised intersections by 14%, in large cities (Hu & Cicchino, 2017).
  - In Philadelphia, adding about 1 s of yellow cut violations by 36%, and cameras cut them by a further 96%.
  - Source: IIHS, https://www.iihs.org/topics/red-light-running
- **Chennai (Sharma, Vanajakshi et al., 2012):**
  - With countdown timers, start-up lost time fell, but the share of cycles with violations at the start of green rose from 12% to 75%.
  - At the end of green, violations fell from 59% to 31%.
  - Source: *J. Transp. Eng.* 138(4):467–478, 2012, https://ascelibrary.com/doi/10.1061/%28ASCE%29TE.1943-5436.0000343
- **India 2024:** jumping a red light caused 1,559 crashes and 528 deaths (0.3%). This is likely under-attributed. Source: MoRTH RAI 2024.
- **Gap:** I found no direct field study quantifying how red-light running affects clearance or lost time.

**(c) Takeaway:** Amber means prepare to stop, not speed up. And don't creep before green.

## 8. Pedestrians and zebra crossings

- **India 2024:** 36,526 pedestrians killed, 20.6% of 177,175 deaths. Two-wheeler users were 46.2% [verified]. Source: MoRTH RAI 2024.
- **Bengaluru:**
  - 2024: 246 of 894 deaths were pedestrians [verified]. Source: MoRTH city table.
  - Jan–Jun 2026: 136 pedestrians killed [secondary]. Source: Siasat, https://www.siasat.com/136-pedestrians-killed-664-hurt-between-jan-june-in-bengaluru-3503287/
- **Yielding (Milwaukee):**
  - Drivers yielded at only 16% of 364 crossing opportunities.
  - Intersections with no pedestrian crashes in the previous five years had higher yield rates. This is a correlation.
  - Source: TRR, 2018, https://sites.uwm.edu/s2-lab/files/2019/11/0361198118782251.pdf
- **Speed (WHO):**
  - A pedestrian hit at 65 km/h is 4.5× more likely to die than one hit at 50 km/h.
  - About 90% survive at ≤30 km/h.
  - Source: WHO, https://www.who.int/news/item/05-12-2023-new-who-manual-aims-to-curb-dangerous-speeding-on-the-world-s-roads
- **Gap:** I found no peer-reviewed Indian driver-yield rate.

**Takeaway:** Stop before the zebra crossing, not on it. One in four people killed on Bengaluru's roads is walking.

## 9. Start-up lost time, saturation flow and "a few seconds of patience"

**Standard values**
- Start-up lost time is "commonly assumed to be approximately 2 seconds."
- Ideal saturation flow is 1,900 pc/h/ln (about 1.9 s headway), with a typical range of 1,500–2,000.
- The HCM default total lost time is 4 s per phase.
- Source: FHWA *Traffic Signal Timing Manual*, 2008, https://ops.fhwa.dot.gov/publications/fhwahop08024/chapter3.htm

**India (mixed traffic)**
- IRC:SP:41-1994: saturation flow S = 525·W PCU/h, where W ≥ 5.5 m is approach width [secondary]. Source: NPTEL, https://archive.nptel.ac.in/content/storage2/courses/105104098/TransportationII/lecture8/text/node8.html
- Indo-HCM 2017: 630 PCU/h per metre of width for widths under 7 m [secondary]. Source: WCTR 2019, https://www.wctrs-society.com/wp-content/uploads/abstracts/mumbai/WCTR2019_Mumbai_263.pdf
- Ahmedabad field measurements: 933W–1,283W [secondary]. Source: IJERT, https://www.ijert.org/saturation-flow-rate-measurement-on-a-four-arm-signalized-intersection-of-ahmedabad-city

**Why a short blockage costs so much**
- Incident delay grows with the **square** of the blockage duration [verified]. Source: Knoop et al., 2010.
- Simple bottleneck-queue model [derived], with demand λ, capacity μ and blockage t: total delay = λ·μ·t² / (2(μ−λ)).
- Worked examples for a lane with capacity 1,800 veh/h:

| Demand / capacity | Blockage | Vehicles delayed | Total delay | Delay per second blocked |
|---|---|---|---|---|
| 67% | 10 s | 10 | 0.8 veh-min | 5× |
| 90% | 10 s | 45 | 3.8 veh-min | 22× |
| 90% | 30 s | 135 | 34 veh-min | 68× |
| 95% | 30 s | 285 | 71 veh-min | 142× |

- These are conservative. The model ignores capacity drop and spillback, and both make delay worse.
- If demand exceeds capacity, every lost second at the bottleneck delays every later vehicle until the peak ends.

**Prompt starts help.** Kesting, Treiber & Helbing (2010) found that halving the time gap (×0.5) and doubling acceleration (×2) when leaving a jam front gives "high dynamic capacity." Source: arXiv:0912.3613, https://arxiv.org/abs/0912.3613

## 10. Honking (optional)

- **Nagpur:** honking added 2–5 dB(A) to traffic noise, with up to 63 horns per 15 minutes. Source: Vijay et al., *JEHSE* 13:10, 2015, https://pmc.ncbi.nlm.nih.gov/articles/PMC4334595/
- **Mumbai "Punishing Signal" trial (2020):** noise above 85 dB reset the red light to 90 s. Source: The Quint, https://www.thequint.com/news/india/mumbai-punishing-signal-video-honking
- **Gap:** I found no study showing that honking improves flow.

---

## Simulation parameters

**IDM: Treiber & Kesting, *Traffic Flow Dynamics*, Table 11.2, corrected in the 2017 errata** [verified]. Source: https://traffic-flow-dynamics.org/res/ErrataTrafficFlowDynamics.pdf

| Parameter | City cars | Freeway cars | Trucks |
|---|---|---|---|
| v0 (desired speed) | 54 km/h | 120 km/h | 80 km/h |
| T (time gap) | 1.0 s | 1.0 s | 1.8 s |
| s0 (minimum gap) | 2 m | 2 m | 3 m |
| δ (exponent) | 4 | 4 | 4 |
| a (max acceleration) | **1.5 m/s²** (the original printing said 1.0) | 1.0 m/s² | 0.5 m/s² |
| b (comfortable deceleration) | 2.0 m/s² | 1.5 m/s² | 1.0 m/s² |

The demo site uses a deliberately low a = 0.3 m/s² to provoke stop-and-go waves. It gives realistic ranges of T from 0.8 to 2 s and a from 0.8 to 2.5 m/s². Source: https://traffic-simulation.de/info/info_IDM.html

**Indian mixed traffic, Chennai arterial** [verified from Table 1]. Source: Kanagaraj & Treiber, *Physica A*, 2018, https://arxiv.org/abs/1805.05076

| Vehicle | v0 | T | s0 | a = b |
|---|---|---|---|---|
| Motorcycle | 18–25 m/s | 0.3 s | 0.5 m | 2.0 m/s² |
| Car | 12–18 m/s | 0.8 s | 2.0 m | 1.0 m/s² |
| Bus | 10–14 m/s | 1.0 s | 2.0 m | 1.0 m/s² |
| Auto | 5–6 m/s (as printed) | 1.0 s | 2.0 m | 1.0 m/s² |

**MOBIL lane-change model**
- Kesting, Treiber & Helbing, TRR 1999, 2007 [verified, Table 1]: politeness p from 0 to 1, threshold Δa_th = 0.1 m/s², b_safe = 4 m/s², keep-right bias Δa_bias = 0.3 m/s². Source: https://mtreiber.de/publications/MOBIL_TRB.pdf
- traffic-simulation.de defaults: realistic p is 0–0.5; p = 0 is selfish; p < 0 is malicious; p > 1 is altruistic; a_th = 0.2 m/s²; b_safe = 4 m/s². Source: https://traffic-simulation.de/info/info_MOBIL.html

**Aggressive vs courteous drivers.** The literature only says this qualitatively: aggressive drivers have lower T and higher v0, a and b; careful drivers have higher T. Source: traffic-simulation.de. The values below are my suggestion, not from the literature [derived]:

| Profile | T | a | b | s0 | p | Δa_th | b_safe |
|---|---|---|---|---|---|---|---|
| Courteous | 1.5–1.8 s | 1.2 m/s² | 1.5 m/s² | 2.5 m | 0.5–1.0 | 0.2 m/s² | 2–3 m/s² |
| Aggressive | 0.6–0.8 s | 2.0 m/s² | 3.0 m/s² | 1.0 m | 0–0.1 (≤0 for "won't let you in") | 0.05 m/s² | 5–6 m/s² |

- For the aggressive profile, also raise v0 by about 20%.

---

## Best 12 one-liners for the public

1. "Use both lanes, then take turns: queues get up to 40–50% shorter." (MnDOT, 2008)
2. "Zipper merging cut forced merges by about 75% and raised capacity by nearly 20%." (UNL study via CDOT, 2015)
3. "No accident, no signal, no pothole: 22 cars on a circle still made a traffic jam." (Sugiyama et al., NJP 2008)
4. "One smooth driver cut braking events from 8.58 to 0.12 per vehicle-km and fuel use by 42%." (Stern et al., TR-C 2018)
5. "Lane-hopping near bottlenecks: when queues formed and lane changes surged, the road carried about 10% fewer vehicles." (Cassidy & Rudjanakanoknad, 2005)
6. "Enforcing yellow boxes and banned turns: traffic flowed better at 73% of London sites, and casualties fell 19.4%." (TfL, 2007)
7. "Blocking for 10 seconds at a busy junction can cost the people behind you about 4 minutes combined." (derived; delay scales with the square of duration, Knoop et al., 2010)
8. "Keep a 2-second gap: rear-end crashes are India's most common collision, killing 37,404 people in 2024." (MoRTH, 2024)
9. "Wrong-side driving killed 8,327 Indians in 2024, more than any violation except speeding." (MoRTH, 2024)
10. "More than 1 in 4 people killed on Bengaluru's roads are walking (246 of 894 in 2024)." (MoRTH, 2024)
11. "A bus stopped mid-lane slows other traffic 26–38% for about 150 m: use the bay." (Bansal et al., 2014)
12. "Half the people killed by red-light runners aren't the runner." (IIHS, 2024 data)

## Gaps to flag
- No quantitative studies found for: Bengaluru free-left capacity, Indian box-junction outcomes, an Indian driver-yield rate, red-light running's effect on clearance time, or honking's effect on flow.
- The MnDOT percentages are agency summaries.
- The Stern figures come from the arXiv preprint.
- The Bengaluru TomTom figures and the 2025 pedestrian counts are from press reports.