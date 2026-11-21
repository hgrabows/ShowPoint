/**
 * ShowPoint runtime: the small set of building blocks the slides use – a frame clock, sequences, interpolation,
 * springs, easing and seeded randomness – plus the Player that shows a presentation in the browser.
 * Slides import these from 'showpoint'. Older presentations that still import from 'remotion' keep working:
 * the presenter maps that name to this file too (vite.config.mts, tsconfig.json).
 */
import React, {createContext, forwardRef, useContext} from 'react';

export {Player} from './Player';
export type {PlayerRef} from './Player';
export {ThreeCanvas, THREE} from './three';
export type {ThreeContext} from './three';

/* ── Timeline ─────────────────────────────────────────────────────────────── */

export type VideoConfig = {fps: number; width: number; height: number; durationInFrames: number};
type Timeline = VideoConfig & {frame: number};

const TimelineCtx = createContext<Timeline | null>(null);

const useTimeline = () => {
  const t = useContext(TimelineCtx);
  if (!t) throw new Error('useCurrentFrame/useVideoConfig must be used inside a ShowPoint stage (Player or renderer).');
  return t;
};

/** The current frame, counted from the start of the enclosing Sequence (or of the whole presentation). */
export const useCurrentFrame = () => useTimeline().frame;

/** Size, frame rate and total length of the presentation. */
export const useVideoConfig = (): VideoConfig => {
  const {fps, width, height, durationInFrames} = useTimeline();
  return {fps, width, height, durationInFrames};
};

/** Renders a component at one frame. Used by the Player and by the renderer for stills, PDF and video. */
export const Stage: React.FC<{
  component: React.ComponentType<any>;
  inputProps?: Record<string, unknown>;
  frame: number;
  config: VideoConfig;
}> = ({component: Comp, inputProps, frame, config}) => (
  <TimelineCtx.Provider value={{...config, frame}}>
    <div style={{position: 'relative', width: config.width, height: config.height, overflow: 'hidden'}}>
      <Comp {...(inputProps ?? {})} />
    </div>
  </TimelineCtx.Provider>
);

/* ── Layout ───────────────────────────────────────────────────────────────── */

const FILL: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
};

/** A div that covers its parent completely; children are stacked in a column. */
export const AbsoluteFill = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({style, ...rest}, ref) => (
  <div ref={ref} {...rest} style={{...FILL, ...style}} />
));
AbsoluteFill.displayName = 'AbsoluteFill';

type SequenceProps = {
  /** First frame (relative to the parent) at which the children appear. */
  from?: number;
  /** How long they stay; default: until the end. */
  durationInFrames?: number;
  /** 'absolute-fill' (default) wraps the children in an AbsoluteFill, 'none' renders them as they are. */
  layout?: 'absolute-fill' | 'none';
  style?: React.CSSProperties;
  className?: string;
  name?: string;
  children?: React.ReactNode;
};

/** Shows its children only within [from, from + durationInFrames); inside, frames count from 0 again. */
export const Sequence: React.FC<SequenceProps> = ({from = 0, durationInFrames = Infinity, layout = 'absolute-fill', style, className, children}) => {
  const t = useTimeline();
  const local = t.frame - from;
  if (local < 0 || local >= durationInFrames) return null;
  return (
    <TimelineCtx.Provider value={{...t, frame: local}}>
      {layout === 'none' ? children : <AbsoluteFill style={style} className={className}>{children}</AbsoluteFill>}
    </TimelineCtx.Provider>
  );
};

type SeriesSequenceProps = Omit<SequenceProps, 'from' | 'durationInFrames'> & {
  durationInFrames: number;
  /** Shifts this part (and all following ones) by this many frames. */
  offset?: number;
};

const SeriesSequence: React.FC<SeriesSequenceProps> = () => {
  throw new Error('Series.Sequence can only be used directly inside <Series>.');
};

