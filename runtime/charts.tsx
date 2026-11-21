/**
 * Chart building blocks: BarChart, LineChart, PieChart. They animate in from the frame `at`, take their numbers as
 * numbers or as text from content.json (e.g. c.lists.werte = ["12", "3,5", "40 %"]) and keep all labels as real,
 * selectable text. Positions and sizes are in stage pixels (1920×1080), like the other building blocks.
 */
import React, {useId} from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from './index';

export type Num = number | string;

/** Colours that fit the ShowPoint scheme; series and segments take them in this order. */
export const CHART_COLORS = ['#38BDF8', '#8B6CFF', '#FFB020', '#34D399', '#F87171', '#FB923C', '#A3E635', '#F472B6'];

const TEXT = '#E8ECF8';
const MUTED = '#9AA6C7';
const GRID = '#2E3A63';
const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

type Common = {
  /** Top left corner and size of the whole chart, labels included. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Frame at which the chart starts to appear. */
  at?: number;
  /** Appended to every value shown, e.g. " %" or " ms". */
  unit?: string;
  /** Decimal places shown; default: as written in the data, per value. */
  decimals?: number;
  /** Decimal comma (3,5) instead of point (3.5); default: comma if the data is written with commas. */
  decimalComma?: boolean;
  fontSize?: number;
  textColor?: string;
  mutedColor?: string;
  gridColor?: string;
};

/* ── numbers ─────────────────────────────────────────────────────────────── */

type Parsed = {values: number[]; places: number[]; decimals: number; sep: string};

/** Reads numbers like 12, "3,5", "1.250", "40 %", "-0.75". A comma counts as decimal separator. */
export function parseNumbers(input: readonly Num[]): Parsed {
  let sep = '.';
  const places: number[] = [];
  const values = input.map((v) => {
    if (typeof v === 'number') {
      places.push(String(v).split('.')[1]?.length ?? 0);
      return v;
    }
    const m = String(v).replace(/\s/g, '').match(/-?[\d.,]+/);
    if (!m) {
      places.push(0);
      return 0;
    }
    let s = m[0];
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // 1.250,5 or 3,5 → comma is the decimal separator
      sep = ',';
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastComma >= 0) {
      s = s.replace(/,/g, ''); // 1,250.5
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, ''); // 1.250 = thousands
    }
    places.push(s.split('.')[1]?.length ?? 0);
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  });
  return {values, places, decimals: Math.max(0, ...places), sep};
}

const fmt = (n: number, decimals: number, sep: string, unit = '') => {
  const s = Math.abs(n) < 10 ** -(decimals + 1) ? (0).toFixed(decimals) : n.toFixed(decimals);
  const [int, frac] = s.split('.');
  const grouped = Math.abs(n) >= 10000 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : int;
  return (frac ? `${grouped}${sep}${frac}` : grouped) + unit;
};

/** Round axis steps (1, 2, 2.5, 5 × 10^k) covering lo…hi. */
function niceScale(lo: number, hi: number, count = 5) {
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) ?? 10 * mag;
  const min = Math.floor(lo / step + 1e-9) * step;
  const max = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step / 2; t += step) ticks.push(Math.round(t / step) * step);
  const stepDecimals = Math.max(0, -Math.floor(Math.log10(step) + 1e-9) + (String(step / mag).includes('.') ? 1 : 0));
  return {min, max, ticks, stepDecimals};
}

const textWidth = (s: string, fs: number) => s.length * fs * 0.56;

/** 0 → 1, smooth and without overshoot, starting at frame `start`. */
const grown = (frame: number, fps: number, start: number) => spring({frame: frame - start, fps, config: {damping: 200}});

const Txt: React.FC<{style: React.CSSProperties; children: React.ReactNode}> = ({style, children}) => (
  <div style={{position: 'absolute', lineHeight: 1.15, ...style}}>{children}</div>
);

/* ── BarChart ────────────────────────────────────────────────────────────── */

export type BarChartProps = Common & {
  labels: readonly string[];
  values: readonly Num[];
  /** One colour for all bars, or one per bar. */
  color?: string;
  colors?: readonly string[];
  /** Bars lie horizontally (labels on the left) – good for long labels. */
  horizontal?: boolean;
  /** Index of a bar to emphasise; the others are dimmed. */
  highlight?: number;
  /** Frames between two bars appearing. */
  stagger?: number;
  /** Fixed upper end of the axis instead of the largest value. */
  max?: number;
};

