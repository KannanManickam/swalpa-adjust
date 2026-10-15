import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 20): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
});

export const Play = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M7 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const Pause = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M8 5v14M16 5v14" strokeWidth={2.6} />
  </svg>
);
export const Restart = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7" />
    <path d="M4 4v4.5h4.5" />
  </svg>
);
export const ArrowDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </svg>
);
export const ArrowRight = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const Film = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="3" />
    <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const Drag = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" strokeWidth={2.2} />
  </svg>
);
export const Download = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
export const Share = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 3v12M7 8l5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
  </svg>
);
export const External = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const Close = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const Menu = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const ChevronDown = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
export const Sun = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.55 1.55M17.15 17.15l1.55 1.55M5.3 18.7l1.55-1.55M17.15 6.85l1.55-1.55" />
  </svg>
);
export const Moon = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M20 14.6A8 8 0 1 1 9.4 4a6.4 6.4 0 0 0 10.6 10.6z" />
  </svg>
);

/** Habit glyphs for the six chapters. */
export function HabitIcon({ kind, size = 28, ...p }: P & { kind: 'zip' | 'box' | 'left' | 'lane' | 'bay' | 'signal' }) {
  const s = { ...base(size), viewBox: '0 0 32 32', strokeWidth: 1.7, ...p };
  switch (kind) {
    case 'zip':
      return (
        <svg {...s}>
          <path d="M6 4v8l10 8M26 4v8L16 20v8" />
          <path d="M11 8h2M19 8h2M13 12h2M17 12h2" strokeWidth={2.4} />
        </svg>
      );
    case 'box':
      return (
        <svg {...s}>
          <rect x="7" y="7" width="18" height="18" rx="1.5" />
          <path d="M7 7l18 18M25 7L7 25M7 16l9-9M16 25l9-9M7 16l9 9M16 7l9 9" strokeWidth={1.1} opacity={0.75} />
        </svg>
      );
    case 'left':
      return (
        <svg {...s}>
          <path d="M20 28V16a6 6 0 0 0-6-6H6" />
          <path d="M10 6L6 10l4 4" />
          <path d="M26 28V4" strokeDasharray="2 3" opacity={0.6} />
        </svg>
      );
    case 'lane':
      return (
        <svg {...s}>
          <path d="M8 4v24M24 4v24" />
          <path d="M16 4v4M16 12v4M16 20v4" strokeWidth={2.2} />
          <rect x="10.5" y="15" width="3.5" height="6" rx="1" fill="currentColor" stroke="none" />
          <rect x="10.5" y="5" width="3.5" height="6" rx="1" fill="currentColor" stroke="none" opacity={0.5} />
        </svg>
      );
    case 'bay':
      return (
        <svg {...s}>
          <path d="M4 26h24M4 10h6l3 4h6l3-4h6" />
          <rect x="11" y="15" width="10" height="7" rx="1.5" />
          <path d="M13 22v2M19 22v2" />
        </svg>
      );
    case 'signal':
      return (
        <svg {...s}>
          <rect x="11" y="3" width="10" height="20" rx="3" />
          <circle cx="16" cy="8" r="2" fill="currentColor" stroke="none" />
          <circle cx="16" cy="13" r="2" opacity={0.5} />
          <circle cx="16" cy="18" r="2" opacity={0.5} />
          <path d="M16 23v6M8 29h16" />
        </svg>
      );
  }
}