/** Plays its Series.Sequence children one after the other. */
export const Series: React.FC<{children?: React.ReactNode}> & {Sequence: React.FC<SeriesSequenceProps>} = ({children}) => {
  let start = 0;
  const parts = React.Children.toArray(children).map((child) => {
    if (!React.isValidElement(child)) return child;
    if (child.type !== SeriesSequence) throw new Error('<Series> may only contain <Series.Sequence> elements.');
    const {durationInFrames, offset = 0, children: inner, ...rest} = child.props as SeriesSequenceProps;
    const from = start + offset;
    start = from + durationInFrames;
    return (
      <Sequence key={child.key} from={from} durationInFrames={durationInFrames} {...rest}>
        {inner}
      </Sequence>
    );
  });
  return <>{parts}</>;
};
Series.Sequence = SeriesSequence;

/** An image; the renderer waits until it has loaded before taking a picture. */
export const Img = forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>((props, ref) => (
  <img ref={ref} decoding="sync" {...props} />
));
Img.displayName = 'Img';

/* ── Interpolation ────────────────────────────────────────────────────────── */

type Extrapolate = 'extend' | 'clamp' | 'identity';
export type InterpolateOptions = {
  easing?: (t: number) => number;
  extrapolateLeft?: Extrapolate;
  extrapolateRight?: Extrapolate;
};

/** Maps `input` from inputRange onto outputRange, piecewise linear (optionally eased per segment). */
export function interpolate(input: number, inputRange: readonly number[], outputRange: readonly number[], options: InterpolateOptions = {}): number {
  if (inputRange.length !== outputRange.length) throw new Error('interpolate: inputRange and outputRange need the same length.');
  if (inputRange.length < 2) throw new Error('interpolate: the ranges need at least two values.');
  for (let i = 1; i < inputRange.length; i++) {
    if (!(inputRange[i] > inputRange[i - 1])) throw new Error(`interpolate: inputRange must be strictly increasing (got [${inputRange.join(', ')}]).`);
  }
  const {easing = (t: number) => t, extrapolateLeft = 'extend', extrapolateRight = 'extend'} = options;
  let i = 1;
  while (i < inputRange.length - 1 && input > inputRange[i]) i++;
  const a = inputRange[i - 1];
  const b = inputRange[i];
  const lo = outputRange[i - 1];
  const hi = outputRange[i];
  if (input < a) {
    if (extrapolateLeft === 'clamp') return lo;
    if (extrapolateLeft === 'identity') return input;
  }
  if (input > b) {
    if (extrapolateRight === 'clamp') return hi;
    if (extrapolateRight === 'identity') return input;
  }
  return lo + easing((input - a) / (b - a)) * (hi - lo);
}

/* ── Springs ──────────────────────────────────────────────────────────────── */

export type SpringConfig = {damping: number; mass: number; stiffness: number; overshootClamping: boolean};

/**
 * Value of a spring that starts at `from` at rest and is pulled towards `to`, at the given frame.
 * Underdamped springs oscillate; damping at or above the critical value is treated as critically damped
 * (the fastest motion without overshoot), which is what slides use for "appear smoothly".
 */
export function spring({
  frame,
  fps,
  config = {},
  from = 0,
  to = 1,
  delay = 0,
  durationInFrames,
  reverse = false,
}: {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  delay?: number;
  durationInFrames?: number;
  reverse?: boolean;
}): number {
  const {damping = 10, mass = 1, stiffness = 100, overshootClamping = false} = config;
  let f = frame - delay;
  if (durationInFrames !== undefined) {
    // stretch the motion so it settles after durationInFrames
    const natural = settleFrames({damping, mass, stiffness}, fps);
    f = (f / durationInFrames) * natural;
    if (reverse) f = natural - f;
  } else if (reverse) {
    f = -f;
  }
  const [start, end] = reverse && durationInFrames === undefined ? [to, from] : [from, to];
  if (f <= 0) return start;
  const p = springProgress(f / fps, {damping, mass, stiffness});
  const value = start + (end - start) * p;
  if (overshootClamping) return end >= start ? Math.min(value, end) : Math.max(value, end);
  return value;
}

