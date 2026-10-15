// Copy for the six habits. Every number here is sourced in docs/RESEARCH-*.md.

export interface Evidence {
  stat: string;
  text: string;
  source: string;
  href: string;
}

export interface Chapter {
  id: string; // scenario id
  num: string;
  short: string;
  title: string;
  rule: string;
  habit: string;
  fix: string;
  seenAt: string[];
  evidence: Evidence[];
  simNote: string;
  icon: 'zip' | 'box' | 'left' | 'lane' | 'bay' | 'signal';
  /** headline simulation result: nobody adjusts vs everybody adjusts, averaged over 3 seeded 5-minute runs (scripts/simcompare.ts) */
  result: { label: string; today: number; fix: number; unit: string; better: 'lower' | 'higher'; time?: boolean; down?: string; up?: string };
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'zipper',
    num: '01',
    short: 'The Zipper',
    title: 'Merge like a zipper',
    rule: 'Use both lanes to the merge point, then take turns.',
    habit:
      'A lane ends at metro barricades, a flyover ramp or a broken-down bus. Some of us merge early and queue in one lane. The rest race to the barricade and nose in. The through lane closes every gap, and the merge point turns into a shoving match where two vehicles stop nose to nose.',
    fix: 'Stay in your lane right up to the merge point, then go one by one: one from each side. Let one in, then go. Merging at the end, at speed, keeps both lanes moving.',
    seenAt: ['Hebbal: seven lanes once funnelled into two', 'Veerannapalya & Bellandur: Blue Line barricades', 'Silk Board ramps', 'KR Puram bridge'],
    evidence: [
      {
        stat: '40–50%',
        text: 'shorter backups when drivers zipper-merge at the end of a closed lane',
        source: 'Minnesota DOT, 2008',
        href: 'https://www.dot.state.mn.us/trafficeng/workzone/doc/When-latemerge-zipper.pdf',
      },
      {
        stat: '−75%',
        text: 'forced merges, with capacity nearly 20% higher, in a late-merge field study',
        source: 'UNL study via Colorado DOT, 2015',
        href: 'https://www.codot.gov/safety/traffic-safety/assets/work-zones/work-zone-traffic-operations-strategies/travel-demand-management/late-merge-work-zone-traffic-control-strategy/LateMergeWorkZoneTrafficControlStrategyOverview.pdf',
      },
    ],
    simNote: 'Two lanes become one at Namma Metro barricades. Both worlds get the same 33 vehicles a minute. Only the merging changes.',
    icon: 'zip',
    result: { label: 'queue behind the barricade', today: 832, fix: 134, unit: 'm', better: 'lower', down: 'shorter' },
  },
  {
    id: 'gridlock',
    num: '02',
    short: 'The Box',
    title: 'Don’t block the box',
    rule: 'Enter a junction only if your exit is clear.',
    habit:
      'The light is green, so we go, even when the road beyond the junction is already jammed. We end up stranded in the middle of the box. When the cross street gets its green it cannot move, its queue spills back into the next junction, and within minutes four junctions lock each other up.',
    fix: 'Wait behind the line until there is room for your whole vehicle on the other side. Those few seconds keep an entire street moving.',
    seenAt: ['Silk Board', 'Mekhri Circle', 'Majestic & KG Road', 'Trinity Circle: one of ~10 junctions with painted yellow boxes'],
    evidence: [
      {
        stat: '73%',
        text: 'of enforced London sites saw traffic flow improve; casualties fell 19.4%',
        source: 'Transport for London, 2007',
        href: 'https://tfl.gov.uk/info-for/media/press-releases/2007/september/effective-enforcement-by-transport-for-london-keeps-the-capitals-roads-moving',
      },
      {
        stat: 'x²',
        text: 'delay grows with the square of how long a junction stays blocked, and faster once queues spill back',
        source: 'Knoop, Hoogendoorn & van Zuylen, TRB 2010',
        href: 'https://repository.tudelft.nl/file/File_dc28ac66-8e72-48ae-bc2a-eef56ebc614d',
      },
    ],
    simNote: 'Four signalised junctions. The main road is backed up further down; the side streets have plenty of room, unless someone blocks the box.',
    icon: 'box',
    result: { label: 'vehicles getting through', today: 9, fix: 80, unit: '/min', better: 'higher', up: 'more' },
  },
  {
    id: 'freeleft',
    num: '03',
    short: 'Free Left',
    title: 'Keep the free left free',
    rule: 'Going straight? Stay out of the free-left lane.',
    habit:
      'We are going straight, but the left lane looks empty, so we slip in to get ahead and then sit at the stop line waiting for green. Everyone behind us who only wanted to turn left now waits for a signal they never needed.',
    fix: 'Going straight? Use the straight lanes. Turning left? Use the free left: that is what it is for. (A left is free only where it is signed.)',
    seenAt: ['Most signalised junctions with a slip lane', 'Siddalingaiah Circle', 'Goraguntepalya (free left being added)'],
    evidence: [
      {
        stat: '1,015',
        text: 'free-left obstruction cases booked in one week by Hyderabad traffic police',
        source: 'Telangana Today, Aug 2026',
        href: 'https://telanganatoday.com/hyderabad-traffic-police-book-1349-cases-in-week-long-drive',
      },
      {
        stat: 'Lower',
        text: 'waiting times at high volumes with left-turn channelisation in Indian mixed traffic (simulation)',
        source: 'Gowri & Sivanandan, IIT Madras, 2008',
        href: 'https://aviation.vgtu.lt/index.php/Transport/article/download/6666/5762',
      },
    ],
    simNote: 'A busy main road crosses a side street. More than half the traffic turns left. In the status quo, straight-goers squeeze into the kerb lane.',
    icon: 'left',
    result: { label: 'wait to turn left', today: 9.9, fix: 2.3, unit: 's', better: 'lower', down: 'shorter' },
  },
  {
    id: 'phantom',
    num: '04',
    short: 'Lane & Gap',
    title: 'Hold your lane, keep your gap',
    rule: 'Pick a lane, keep ~2 seconds, ease off early.',
    habit:
      'We hop lanes for a one-car advantage and ride bumper to bumper. Every cut-in makes someone brake; the braking ripples backwards and grows into a stop-and-go wave. No accident, no signal, no pothole: just a jam made of reactions.',
    fix: 'Choose a lane and stay in it. Keep a two-second gap. Look past the bumper in front and ease off early, so you absorb the wave instead of passing it on.',
    seenAt: ['Outer Ring Road tech corridor', 'Electronic City elevated expressway', 'Airport Road (lane rule since 2024)'],
    evidence: [
      {
        stat: '22 cars',
        text: 'on a circular track produced a traffic jam with no bottleneck at all',
        source: 'Sugiyama et al., New J. Phys. 2008',
        href: 'https://ir.library.osaka-u.ac.jp/repo/ouka/all/93262/NewJPhys_10_033001.pdf',
      },
      {
        stat: '8.58 → 0.12',
        text: 'braking events per vehicle-km when one smooth driver damped the wave; fuel −42%',
        source: 'Stern et al., Transp. Res. C 2018',
        href: 'https://arxiv.org/abs/1705.01693',
      },
    ],
    simNote: 'A 440 m loop of three-lane road at the same density in both worlds. No signal, no merge, no obstacle.',
    icon: 'lane',
    result: { label: 'speed on the same road', today: 17.6, fix: 27.4, unit: 'km/h', better: 'higher', up: 'faster' },
  },
  {
    id: 'busbay',
    num: '05',
    short: 'The Bay',
    title: 'Stop at the bay, not in the lane',
    rule: 'Pull fully in, and let the bus back out.',
    habit:
      'Buses halt wherever the crowd is standing; autos stop mid-lane for a fare. Each stop deletes a lane and sets off a scramble of lane changes behind it.',
    fix: 'Buses and autos: pull fully into the bay or to the kerb. Everyone else: give the bus a gap to rejoin. It is carrying 40-plus people.',
    seenAt: ['Hebbal: Baptist Hospital stop, where buses block two lanes', 'Goraguntepalya', 'Hope Farm, Whitefield', 'KR Puram ramp'],
    evidence: [
      {
        stat: '26–38%',
        text: 'drop in other vehicles’ speed across the 140–170 m zone around a bus stop',
        source: 'Bansal, Agrawal & Tiwari, Delhi, 2014',
        href: 'https://doaj.org/article/72f1f8593c77402382f75f159cf762b1',
      },
      {
        stat: '8,592',
        text: 'vehicles booked for parking at BMTC bus stops in 2025',
        source: 'Bengaluru Traffic Police via OpenCity',
        href: 'https://data.opencity.in/dataset/bengaluru-traffic-violations-data',
      },
    ],
    simNote: 'A BMTC stop with a proper bay on a three-lane road. Every bus and some autos stop. In the status quo they stop wherever they are.',
    icon: 'bay',
    result: { label: 'speed past the bus stop', today: 25, fix: 38, unit: 'km/h', better: 'higher', up: 'faster' },
  },
  {
    id: 'zebra',
    num: '06',
    short: 'Red Means Red',
    title: 'Stop on amber. Walk on green.',
    rule: 'Amber means stop; the zebra belongs to people.',
    habit:
      'Amber means hurry, the stop line is a suggestion, and the first seconds of red are fair game. People on foot learn the signal cannot be trusted, give up waiting, and dart through gaps, often nowhere near the crossing.',
    fix: 'Stop on amber if you safely can, and stop behind the line, never on the zebra. On foot, cross at the crossing on the walk signal. When both sides keep the deal, everyone moves.',
    seenAt: ['Every pelican crossing near metro stations and schools', 'BTP has asked for 363 new zebras and 45 pelican signals'],
    evidence: [
      {
        stat: '1 in 4',
        text: 'people killed on Bengaluru’s roads was walking (246 of 894 deaths, 2024)',
        source: 'MoRTH, Road Accidents in India 2024',
        href: 'https://data.opencity.in/dataset/road-accidents-in-india-2024',
      },
      {
        stat: '6.6 lakh',
        text: 'signal-jumping cases booked in Bengaluru in 2025',
        source: 'Bengaluru Traffic Police via OpenCity',
        href: 'https://data.opencity.in/dataset/bengaluru-traffic-violations-data',
      },
    ],
    simNote: 'A signal-controlled zebra on a busy two-way road. The same people arrive to cross in both worlds.',
    icon: 'signal',
    result: { label: 'near misses with people walking, in 6 minutes', today: 35, fix: 0, unit: '', better: 'lower', down: 'fewer' },
  },
];
