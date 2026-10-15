import { Logo } from './Sections.tsx';
import { External } from './icons.tsx';
import { BLR_MIX } from '../sim/core/types.ts';

const SOURCES: [string, string][] = [
  [
    'TomTom Traffic Index 2025: headline numbers (Jan 2026)',
    'https://www.tomtom.com/newsroom/explainers-and-insights/tomtom-traffic-index-2026-headline-numbers/',
  ],
  [
    'Deccan Chronicle: Bengaluru named world’s second most congested city in 2025',
    'https://deccanchronicle.com/nation/bengaluru-named-worlds-second-most-congested-city-in-2025-1931959',
  ],
  ['Bengaluru traffic violations data (BTP), OpenCity', 'https://data.opencity.in/dataset/bengaluru-traffic-violations-data'],
  ['MoRTH, Road Accidents in India 2024, OpenCity', 'https://data.opencity.in/dataset/road-accidents-in-india-2024'],
  [
    'The News Minute: Bengaluru traffic jams cost ₹20,000 crore annually',
    'https://www.thenewsminute.com/karnataka/bengalurus-traffic-jams-cost-rs-20000-crore-annually-study-180727',
  ],
  [
    'Outlook Business: 1.28 crore vehicles, inside Bengaluru’s mobility challenge',
    'https://www.outlookbusiness.com/economy-and-policy/128-mn-vehicles-1-metro-network-inside-bengalurus-mobility-challenge',
  ],
  ['Minnesota DOT: Late merge, the zipper system', 'https://www.dot.state.mn.us/trafficeng/workzone/doc/When-latemerge-zipper.pdf'],
  ['Sugiyama et al. (2008): Traffic jams without bottlenecks', 'https://ir.library.osaka-u.ac.jp/repo/ouka/all/93262/NewJPhys_10_033001.pdf'],
  ['Stern et al. (2018): Dissipation of stop-and-go waves via control of autonomous vehicles', 'https://arxiv.org/abs/1705.01693'],
  [
    'Transport for London (2007): Effective enforcement keeps the capital’s roads moving',
    'https://tfl.gov.uk/info-for/media/press-releases/2007/september/effective-enforcement-by-transport-for-london-keeps-the-capitals-roads-moving',
  ],
  [
    'Bansal, Agrawal & Tiwari (2014): Impacts of bus stops on the speed of motorised vehicles, Delhi',
    'https://doaj.org/article/72f1f8593c77402382f75f159cf762b1',
  ],
  ['Treiber, Hennecke & Helbing (2000): The Intelligent Driver Model', 'https://traffic-simulation.de/info/info_IDM.html'],
  ['Kesting, Treiber & Helbing (2007): MOBIL lane-change model', 'https://mtreiber.de/publications/MOBIL_TRB.pdf'],
];

// Bengaluru-like traffic mix used in every simulation (src/sim/core/types.ts, BLR_MIX)
const MIX = [
  { label: 'Two-wheelers', share: BLR_MIX.bike ?? 0, color: '#2f6fed' },
  { label: 'Cars & cabs', share: (BLR_MIX.car ?? 0) + (BLR_MIX.cab ?? 0), color: '#ff8a1f' },
  { label: 'Autos', share: BLR_MIX.auto ?? 0, color: '#1f8a4c' },
  { label: 'Buses & trucks', share: (BLR_MIX.bus ?? 0) + (BLR_MIX.truck ?? 0), color: '#9aa3b1' },
];

