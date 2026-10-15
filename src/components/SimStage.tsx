import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { Stage, type Metrics } from '../render/Stage.ts';
import type { ThemeName } from '../render/theme.ts';
import { byId } from '../sim/scenarios/index.ts';

export interface SimStageHandle {
  restart: () => void;
  stage: () => Stage | null;
}

interface Props {
  scenario: string;
  mode?: 'split' | 'wipe';
  civicShare: number;
  playing?: boolean;
  speedMul?: number;
  seed?: number;
  warmup?: number;
  labels?: { a: string; b: string };
  onMetrics?: (a: Metrics, b: Metrics, t: number) => void;
  onReady?: (stage: Stage) => void;
  className?: string;
  children?: ReactNode;
  /** keep the WebGL context alive even when far off-screen */
  persistent?: boolean;
  theme?: ThemeName;
  colorMode?: 'paint' | 'explain';
}

/** Lazily creates a WebGL Stage when near the viewport and renders only while visible. */
export const SimStage = forwardRef<SimStageHandle, Props>(function SimStage(
  { scenario, mode, civicShare, playing = true, speedMul = 1, seed, warmup, labels, onMetrics, onReady, className, children, persistent, theme, colorMode },
  ref,
) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasHost = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [near, setNear] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onMetrics, onReady });
  cb.current = { onMetrics, onReady };
  const share = useRef(civicShare);
  share.current = civicShare;

  // proximity & visibility
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ioNear = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: '120% 0px 120% 0px' });
    const ioVis = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.02 });
    ioNear.observe(el);
    ioVis.observe(el);
    return () => {
      ioNear.disconnect();
      ioVis.disconnect();
    };
  }, []);

  const load = async () => {
    const st = stageRef.current;
    if (!st) return;
    setReady(false);
    setProgress(0);
    await st.load(byId(scenario), share.current, { seed, warmup, onProgress: setProgress });
    if (stageRef.current !== st) return;
    st.setSpeed(byId(scenario).speed * speedMul);
    setReady(true);
    cb.current.onReady?.(st);
  };

  const destroy = () => {
    const st = stageRef.current;
    if (!st) return;
    stageRef.current = null;
    st.dispose();
    st.renderer.domElement.remove();
  };

  // create / dispose the WebGL stage (a fresh canvas each time, so contexts are never reused after loss)
  useEffect(() => {
    if (!near && !persistent) {
      if (stageRef.current) {
        destroy();
        setReady(false);
      }
      return;
    }
    if (stageRef.current || !canvasHost.current) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 h-full w-full';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Traffic simulation');
    canvasHost.current.appendChild(canvas);
    try {
      stageRef.current = new Stage({
        canvas,
        overlay: overlayRef.current,
        mode,
        labels,
        theme,
        colorMode,
        quality: window.matchMedia('(max-width: 720px)').matches ? 'low' : 'high',
        onMetrics: (a, b, t) => cb.current.onMetrics?.(a, b, t),
      });
      void load();
    } catch (err) {
      console.error(err);
      canvas.remove();
      setFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near, persistent]);

  useEffect(() => () => destroy(), []);

  useEffect(() => {
    stageRef.current?.setActive(visible && ready);
  }, [visible, ready]);
  useEffect(() => {
    stageRef.current?.setCivicShare(civicShare);
  }, [civicShare, ready]);
  useEffect(() => {
    stageRef.current?.setPlaying(playing);
  }, [playing, ready]);
  useEffect(() => {
    if (theme) stageRef.current?.setTheme(theme);
  }, [theme, ready]);
  useEffect(() => {
    stageRef.current?.setSpeed(byId(scenario).speed * speedMul);
  }, [speedMul, scenario, ready]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => stageRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useImperativeHandle(ref, () => ({
    restart: () => void load(),
    stage: () => stageRef.current,
  }));

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className?.includes('absolute') ? '' : 'relative '}${className ?? ''}`}>
      <div ref={canvasHost} className="absolute inset-0" />
      <div ref={overlayRef} className="stage-overlay" />
      {!ready && !failed && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-[3px] w-40 overflow-hidden rounded-full bg-[var(--track)]">
              <div className="h-full bg-[var(--brand)] transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="eyebrow">Warming up the traffic</span>
          </div>
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-[var(--color-ink-2)]">
          This simulation needs WebGL, which isn’t available in this browser.
        </div>
      )}
      {children}
    </div>
  );
});
