import React, {useCallback, useEffect, useRef, useState} from 'react';
import {T} from './i18n';

/**
 * Drawing on the slide during the talk (key p): a transparent layer over the slide that takes mouse, trackpad, pen or
 * touch. Strokes are kept relative to the layer, so they stay in place when the window or fullscreen changes size.
 * Nothing is saved: the drawing disappears when the slide changes or the pen is put away.
 * Keys while drawing: 1–4 colour, z undo the last stroke, c clear, p or Esc stop.
 */
type Stroke = {color: string; pts: [number, number][]};
const COLORS = ['#ff2d55', '#ffcc00', '#34c759', '#0a84ff'];

export const inkCss = `
.ink{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:30;cursor:crosshair;touch-action:none}
.ink-bar{position:absolute;left:14px;top:12px;z-index:31;display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:16px;
  background:rgba(8,12,26,.78);color:#e8ecf8;font-size:12px;pointer-events:none;user-select:none}
.ink-bar i{display:inline-block;width:12px;height:12px;border-radius:6px;border:2px solid rgba(255,255,255,.35)}
.ink-bar i.on{border-color:#fff;transform:scale(1.25)}
`;

export const Ink: React.FC<{clearKey: string; onExit: () => void}> = ({clearKey, onExit}) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [color, setColor] = useState(0);

  const draw = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const w = c.clientWidth;
    const h = c.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const lw = Math.max(3, Math.min(w, h * 16 / 9) * 0.0035);
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      const pts = s.pts.map(([x, y]) => [x * w, y * h] as const);
      if (!pts.length) continue;
      // a dark edge under the colour keeps the line visible on light and dark slides
      for (const [style, width] of [['rgba(0,0,0,.45)', lw + 3], [s.color, lw]] as const) {
        g.strokeStyle = style;
        g.lineWidth = width;
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        if (pts.length === 1) g.lineTo(pts[0][0] + 0.01, pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2;
          const my = (pts[i][1] + pts[i + 1][1]) / 2;
          g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        if (pts.length > 1) g.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        g.stroke();
      }
    }
  }, []);

  // a new slide starts with an empty layer
  useEffect(() => {
    strokes.current = [];
    current.current = null;
    draw();
  }, [clearKey, draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
    };
  }, [draw]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === 'c') strokes.current = [];
      else if (k === 'z') strokes.current.pop();
      else if (['1', '2', '3', '4'].includes(k)) setColor(Number(k) - 1);
      else if (k === 'escape') onExit();
      else handled = false;
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
        draw();
      }
    };
    // capture: before the presenter's own keys (Esc would otherwise close dialogs)
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [draw, onExit]);

  const pos = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  return (
    <>
      <canvas
        ref={canvas}
        className="ink"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          canvas.current?.setPointerCapture(e.pointerId);
          current.current = {color: COLORS[color], pts: [pos(e)]};
          draw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          const events = e.nativeEvent.getCoalescedEvents?.() ?? [];
          if (events.length) {
            const r = canvas.current!.getBoundingClientRect();
            for (const ev of events) current.current.pts.push([(ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height]);
          } else current.current.pts.push(pos(e));
          draw();
        }}
        onPointerUp={() => {
          if (current.current) strokes.current.push(current.current);
          current.current = null;
          draw();
        }}
        onPointerCancel={() => {
          current.current = null;
          draw();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      />
      <div className="ink-bar">
        ✎ {T.inkActive}
        {COLORS.map((c, i) => (
          <i key={c} className={i === color ? 'on' : ''} style={{background: c}} />
        ))}
        <span style={{opacity: 0.7}}>{T.inkKeys}</span>
      </div>
    </>
  );
};
