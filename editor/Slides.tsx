import React, {useState} from 'react';
import {T} from './i18n';

export const slidesCss = `
.sl{margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid #2e3a63}
.sl-head{display:flex;align-items:baseline;gap:8px;margin-bottom:6px}
.sl-head b{font-size:13px}
.sl-head span{color:#9aa6c7;font-size:11px}
.sl-list{max-height:240px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:2px 0}
.sl-row{display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;background:#151c33;cursor:grab;
  font-size:13px;user-select:none;-webkit-user-select:none;border:1px solid transparent;position:relative}
.sl-row:hover{background:#1b2442}
.sl-row.cur{background:#26315a;border-color:#8b6cff}
.sl-row.dragging{opacity:.35}
.sl-row.drop-before::before,.sl-row.drop-after::after{content:'';position:absolute;left:0;right:0;height:3px;border-radius:2px;background:#ffb020}
.sl-row.drop-before::before{top:-3px}
.sl-row.drop-after::after{bottom:-3px}
.sl-grip{color:#5d6a92;letter-spacing:-2px;font-size:12px}
.sl-nr{color:#9aa6c7;font-variant-numeric:tabular-nums;min-width:1.6em;text-align:right}
.sl-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.sl-dur{color:#5d6a92;font-size:11px;font-variant-numeric:tabular-nums}
`;

/**
 * Slide manager: the scenes in their current order. Drag a row to reorder, click to jump to that slide.
 * Only `order` in content.json changes; the scenes themselves stay untouched.
 */
export const Slides: React.FC<{
  order: string[];
  current: string;
  nameOf: (id: string) => string;
  durOf: (id: string) => number;
  onJump: (id: string) => void;
  onReorder: (order: string[]) => void;
}> = ({order, current, nameOf, durOf, onJump, onReorder}) => {
  const [drag, setDrag] = useState<string | null>(null);
  const [drop, setDrop] = useState<{id: string; after: boolean} | null>(null);

  const finish = () => {
    if (drag && drop && drag !== drop.id) {
      const rest = order.filter((id) => id !== drag);
      const at = rest.indexOf(drop.id) + (drop.after ? 1 : 0);
      const next = [...rest.slice(0, at), drag, ...rest.slice(at)];
      if (next.join() !== order.join()) onReorder(next);
    }
    setDrag(null);
    setDrop(null);
  };

  return (
    <div className="sl">
      <div className="sl-head">
        <b>{T.slides}</b>
        <span>{T.slidesHint}</span>
      </div>
      <div className="sl-list" onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
        {order.map((id, i) => (
          <div
            key={id}
            draggable
            title={T.slideRowTitle}
            className={[
              'sl-row',
              id === current ? 'cur' : '',
              id === drag ? 'dragging' : '',
              drop?.id === id && drag !== id ? (drop.after ? 'drop-after' : 'drop-before') : '',
            ].join(' ')}
            onClick={() => onJump(id)}
            onDragStart={(e) => {
              setDrag(id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', id);
            }}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              const r = e.currentTarget.getBoundingClientRect();
              const after = e.clientY > r.top + r.height / 2;
              if (drop?.id !== id || drop.after !== after) setDrop({id, after});
            }}
            onDrop={(e) => {
              e.preventDefault();
              finish();
            }}
            onDragEnd={() => {
              setDrag(null);
              setDrop(null);
            }}
          >
            <span className="sl-grip">⋮⋮</span>
            <span className="sl-nr">{i + 1}</span>
            <span className="sl-name">{nameOf(id)}</span>
            <span className="sl-dur">{Math.round(durOf(id) / 30)} s</span>
          </div>
        ))}
      </div>
    </div>
  );
};