/** Progress 0 → 1 of a unit spring released at rest, after t seconds. */
function springProgress(t: number, {damping, mass, stiffness}: Omit<SpringConfig, 'overshootClamping'>): number {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  let x: number; // displacement from the target, starting at -1
  if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta);
    x = Math.exp(-zeta * w0 * t) * (-Math.cos(wd * t) - ((zeta * w0) / wd) * Math.sin(wd * t));
  } else {
    x = Math.exp(-w0 * t) * (-1 - w0 * t);
  }
  return 1 + x;
}

function settleFrames(cfg: Omit<SpringConfig, 'overshootClamping'>, fps: number): number {
  // first frame after which the spring stays within 0.5 % of its target
  let last = 0;
  for (let f = 1; f < fps * 60; f++) {
    if (Math.abs(1 - springProgress(f / fps, cfg)) > 0.005) last = f;
    else if (f - last > fps) break;
  }
  return last + 1;
}

/* ── Easing ───────────────────────────────────────────────────────────────── */

type Ease = (t: number) => number;

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const at = (a: number, b: number, s: number) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  const slope = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 + 6 * (b - a) * s * (1 - s) + 3 * (1 - b) * s * s;
  return (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    // solve x(s) = t with Newton steps, falling back to bisection
    let s = t;
    for (let i = 0; i < 8; i++) {
      const d = slope(x1, x2, s);
      if (Math.abs(d) < 1e-6) break;
      const next = s - (at(x1, x2, s) - t) / d;
      if (next < 0 || next > 1) break;
      s = next;
    }
    if (Math.abs(at(x1, x2, s) - t) > 1e-5) {
      let lo = 0;
      let hi = 1;
      s = t;
      for (let i = 0; i < 40; i++) {
        if (at(x1, x2, s) < t) lo = s;
        else hi = s;
        s = (lo + hi) / 2;
      }
    }
    return at(y1, y2, s);
  };
}

export const Easing = {
  linear: ((t) => t) as Ease,
  quad: ((t) => t * t) as Ease,
  cubic: ((t) => t * t * t) as Ease,
  poly: (n: number): Ease => (t) => t ** n,
  sin: ((t) => 1 - Math.cos((t * Math.PI) / 2)) as Ease,
  circle: ((t) => 1 - Math.sqrt(1 - t * t)) as Ease,
  exp: ((t) => 2 ** (10 * (t - 1))) as Ease,
  back: (s = 1.70158): Ease => (t) => t * t * ((s + 1) * t - s),
  elastic: (bounciness = 1): Ease => {
    const p = bounciness * Math.PI;
    return (t) => 1 - Math.cos((t * Math.PI) / 2) ** 3 * Math.cos(t * p);
  },
  bounce: ((t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
  }) as Ease,
  ease: cubicBezier(0.42, 0, 1, 1),
  bezier: cubicBezier,
  in: (e: Ease): Ease => e,
  out: (e: Ease): Ease => (t) => 1 - e(1 - t),
  inOut: (e: Ease): Ease => (t) => (t < 0.5 ? e(t * 2) / 2 : 1 - e((1 - t) * 2) / 2),
};

/* ── Randomness ───────────────────────────────────────────────────────────── */

/** A number in [0, 1) that depends only on the seed – the same on every frame and every render. */
export function random(seed: string | number | null): number {
  if (seed === null) return Math.random();
  const n = typeof seed === 'number' ? Math.floor(seed * 1e10) : hashString(seed);
  return mulberry32(n);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ── Compatibility with Remotion-style entry files ────────────────────────── */

/** No effect: ShowPoint reads the slides from src/Video.tsx and src/content.json directly. */
export const Composition: React.FC<Record<string, unknown>> = () => null;
/** No effect, kept so older src/index.ts files still type-check. */
export const registerRoot = (_root: React.ComponentType): void => {};