export const BarChart: React.FC<BarChartProps> = (p) => {
  const {x, y, w, h, labels, at = 0, unit = '', fontSize: fs = 24, stagger = 8, horizontal = false, highlight} = p;
  const {textColor = TEXT, mutedColor = MUTED, gridColor = GRID, color = CHART_COLORS[0], colors} = p;
  const parsed = parseNumbers(p.values);
  if (p.decimalComma !== undefined) parsed.sep = p.decimalComma ? ',' : '.';
  const vals = parsed.values;
  const placesOf = (i: number) => p.decimals ?? parsed.places[i];
  const n = vals.length;
  const axis = niceScale(Math.min(0, ...vals), Math.max(0, p.max ?? -Infinity, ...vals));
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const base = interpolate(frame, [at, at + 15], [0, 1], CLAMP);
  const grow = vals.map((_, i) => grown(frame, fps, at + 6 + i * stagger));
  const colorOf = (i: number) => colors?.[i % colors.length] ?? color;
  const dim = (i: number) => (highlight === undefined || highlight === i ? 1 : 0.35);
  const valueText = (i: number, prog: number) => fmt(vals[i] * prog, placesOf(i), parsed.sep, unit);
  const widest = Math.max(...vals.map((v, i) => textWidth(fmt(v, placesOf(i), parsed.sep, unit), fs * 0.9)));

  if (horizontal) {
    const labelW = Math.min(w * 0.38, Math.max(...labels.map((l) => textWidth(l, fs))) + 20);
    const left = labelW;
    const right = w - widest - 16;
    const span = axis.max - axis.min;
    const xOf = (v: number) => left + ((v - axis.min) / span) * (right - left);
    const slot = h / Math.max(1, n);
    const barH = Math.min(slot * 0.62, 72);
    return (
      <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
        <div style={{position: 'absolute', left: xOf(0) - 1, top: 0, width: 2, height: h, background: gridColor, opacity: base}} />
        {vals.map((v, i) => {
          const g = grow[i];
          const cy = slot * i + slot / 2;
          const x0 = xOf(0);
          const x1 = xOf(v * g);
          return (
            <React.Fragment key={i}>
              <Txt style={{left: 0, width: labelW - 16, top: cy, transform: 'translateY(-50%)', textAlign: 'right', fontSize: fs, color: textColor, opacity: Math.min(1, g * 1.5) * dim(i)}}>
                {labels[i]}
              </Txt>
              <div style={{position: 'absolute', left: Math.min(x0, x1), top: cy - barH / 2, width: Math.abs(x1 - x0), height: barH, background: colorOf(i), borderRadius: v >= 0 ? '0 8px 8px 0' : '8px 0 0 8px', opacity: dim(i)}} />
              <Txt style={{left: v >= 0 ? x1 + 12 : x1 - 12, top: cy, transform: `translate(${v >= 0 ? 0 : -100}%, -50%)`, fontSize: fs * 0.9, fontWeight: 700, color: textColor, opacity: g * dim(i), whiteSpace: 'nowrap'}}>
                {valueText(i, g)}
              </Txt>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  const tickW = Math.max(...axis.ticks.map((t) => textWidth(fmt(t, axis.stepDecimals, parsed.sep), fs * 0.8))) + 18;
  const left = tickW;
  const right = w;
  const top = fs * 1.6;
  const bottom = h - fs * 2.5 - 14;
  const span = axis.max - axis.min;
  const yOf = (v: number) => bottom - ((v - axis.min) / span) * (bottom - top);
  const slot = (right - left) / Math.max(1, n);
  const barW = Math.min(slot * 0.62, 170);
  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      {axis.ticks.map((t) => (
        <React.Fragment key={t}>
          <div style={{position: 'absolute', left, right: 0, top: yOf(t), height: t === 0 ? 2 : 1, background: gridColor, opacity: base * (t === 0 ? 1 : 0.6)}} />
          <Txt style={{left: 0, width: tickW - 12, top: yOf(t), transform: 'translateY(-50%)', textAlign: 'right', fontSize: fs * 0.8, color: mutedColor, opacity: base}}>
            {fmt(t, axis.stepDecimals, parsed.sep)}
          </Txt>
        </React.Fragment>
      ))}
      {vals.map((v, i) => {
        const g = grow[i];
        const cx = left + slot * i + slot / 2;
        const y0 = yOf(0);
        const y1 = yOf(v * g);
        return (
          <React.Fragment key={i}>
            <div style={{position: 'absolute', left: cx - barW / 2, top: Math.min(y0, y1), width: barW, height: Math.abs(y1 - y0), background: colorOf(i), borderRadius: v >= 0 ? '8px 8px 0 0' : '0 0 8px 8px', opacity: dim(i)}} />
            <Txt style={{left: cx, top: v >= 0 ? y1 - 8 : y1 + 8, transform: `translate(-50%, ${v >= 0 ? -100 : 0}%)`, fontSize: fs * 0.9, fontWeight: 700, color: textColor, opacity: g * dim(i), whiteSpace: 'nowrap'}}>
              {valueText(i, g)}
            </Txt>
            <Txt style={{left: cx - slot / 2 + 4, width: slot - 8, top: bottom + 12, textAlign: 'center', fontSize: fs, color: textColor, opacity: Math.min(1, g * 1.5) * dim(i)}}>
              {labels[i]}
            </Txt>
          </React.Fragment>
        );
      })}
    </div>
  );
};

/* ── LineChart ───────────────────────────────────────────────────────────── */

export type LineSeries = {name?: string; values: readonly Num[]; color?: string};

export type LineChartProps = Common & {
  /** Labels along the x axis (one per value). */
  labels: readonly string[];
  /** One line: values; several lines: series. */
  values?: readonly Num[];
  series?: readonly LineSeries[];
  /** Frames the line takes to draw from left to right. */
  dur?: number;
  /** Fill the area under a single line. */
  area?: boolean;
  /** Show values at 'last' point (default), at 'all' points, or 'none'. */
  showValues?: 'last' | 'all' | 'none';
  min?: number;
  max?: number;
};

export const LineChart: React.FC<LineChartProps> = (p) => {
  const {x, y, w, h, labels, at = 0, unit = '', fontSize: fs = 24, dur = 60, area = false, showValues = 'last'} = p;
  const {textColor = TEXT, mutedColor = MUTED, gridColor = GRID} = p;
  const clipId = useId().replace(/:/g, '');
  const frame = useCurrentFrame();
  const series = (p.series ?? [{values: p.values ?? []}]).map((s, k) => ({...s, ...parseNumbers(s.values), color: s.color ?? CHART_COLORS[k % CHART_COLORS.length]}));
  const sep = p.decimalComma !== undefined ? (p.decimalComma ? ',' : '.') : series.find((s) => s.sep === ',') ? ',' : '.';
  const all = series.flatMap((s) => s.values);
  const lo = p.min ?? (Math.min(...all) >= 0 && Math.min(...all) < Math.max(...all) * 0.5 ? 0 : Math.min(...all));
  const axis = niceScale(lo, Math.max(p.max ?? -Infinity, ...all));
  const base = interpolate(frame, [at, at + 15], [0, 1], CLAMP);
  const legend = series.length > 1 && series.some((s) => s.name);

  const tickDec = axis.stepDecimals;
  const tickW = Math.max(...axis.ticks.map((t) => textWidth(fmt(t, tickDec, sep), fs * 0.8))) + 18;
  const lastW = Math.max(...series.map((s) => textWidth(fmt(s.values[s.values.length - 1] ?? 0, p.decimals ?? s.places[s.places.length - 1] ?? 0, sep, unit), fs * 0.9)));
  const left = tickW;
  const right = w - (showValues === 'last' ? lastW + 18 : 24);
  const top = (legend ? fs * 2.2 : 0) + fs * 1.4;
  const bottom = h - fs * 1.4 - 14;
  const n = Math.max(2, labels.length, ...series.map((s) => s.values.length));
  const xOf = (i: number) => left + (i / (n - 1)) * (right - left);
  const yOf = (v: number) => bottom - ((v - axis.min) / (axis.max - axis.min)) * (bottom - top);
  const every = Math.ceil(labels.length / 12);

  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      {legend ? (
        <div style={{position: 'absolute', left, top: 0, display: 'flex', gap: 34, fontSize: fs * 0.9, color: textColor, opacity: base}}>
          {series.map((s, k) => (
            <div key={k} style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span style={{width: 28, height: 6, borderRadius: 3, background: s.color}} />
              {s.name}
            </div>
          ))}
        </div>
      ) : null}
      {axis.ticks.map((t) => (
        <React.Fragment key={t}>
          <div style={{position: 'absolute', left, width: right - left, top: yOf(t), height: 1, background: gridColor, opacity: base * 0.6}} />
          <Txt style={{left: 0, width: tickW - 12, top: yOf(t), transform: 'translateY(-50%)', textAlign: 'right', fontSize: fs * 0.8, color: mutedColor, opacity: base}}>
            {fmt(t, tickDec, sep)}
          </Txt>
        </React.Fragment>
      ))}
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <Txt key={i} style={{left: xOf(i), top: bottom + 12, transform: 'translateX(-50%)', fontSize: fs * 0.85, color: mutedColor, opacity: base, whiteSpace: 'nowrap'}}>
            {l}
          </Txt>
        ) : null,
      )}
      <svg width={w} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {series.map((s, k) => {
          const start = at + 10 + k * dur * 0.4;
          const q = interpolate(frame, [start, start + dur], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.quad)});
          const pts = s.values.map((v, i) => [xOf(i), yOf(v)] as const);
          const line = pts.map(([px, py]) => `${px},${py}`).join(' ');
          const reach = left + q * (right - left);
          return (
            <g key={k}>
              <defs>
                <clipPath id={`${clipId}-${k}`}>
                  <rect x={0} y={0} width={reach + 1} height={h} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId}-${k})`} opacity={q > 0 ? 1 : 0}>
                {area && series.length === 1 ? (
                  <polygon points={`${left},${yOf(Math.max(axis.min, 0))} ${line} ${pts[pts.length - 1]?.[0] ?? left},${yOf(Math.max(axis.min, 0))}`} fill={s.color} opacity={0.18} />
                ) : null}
                <polyline points={line} fill="none" stroke={s.color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
              </g>
              {pts.map(([px, py], i) =>
                q > 0 && px <= reach + 0.5 ? <circle key={i} cx={px} cy={py} r={8} fill="#0B1020" stroke={s.color} strokeWidth={4} /> : null,
              )}
            </g>
          );
        })}
      </svg>
      {series.map((s, k) => {
        const start = at + 10 + k * dur * 0.4;
        const q = interpolate(frame, [start, start + dur], [0, 1], {...CLAMP, easing: Easing.inOut(Easing.quad)});
        const reach = left + q * (right - left);
        return s.values.map((v, i) => {
          const isLast = i === s.values.length - 1;
          if (showValues === 'none' || (showValues === 'last' && !isLast)) return null;
          const px = xOf(i);
          const shown = q > 0 ? interpolate(reach - px, [0, 30], [0, 1], CLAMP) : 0;
          return (
            <Txt
              key={`${k}-${i}`}
              style={
                showValues === 'last'
                  ? {left: px + 16, top: yOf(v), transform: 'translateY(-50%)', fontSize: fs * 0.9, fontWeight: 700, color: s.color, opacity: shown, whiteSpace: 'nowrap'}
                  : {left: px, top: yOf(v) - 16, transform: 'translate(-50%, -100%)', fontSize: fs * 0.8, fontWeight: 700, color: textColor, opacity: shown, whiteSpace: 'nowrap'}
              }
            >
              {fmt(v, p.decimals ?? s.places[i], sep, unit)}
            </Txt>
          );
        });
      })}
    </div>
  );
};

/* ── PieChart ────────────────────────────────────────────────────────────── */

export type PieChartProps = Common & {
  labels: readonly string[];
  values: readonly Num[];
  colors?: readonly string[];
  /** Ring instead of a full pie (default true). */
  donut?: boolean;
  /** Text in the middle of the ring, e.g. a total. */
  center?: string;
  /** Frames the circle takes to fill. */
  dur?: number;
  /** Legend shows the value as well as the percentage. */
  showValues?: boolean;
};

function arcPath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number): string {
  // angles in degrees, 0 = top, clockwise
  const pt = (rad: number, a: number) => {
    const t = ((a - 90) * Math.PI) / 180;
    return `${cx + rad * Math.cos(t)},${cy + rad * Math.sin(t)}`;
  };
  if (a1 - a0 >= 359.99) {
    // full circle: two halves
    return arcPath(cx, cy, r, inner, a0, a0 + 180) + ' ' + arcPath(cx, cy, r, inner, a0 + 180, a0 + 359.98);
  }
  const large = a1 - a0 > 180 ? 1 : 0;
  if (inner <= 0) return `M${cx},${cy} L${pt(r, a0)} A${r},${r} 0 ${large} 1 ${pt(r, a1)} Z`;
  return `M${pt(r, a0)} A${r},${r} 0 ${large} 1 ${pt(r, a1)} L${pt(inner, a1)} A${inner},${inner} 0 ${large} 0 ${pt(inner, a0)} Z`;
}

export const PieChart: React.FC<PieChartProps> = (p) => {
  const {x, y, w, h, labels, at = 0, unit = '', fontSize: fs = 24, donut = true, center, dur = 45, showValues = false} = p;
  const {textColor = TEXT, mutedColor = MUTED, colors = CHART_COLORS} = p;
  const frame = useCurrentFrame();
  const parsed = parseNumbers(p.values);
  if (p.decimalComma !== undefined) parsed.sep = p.decimalComma ? ',' : '.';
  const vals = parsed.values.map((v) => Math.max(0, v));
  const total = vals.reduce((a, b) => a + b, 0) || 1;
  const size = Math.min(h, w * 0.45);
  const r = size / 2;
  const inner = donut ? r * 0.6 : 0;
  const cx = r;
  const cy = h / 2;
  const sweep = interpolate(frame, [at, at + dur], [0, 360], {...CLAMP, easing: Easing.inOut(Easing.quad)});
  let acc = 0;
  const segs = vals.map((v, i) => {
    const a0 = acc;
    acc += (v / total) * 360;
    return {a0, a1: acc, v, i, color: colors[i % colors.length]};
  });
  const legendX = size + 50;
  const rowH = Math.min(fs * 2.1, h / Math.max(1, vals.length));
  const legendTop = cy - (rowH * vals.length) / 2;
  const pct = (v: number) => {
    const q = (v / total) * 100;
    return `${fmt(q, q < 10 && q % 1 !== 0 ? 1 : 0, parsed.sep)} %`;
  };

  return (
    <div style={{position: 'absolute', left: x, top: y, width: w, height: h}}>
      <svg width={size} height={h} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}}>
        {segs.map((s) =>
          sweep > s.a0 ? (
            <path key={s.i} d={arcPath(cx, cy, r, inner, s.a0, Math.min(s.a1, sweep))} fill={s.color} stroke="#0B1020" strokeWidth={3} strokeLinejoin="round" />
          ) : null,
        )}
        {segs.map((s) => {
          const share = (s.a1 - s.a0) / 360;
          if (share < 0.06) return null;
          const mid = ((s.a0 + s.a1) / 2 - 90) * (Math.PI / 180);
          const rr = donut ? (r + inner) / 2 : r * 0.62;
          const o = interpolate(sweep, [s.a1, s.a1 + 20], [0, 1], CLAMP);
          return (
            <text key={`t${s.i}`} x={cx + rr * Math.cos(mid)} y={cy + rr * Math.sin(mid)} textAnchor="middle" dominantBaseline="central" fontSize={fs * 0.85} fontWeight={700} fill="#0B1020" opacity={o}>
              {pct(s.v)}
            </text>
          );
        })}
      </svg>
      {center && donut ? (
        <Txt style={{left: cx - inner * 0.85, width: inner * 1.7, top: cy, transform: 'translateY(-50%)', textAlign: 'center', fontSize: fs * 1.1, fontWeight: 800, color: textColor, opacity: interpolate(sweep, [300, 360], [0, 1], CLAMP)}}>
          {center}
        </Txt>
      ) : null}
      {segs.map((s) => (
        <div
          key={`l${s.i}`}
          style={{
            position: 'absolute',
            left: legendX,
            width: w - legendX,
            top: legendTop + rowH * s.i,
            height: rowH,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: fs,
            color: textColor,
            opacity: interpolate(sweep, [s.a0, s.a0 + 25], [0, 1], CLAMP),
          }}
        >
          <span style={{flex: 'none', width: fs * 0.8, height: fs * 0.8, borderRadius: 4, background: s.color}} />
          <span style={{flex: 1, minWidth: 0}}>{labels[s.i]}</span>
          <span style={{flex: 'none', color: mutedColor, fontWeight: 700}}>
            {showValues ? `${fmt(s.v, p.decimals ?? parsed.places[s.i], parsed.sep, unit)} · ` : ''}
            {pct(s.v)}
          </span>
        </div>
      ))}
    </div>
  );
};
