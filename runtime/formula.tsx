/**
 * Mathematical formulas from LaTeX text, typeset with KaTeX (MIT licence).
 *
 *   <Formula tex={c.t.f1} x={200} y={300} at={20} />
 *   <Formula steps={c.lists.umformung} x={200} y={300} at={20} every={45} />
 *
 * Positioned absolutely in stage pixels (1920×1080). Fades in smoothly from frame `at`; with `steps` the lines
 * appear one after the other (e.g. the steps of a calculation). The TeX text belongs in content.json (c.t / c.lists)
 * so it can be edited in the presenter. Invalid TeX does not crash the slide: KaTeX shows the faulty part in red.
 */
import React, {useMemo} from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './formula.css';
import {spring, useCurrentFrame, useVideoConfig} from './index';

export type FormulaProps = {
  /** The formula as LaTeX, e.g. '\\frac{a}{b}'. With `steps` it is shown as the first line. */
  tex?: string;
  /** Further lines (e.g. steps of a calculation) that appear one after the other below `tex`. */
  steps?: readonly string[];
  /** Left edge (or centre / right edge, see `align`) in stage pixels. */
  x: number;
  /** Top edge in stage pixels. */
  y: number;
  /** Width of the box; needed for align 'center' / 'right' to refer to a box instead of the point x. */
  w?: number;
  /** Frame at which the first line starts to fade in (default 0). */
  at?: number;
  /** Frames between two lines when `steps` is used (default 45). */
  every?: number;
  /** Explicit start frames per line instead of `every` (same order as the lines). */
  stepAt?: readonly number[];
  /** Font size in px (default 56). KaTeX scales everything relative to it. */
  fontSize?: number;
  /** Text colour (default: the colour of the surrounding text). */
  color?: string;
  /** true (default): display style – large fractions, limits above and below sums. false: inline style. */
  display?: boolean;
  /** Alignment of the lines (default 'left'). */
  align?: 'left' | 'center' | 'right';
  /** Vertical gap between lines in px (default 0.45 × fontSize). */
  gap?: number;
  /** Distance the lines slide up while fading in (default 20). */
  dy?: number;
  style?: React.CSSProperties;
};

const render = (tex: string, displayMode: boolean) =>
  katex.renderToString(tex, {throwOnError: false, displayMode, output: 'html', strict: 'ignore'});

export const Formula: React.FC<FormulaProps> = ({
  tex,
  steps = [],
  x,
  y,
  w,
  at = 0,
  every = 45,
  stepAt,
  fontSize = 56,
  color,
  display = true,
  align = 'left',
  gap,
  dy = 20,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lines = useMemo(() => [...(tex !== undefined ? [tex] : []), ...steps], [tex, steps]);
  const html = useMemo(() => lines.map((l) => render(l, display)), [lines, display]);

  // without a width, 'center' / 'right' refer to the point x: the box is shifted by half / all of its width
  const shift = w === undefined && align !== 'left' ? (align === 'center' ? '-50%' : '-100%') : '0';

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        transform: `translateX(${shift})`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'left' ? 'flex-start' : align === 'center' ? 'center' : 'flex-end',
        gap: gap ?? fontSize * 0.45,
        fontSize,
        color: color ?? 'inherit',
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {html.map((h, i) => {
        const start = stepAt?.[i] ?? at + i * every;
        const s = spring({frame: frame - start, fps, config: {damping: 200}});
        return (
          <div
            key={i}
            className="sp-formula"
            style={{opacity: s, transform: `translateY(${(1 - s) * dy}px)`}}
            dangerouslySetInnerHTML={{__html: h}}
          />
        );
      })}
    </div>
  );
};
