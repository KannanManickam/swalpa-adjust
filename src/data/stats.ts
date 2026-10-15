// Headline numbers, each with a small picture. Sources and caveats: docs/RESEARCH-bengaluru.md

export type Viz =
  /** horizontal bars; the highlighted row is Bengaluru or the problem */
  | { kind: 'bars'; rows: { label: string; value: number; text: string; hi?: boolean }[]; note?: string }
  /** a week of days, all lost */
  | { kind: 'days'; note: string }
  /** a row of people, some highlighted */
  | { kind: 'people'; total: number; hi: number; note: string }
  /** one bar split into shares */
  | { kind: 'split'; parts: { label: string; share: number; color: string }[] };

export interface Stat {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
  source: string;
  href: string;
  viz: Viz;
}

export const STATS: Stat[] = [
  {
    value: 2,
    prefix: '#',
    label: 'most congested city in the world',
    source: 'TomTom Traffic Index 2025',
    href: 'https://www.tomtom.com/newsroom/explainers-and-insights/tomtom-traffic-index-2026-headline-numbers/',
    viz: {
      kind: 'bars',
      note: 'Congestion level, 2025',
      rows: [
        { label: 'Mexico City', value: 75.9, text: '75.9%' },
        { label: 'Bengaluru', value: 74.4, text: '74.4%', hi: true },
        { label: 'New Delhi', value: 60.2, text: '60.2%' },
        { label: 'Kolkata', value: 58.9, text: '58.9%' },
      ],
    },
  },
  {
    value: 36,
    suffix: ' min',
    label: 'to drive 10 km at rush hour',
    source: 'TomTom 2025 via Deccan Chronicle',
    href: 'https://deccanchronicle.com/nation/bengaluru-named-worlds-second-most-congested-city-in-2025-1931959',
    viz: {
      kind: 'bars',
      rows: [
        { label: 'Rush hour', value: 36.2, text: '36 min', hi: true },
        { label: 'Empty road', value: 20.7, text: '21 min' },
      ],
    },
  },
  {
    value: 7,
    suffix: ' days',
    label: 'a year, per driver, stuck in rush hour',
    source: 'TomTom Traffic Index 2025',
    href: 'https://deccanchronicle.com/nation/bengaluru-named-worlds-second-most-congested-city-in-2025-1931959',
    viz: { kind: 'days', note: '168 hours: a full week, every year' },
  },
  {
    value: 1.3,
    decimals: 1,
    suffix: ' crore',
    label: 'vehicles, and over 2,000 more every day',
    source: 'Karnataka Transport Dept via Auto Punditz, Aug 2026',
    href: 'https://www.autopunditz.com/post/bengaluru-ev-registrations-august-2026-karnataka',
    viz: {
      kind: 'split',
      parts: [
        { label: 'Two-wheelers', share: 68, color: '#2f6fed' },
        { label: 'Cars', share: 20, color: '#ff8a1f' },
        { label: 'Others', share: 12, color: '#9aa3b1' },
      ],
    },
  },
  {
    value: 900,
    prefix: '≈',
    label: 'vehicles for every km of road',
    source: 'Outlook Business, Jul 2026',
    href: 'https://www.outlookbusiness.com/economy-and-policy/128-mn-vehicles-1-metro-network-inside-bengalurus-mobility-challenge',
    viz: {
      kind: 'bars',
      rows: [
        { label: 'Bengaluru', value: 900, text: '900', hi: true },
        { label: 'Delhi', value: 480, text: '480' },
      ],
    },
  },
  {
    value: 1,
    suffix: ' in 4',
    label: 'people killed on our roads was walking',
    source: 'MoRTH, Road Accidents in India 2024',
    href: 'https://data.opencity.in/dataset/road-accidents-in-india-2024',
    viz: { kind: 'people', total: 4, hi: 1, note: '246 of 894 deaths in 2024' },
  },
];
