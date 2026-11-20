import React, {useCallback, useEffect, useRef, useState} from 'react';

/** Lage eines Fensters als Anteil der Folienfläche (0…1); h = null heißt: so hoch wie der Inhalt. */
type Box = {l: number; t: number; w: number; h: number | null};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export const floatCss = `
.fl-head{cursor:move;touch-action:none}
.fl-grip{position:absolute;right:0;bottom:0;width:22px;height:22px;cursor:nwse-resize;touch-action:none;
  background:linear-gradient(135deg,transparent 50%,#8b6cff 50%,#8b6cff 60%,transparent 60%,transparent 72%,#8b6cff 72%,#8b6cff 82%,transparent 82%);
  border-bottom-right-radius:12px}
`;

/**
 * Macht ein Fenster über der Folie verschiebbar (an der Kopfzeile ziehen) und in der Größe änderbar
 * (Griff unten rechts). Die Lage wird im Browser gemerkt; Doppelklick auf die Kopfzeile setzt sie zurück.
 */
export function useFloat(key: string, def: {l: number; t: number; w: number}) {
  const ref = useRef<HTMLDivElement>(null);
  const initial: Box = {...def, h: null};
  const [box, setBox] = useState<Box>(() => {
    try {
      const b = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (b && [b.l, b.t, b.w].every((n: unknown) => typeof n === 'number')) return b;
    } catch {
      // ohne Speicher gilt die Voreinstellung
    }
    return initial;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(box));
    } catch {
      // nicht merkbar – kein Problem
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
    head: {className: 'ask-head fl-head', onPointerDown: start('move'), onDoubleClick: () => setBox(initial), title: 'Ziehen = verschieben · Doppelklick = zurücksetzen'},
    grip: <div className="fl-grip" title="Ziehen = Größe ändern" onPointerDown={start('size')} />,
  };
}
