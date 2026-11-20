import React, {useCallback, useEffect, useRef, useState} from 'react';
import {T} from './i18n';

/** Position of a window as a fraction of the slide area (0…1); h = null means: as tall as its content. */
type Box = {l: number; t: number; w: number; h: number | null};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const floatCss = `
.fl-head{cursor:move;touch-action:none}
.fl-grip{position:absolute;right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;touch-action:none;
  background:linear-gradient(135deg,transparent 50%,#8b6cff 50%,#8b6cff 60%,transparent 60%,transparent 72%,#8b6cff 72%,#8b6cff 82%,transparent 82%);
  border-bottom-right-radius:12px}
`;

/**
 * Makes a window above the slide movable (drag the header) and resizable (grip bottom right).
 * The position is remembered in the browser; double-clicking the header resets it.
 */
export function useFloat(key: string, def: {l: number; t: number; w: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial: Box = {...def, h: null};
  const [box, setBox] = useState<Box>(() => {
    try {
      const b = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (b && [b.l, b.t, b.w].every((n: unknown) => typeof n === 'number')) return b;
    } catch {
      // without storage the default applies
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(box));
    } catch {
      // not remembered – no problem
    }
  }, [key, box]);

  const start = useCallback(
    (mode: 'move' | 'size') => (e: React.PointerEvent) => {
      const el = ref.current;
      const parent = el?.offsetParent as HTMLElement | null;
      if (!el || !parent) return;
      if (mode === 'move' && (e.target as HTMLElement).closest('button,select,input,textarea')) return;
      e.preventDefault();
      e.stopPropagation();
      const pr = parent.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const b0 = {l: (r.left - pr.left) / pr.width, t: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height};
      const sx = e.clientX;
      const sy = e.clientY;
      const move = (ev: PointerEvent) => {
        const dx = (ev.clientX - sx) / pr.width;
        const dy = (ev.clientY - sy) / pr.height;
        setBox((b) =>
          mode === 'move'
            ? {...b, l: clamp(b0.l + dx, 0, 1 - b0.w), t: clamp(b0.t + dy, 0, 1 - Math.min(b0.h, 0.92))}
            : {...b, w: clamp(b0.w + dx, 0.22, 1 - b0.l), h: clamp(b0.h + dy, 0.2, 1 - b0.t)},
        );
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [],
  );

  const style: React.CSSProperties = {
    left: `${box.l * 100}%`,
    top: `${box.t * 100}%`,
    width: `${box.w * 100}%`,
    right: 'auto',
    bottom: 'auto',
    height: box.h ? `${box.h * 100}%` : undefined,
    maxHeight: `${(1 - box.t) * 100 - 1}%`,
  };
  return {
    ref,
    style,
    head: {className: 'ask-head fl-head', onPointerDown: start('move'), onDoubleClick: () => setBox(initial), title: T.dragMove},
    grip: <div className="fl-grip" title={T.dragSize} onPointerDown={start('size')} />,
  };
}

/**
 * Props for a scrolling log: new content keeps it scrolled to the bottom, but only while the reader is already
 * at the bottom. Once they scroll up to read, it stays put until they scroll back down.
 */
export function useFollowLog(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return {
    ref,
    onScroll: () => {
      const el = ref.current;
      if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    },
  };
}