export function Method() {
  return (
    <section id="method" className="relative border-t hairline py-20 md:py-24" aria-labelledby="method-title">
      <div className="mx-auto max-w-[1500px] px-4 md:px-8">
        <div className="eyebrow">How it works</div>
        <h2 id="method-title" className="serif mt-3 text-[2.4rem] leading-[1.05] md:text-[3.2rem]">
          Not an animation. A model you can poke.
        </h2>
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          <HowCard n="1" title="Every vehicle drives itself" text="Each one speeds up, brakes and changes lanes on its own, using standard traffic models.">
            <div className="flex h-3 overflow-hidden rounded-full">
              {MIX.map((p) => (
                <span key={p.label} style={{ width: `${p.share * 100}%`, background: p.color }} />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--color-ink-2)]">
              {MIX.map((p) => (
                <span key={p.label} className="flex items-center gap-1.5">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {p.label} <span className="num text-[var(--color-ink-3)]">{Math.round(p.share * 100)}%</span>
                </span>
              ))}
            </div>
          </HowCard>
          <HowCard n="2" title="The same traffic, twice" text="Both roads get the same vehicles at the same moments. Only the behaviour changes.">
            <TwinRoads />
          </HowCard>
          <HowCard
            n="3"
            title="Checked against real roads"
            text="Illustrative, not a forecast. The direction and rough size of each effect match field studies."
          >
            <div className="flex flex-wrap gap-1.5">
              {['United States', 'United Kingdom', 'Japan', 'India'].map((c) => (
                <span key={c} className="rounded-full border border-[var(--chip-border)] px-2.5 py-1 text-[12px] text-[var(--color-ink-2)]">
                  {c}
                </span>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-[var(--color-ink-3)]">Where the studies behind the chapters were done</div>
          </HowCard>
        </div>

        <div className="mt-12 eyebrow">Sources</div>
        <ul className="mt-3 grid text-sm md:grid-cols-2 md:gap-x-10">
          {SOURCES.map(([t, h]) => (
            <li key={h} className="border-b hairline">
              <a
                href={h}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-4 py-2.5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
              >
                <span>{t}</span>
                <External size={13} className="mt-1 shrink-0" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowCard({ n, title, text, children }: { n: string; title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="card flex flex-col rounded-3xl p-6">
      <span className="num text-sm text-[var(--brand-ink)]">0{n}</span>
      <h3 className="mt-3 text-[1.25rem] font-semibold leading-tight tracking-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-snug text-[var(--color-ink-2)]">{text}</p>
      <div className="mt-auto pt-6">{children}</div>
    </div>
  );
}

/** Two copies of one road: identical vehicles, bunched today and evenly spread when everyone adjusts. */
function TwinRoads() {
  const colors = ['#2f6fed', '#ff8a1f', '#2f6fed', '#1f8a4c', '#2f6fed', '#9aa3b1', '#ff8a1f', '#2f6fed', '#2f6fed', '#1f8a4c'];
  const bunched = [4, 9, 13, 16, 19, 22, 25, 58, 74, 90];
  const even = colors.map((_, i) => 6 + i * 9.4);
  const row = (xs: number[], label: string, tone: string) => (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: tone }}>
        {label}
      </span>
      <svg viewBox="0 0 100 10" className="h-5 w-full" preserveAspectRatio="none" aria-hidden>
        <rect x="0" y="2" width="100" height="6" rx="3" style={{ fill: 'var(--track)' }} />
        {xs.map((x, i) => (
          <rect key={i} x={x} y="3" width="3.2" height="4" rx="1" style={{ fill: colors[i] }} />
        ))}
      </svg>
    </div>
  );
  return (
    <div className="space-y-1.5">
      {row(bunched, 'Today', 'var(--selfish)')}
      {row(even, 'Adjusted', 'var(--civic)')}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t hairline py-16">
      <div className="mx-auto flex max-w-[1500px] flex-col gap-10 px-4 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Logo size={34} />
            <div>
              <div className="text-lg font-semibold">
                Swalpa<span className="text-[var(--brand-ink)]">Adjust</span>
              </div>
              <div className="kn text-sm text-[var(--color-ink-3)]">ಸ್ವಲ್ಪ ಅಡ್ಜಸ್ಟ್ ಮಾಡಿ</div>
            </div>
          </div>
          <p className="serif mt-8 max-w-[640px] text-4xl leading-tight md:text-5xl">
            A few seconds of patience. <span className="text-[var(--color-ink-3)]">A city in motion.</span>
          </p>
        </div>
        <p className="max-w-[420px] text-xs leading-relaxed text-[var(--color-ink-3)]">
          An independent civic-sense project for Namma Bengaluru. Not affiliated with Bengaluru Traffic Police or any government body. Simulations are
          illustrative; statistics are cited at the point of use.
        </p>
      </div>
    </footer>
  );
}
