import { lazy, Suspense, useEffect, useState } from 'react';
import Lenis from 'lenis';
import { CHAPTERS } from './data/chapters.ts';
import { Hero } from './components/Hero.tsx';
import { HabitIndex, Nav, Numbers } from './components/Sections.tsx';
import { HotspotMap } from './components/HotspotMap.tsx';
import { StoryChapter } from './components/StoryChapter.tsx';
import { STORIES } from './data/stories.ts';
import { FiveSeconds } from './components/FiveSeconds.tsx';
import { Footer, Method } from './components/Method.tsx';

// The 90-second film is local-only for now: it opens with ?film on the dev server, or in a
// build made with VITE_FILM=1 (see README). It is never part of the deployed site.
const FILM_ENABLED = import.meta.env.DEV || import.meta.env.VITE_FILM === '1';
const Film = FILM_ENABLED ? lazy(() => import('./components/Film.tsx')) : null;
const Teaser = FILM_ENABLED ? lazy(() => import('./teaser/Teaser.tsx')) : null;

export function App() {
  const params = new URLSearchParams(window.location.search);
  const [film, setFilm] = useState(FILM_ENABLED && (params.has('film') || window.location.hash === '#film'));
  const teaser = FILM_ENABLED && params.has('teaser');

  useEffect(() => {
    if (film || teaser) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 0.95 });
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href')!.slice(1);
      const el = id === 'top' ? document.body : document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      // sections reserve room for the bar with scroll-margin-top, which Lenis honours
      lenis.scrollTo(el, { duration: 1.4 });
      history.replaceState(null, '', id === 'top' ? window.location.pathname : `#${id}`);
    };
    document.addEventListener('click', onClick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onClick);
      lenis.destroy();
    };
  }, [film, teaser]);

  if (teaser && Teaser) {
    return (
      <Suspense fallback={<div className="h-screen bg-[#e4e9ef]" />}>
        <Teaser />
      </Suspense>
    );
  }
  if (film && Film) {
    return (
      <Suspense fallback={<div className="h-screen bg-black" />}>
        <Film onClose={() => setFilm(false)} />
      </Suspense>
    );
  }

  return (
    <div id="top">
      <Nav />
      <Hero />
      <main>
        <Numbers />
        <HotspotMap />
        <HabitIndex />
        {CHAPTERS.map((c, i) => (
          <StoryChapter key={c.id} ch={c} story={STORIES[c.id]} index={i} />
        ))}
        <FiveSeconds />
        <Method />
      </main>
      <Footer />
    </div>
  );
}
