// One light/dark setting for the whole site: the page, every 3D stage and every chart.
// Day is the default; the choice is remembered in this browser.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemeName } from '../render/theme.ts';

const KEY = 'swalpa-theme';

function stored(): ThemeName {
  try {
    return localStorage.getItem(KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day';
  }
}

const Ctx = createContext<{ theme: ThemeName; setTheme: (t: ThemeName) => void; toggle: () => void }>({
  theme: 'day',
  setTheme: () => {},
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, set] = useState<ThemeName>(stored);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.style.colorScheme = theme === 'day' ? 'light' : 'dark';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'day' ? '#f4f6f9' : '#05070d');
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }, [theme]);
  const toggle = useCallback(() => set((t) => (t === 'day' ? 'night' : 'day')), []);
  return <Ctx.Provider value={{ theme, setTheme: set, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
