import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  loadFont,
  resolveDesign,
  useCurrentFrame,
  useVideoConfig,
} from 'showpoint';
import design from './design.json';

/**
 * The look of this presentation – colours, font, background, shapes – comes from design.json and nowhere else.
 * To change it, change design.json (in the presenter: "Design" in the side panel, or a task like "background a
 * little lighter"); never write colour values or font names into a slide.
 */
export const D = resolveDesign(design);

/** Colours for slides. All of them point into design.json. */
export const C = {
  bg: D.surface.bg,
  panel: D.surface.panel,
  panel2: D.surface.panel2,
  border: D.surface.border,
  inset: D.surface.inset,
  text: D.text.normal,
  muted: D.text.muted,
  heading: D.text.heading,
  kicker: D.text.kicker,
  /** Text on top of an accent colour. */
  onAccent: D.text.onAccent,
  /** The accent palette in its order: C.accent[0], C.accent[1] … */
  accent: D.accent,
  good: D.status.good,
  bad: D.status.bad,
  note: D.status.note,
  // Older names, kept so existing slides keep compiling: three accents by their former role, and a fourth.
  doc: D.accent[0],
  mem: D.accent[1 % D.accent.length],
  query: D.accent[2 % D.accent.length],
  fire: D.accent[5 % D.accent.length],
};

export const FONT = D.font.family;
/** Font weights of the design: W.normal, W.strong, W.kicker, W.heading. */
export const W = D.font.weights;
/** Corner radius and frame width of boxes. */
export const SHAPE = D.shape;

// Own font files named in design.json (font.files, files in src/schriften/) are registered here.
const fontFiles = import.meta.glob<string>('./schriften/*.{woff2,woff,ttf,otf}', {eager: true, query: '?url', import: 'default'});
for (const f of D.font.files) {
  const url = fontFiles[`./schriften/${f.file}`];
  if (url) loadFont(f.family, url, {weight: f.weight, style: f.style});
}

export const CLAMP = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

export type SceneContent = {
  name?: string;
  dur: number;
  kicker?: string;
  title?: string;
  captions?: Caption[];
  stops: number[];
  t: Record<string, string>;
  lists: Record<string, string[]>;
};

/** all = the texts of all scenes; needed for building blocks that look the same on several slides. */
export type SceneProps = {dur: number; c: SceneContent; all?: Record<string, SceneContent>};

export const useAppear = (at: number) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - at, fps, config: {damping: 200}});
};

export const Appear: React.FC<{
  at: number;
  dy?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({at, dy = 30, style, children}) => {
  const s = useAppear(at);
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${(1 - s) * dy}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export type Caption = {at: number; text: string};

const Captions: React.FC<{items: Caption[]}> = ({items}) => {
  const frame = useCurrentFrame();
  let idx = -1;
  items.forEach((c, i) => {
    if (frame >= c.at) idx = i;
  });
  if (idx < 0) return null;
  const cur = items[idx];
  const next = items[idx + 1];
  const fadeIn = interpolate(frame, [cur.at, cur.at + 10], [0, 1], CLAMP);
  const fadeOut = next
    ? interpolate(frame, [next.at - 8, next.at], [1, 0], CLAMP)
    : 1;
  return (
    <div
      style={{
        position: 'absolute',
        left: 120,
        right: 120,
        bottom: 34,
        height: 124,
        borderRadius: SHAPE.radius + 2,
        background: D.caption.bg,
        border: `${Math.max(1, SHAPE.borderWidth - 1)}px solid ${D.caption.border}`,
        color: D.caption.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 40px',
        fontSize: 36,
        lineHeight: 1.3,
        boxSizing: 'border-box',
      }}
    >
      {/* pre-line: a line break typed in the caption (Shift+Return) starts a new line; balance: even lines, no lone last word */}
      <span style={{opacity: Math.min(fadeIn, fadeOut), whiteSpace: 'pre-line', textWrap: 'balance'}}>{cur.text}</span>
    </div>
  );
};

export const Scene: React.FC<{
  dur: number;
  kicker?: string;
  title?: string;
  captions?: Caption[];
  children: React.ReactNode;
}> = ({dur, kicker, title, captions, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 12, dur - 12, dur],
    [0, 1, 1, 0],
    CLAMP,
  );
  return (
    <AbsoluteFill
      style={{
        background: D.surface.background,
        fontFamily: FONT,
        color: C.text,
        opacity,
      }}
    >
      {title ? (
        <div style={{position: 'absolute', left: 90, top: 50}}>
          {kicker ? (
            <div
              style={{
                fontSize: 26,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: C.kicker,
                fontWeight: W.kicker,
              }}
            >
              {kicker}
            </div>
          ) : null}
          <div style={{fontSize: 62, fontWeight: W.heading, letterSpacing: -1, color: C.heading}}>
            {title}
          </div>
        </div>
      ) : null}
      {children}
      {captions ? <Captions items={captions} /> : null}
    </AbsoluteFill>
  );
};

export const Box: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  at?: number;
  color?: string;
  fill?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({x, y, w, h, at = 0, color = C.border, fill = C.panel, style, children}) => {
  const s = useAppear(at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: SHAPE.radius,
        border: `${SHAPE.borderWidth}px solid ${color}`,
        background: fill,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        boxSizing: 'border-box',
        fontSize: 30,
        fontWeight: W.strong,
        opacity: s,
        transform: `scale(${0.92 + 0.08 * s})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Sub: React.FC<{children: React.ReactNode; color?: string}> = ({
  children,
  color = C.muted,
}) => (
  <div style={{fontSize: 22, fontWeight: W.normal, color, marginTop: 6}}>
    {children}
  </div>
);

export const Label: React.FC<{
  x: number;
  y: number;
  at?: number;
  w?: number;
  size?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  weight?: number;
  children: React.ReactNode;
}> = ({x, y, at = 0, w, size = 26, color = C.muted, align = 'left', weight = W.normal, children}) => {
  const s = useAppear(at);
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        fontSize: size,
        color,
        textAlign: align,
        fontWeight: weight,
        opacity: s,
        lineHeight: 1.3,
      }}
    >
      {children}
    </div>
  );
};

export const Svg: React.FC<{children: React.ReactNode}> = ({children}) => (
  <svg
    width={1920}
    height={1080}
    style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
  >
    {children}
  </svg>
);

export const Arrow: React.FC<{
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  at?: number;
  color?: string;
  width?: number;
  head?: boolean;
  opacity?: number;
}> = ({x1, y1, x2, y2, at = 0, color = C.muted, width = 4, head = true, opacity = 1}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + 14], [0, 1], CLAMP);
  if (p <= 0) return null;
  const ex = x1 + (x2 - x1) * p;
  const ey = y1 + (y2 - y1) * p;
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hs = 16;
  const pts = [
    [ex, ey],
    [ex - hs * Math.cos(a - 0.45), ey - hs * Math.sin(a - 0.45)],
    [ex - hs * Math.cos(a + 0.45), ey - hs * Math.sin(a + 0.45)],
  ]
    .map((q) => q.join(','))
    .join(' ');
  return (
    <g opacity={opacity}>
      <line
        x1={x1}
        y1={y1}
        x2={head ? ex - (hs - 4) * Math.cos(a) : ex}
        y2={head ? ey - (hs - 4) * Math.sin(a) : ey}
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      {head ? <polygon points={pts} fill={color} /> : null}
    </g>
  );
};

/** An embedding vector as a strip of colored cells. */
export const Vec: React.FC<{
  seed: string;
  n?: number;
  cell?: number;
  hue?: number;
  style?: React.CSSProperties;
}> = ({seed, n = 12, cell = 26, hue = 200, style}) => (
  <div style={{display: 'flex', gap: 3, ...style}}>
    {new Array(n).fill(0).map((_, i) => {
      const h = hue + (random(`${seed}-h-${i}`) - 0.5) * 70;
      const l = 28 + random(`${seed}-l-${i}`) * 40;
      return (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            borderRadius: 5,
            background: `hsl(${h}, 75%, ${l}%)`,
          }}
        />
      );
    })}
  </div>
);

export const memHue = (i: number) => 215 + ((i * 47) % 130);

/** A memory token / slot. sat 0 = still "empty", 1 = filled. */
export const Token: React.FC<{
  i: number;
  size?: number;
  h?: number;
  sat?: number;
  label?: boolean;
  style?: React.CSSProperties;
}> = ({i, size = 60, h, sat = 1, label = false, style}) => (
  <div
    style={{
      width: size,
      height: h ?? size,
      borderRadius: Math.max(4, size * 0.2),
      background: `hsl(${memHue(i)}, ${8 + 72 * sat}%, ${38 + 20 * sat}%)`,
      border: `2px solid hsla(${memHue(i)}, ${10 + 80 * sat}%, 80%, 0.7)`,
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.34,
      fontWeight: 700,
      color: 'rgba(255,255,255,0.9)',
      flexShrink: 0,
      ...style,
    }}
  >
    {label ? i + 1 : null}
  </div>
);

export const Doc: React.FC<{
  w?: number;
  h?: number;
  opacity?: number;
  color?: string;
}> = ({w = 52, h = 66, opacity = 1, color = C.doc}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: 7,
      background: C.inset,
      border: `2px solid ${color}`,
      boxSizing: 'border-box',
      padding: `${h * 0.16}px ${w * 0.16}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: h * 0.1,
      opacity,
      flexShrink: 0,
    }}
  >
    {[1, 0.8, 1, 0.55].map((f, i) => (
      <div
        key={i}
        style={{
          height: Math.max(2, h * 0.06),
          width: `${f * 100}%`,
          background: color,
          opacity: 0.7,
          borderRadius: 2,
        }}
      />
    ))}
  </div>
);
