import React, {useCallback, useEffect, useState} from 'react';
import {T} from './i18n';

/** A design to choose from: shipped (vorlage/designs/) or the user's own (designs/). */
export type DesignItem = {id: string; name: string; own: boolean; preview: boolean; stamp: number; colors: string[]};
export type DesignCurrent = {has: boolean; name: string; id: string};
type DesignReply = {current: DesignCurrent; list: DesignItem[]; error?: string; warning?: string; exists?: boolean; saved?: string};

export const designCss = `
.dz{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.dz-tile{position:relative;flex:none;width:132px;padding:0;border:2px solid #2e3a63;border-radius:8px;background:#0a0d18;overflow:hidden;
  cursor:pointer;text-align:left;color:#c9d1ec;font-size:12px;line-height:1.3}
.dz-tile:hover{border-color:#5d6a92}
.dz-tile.on{border-color:#8b6cff}
.dz-tile:disabled{opacity:.6;cursor:default}
.dz-pic{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
.dz-sw{position:relative;width:100%;aspect-ratio:16/9}
.dz-sw i{position:absolute;left:10%;top:22%;width:44%;height:40%;border-radius:4px;border:2px solid}
.dz-sw b{position:absolute;bottom:14%;width:9%;aspect-ratio:1;border-radius:3px}
.dz-name{display:block;padding:4px 7px 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dz-tile.on .dz-name{color:#fff;font-weight:600}
.dz-x{position:absolute;right:3px;top:3px;width:18px;height:18px;line-height:15px;padding:0;border-radius:9px;border:1px solid #2e3a63;
  background:rgba(10,13,24,.85);color:#9aa6c7;font-size:11px;text-align:center;display:none}
.dz-tile:hover .dz-x{display:block}
.dz-row{display:flex;gap:8px;margin-top:8px;align-items:center}
.dz-row button{font-size:12px;padding:3px 9px}
.cr .dz{margin-top:2px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;flex-shrink:0}
.cr .dz-tile{width:150px}
`;

const post = (body: object): Promise<DesignReply> =>
  fetch('/api/design', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then((r) => r.json());

/** One design as a small picture with its name: the rendered sample slide, or its main colours until that exists. */
const Tile: React.FC<{d: DesignItem; on: boolean; disabled?: boolean; onPick: () => void; onRemove?: () => void}> = ({d, on, disabled, onPick, onRemove}) => {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [d.stamp, d.preview]);
  const [bg, panel, text, ...accents] = d.colors;
  return (
    <button type="button" className={`dz-tile${on ? ' on' : ''}`} disabled={disabled} title={T.designTileTitle(T.designName(d.id, d.name), d.own)} onClick={onPick}>
      {!broken ? (
        <img className="dz-pic" src={`/api/design/preview?id=${encodeURIComponent(d.id)}&v=${d.stamp}`} alt="" onError={() => setBroken(true)} />
      ) : (
        <span className="dz-sw" style={{display: 'block', background: bg}}>
          <i style={{background: panel, borderColor: accents[0] ?? text}} />
          {accents.map((c, i) => (
            <b key={i} style={{left: `${62 + i * 11}%`, background: c}} />
          ))}
        </span>
      )}
      <span className="dz-name">{T.designName(d.id, d.name)}</span>
      {onRemove ? (
        <span
          className="dz-x"
          title={T.designRemove}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          ✕
        </span>
      ) : null}
    </button>
  );
};

/** Loads the designs; while a preview picture is still being rendered, looks again every few seconds. */
const useDesigns = (active: boolean) => {
  const [state, setState] = useState<DesignReply | null>(null);
  const load = useCallback(
    () =>
      fetch('/api/design')
        .then((r) => r.json())
        .then((s: DesignReply) => setState(s))
        .catch(() => undefined),
    [],
  );
  useEffect(() => {
    if (active) load();
  }, [active, load]);
  const waiting = active && !!state?.list.some((d) => !d.preview);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(load, 3000);
    const stop = setTimeout(() => clearInterval(id), 60_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [waiting, load]);
  return {state, setState, load};
};

/** Row of designs for "New presentation": click one to choose it. */
export const DesignChoice: React.FC<{value: string; onChange: (id: string) => void}> = ({value, onChange}) => {
  const {state} = useDesigns(true);
  const list = state?.list ?? [];
  useEffect(() => {
    if (list.length && !list.some((d) => d.id === value)) onChange(list[0].id);
  }, [list, value, onChange]);
  if (!list.length) return null;
  return (
    <>
      <label>{T.designChoose}</label>
      <div className="dz">
        {list.map((d) => (
          <Tile key={d.id} d={d} on={d.id === value} onPick={() => onChange(d.id)} />
        ))}
      </div>
    </>
  );
};

/**
 * Side panel, folded away: "Design: <name>". Opened, it shows the designs to switch to and lets the current one be
 * saved as an own design. Refining a design is done by a task to Claude ("Rebuild slide"), not here.
 */
export const DesignPanel: React.FC<{design: DesignCurrent | undefined; locked: boolean; onChanged: () => void}> = ({design, locked, onChanged}) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const {state, setState, load} = useDesigns(open && !!design?.has);
  if (!design) return null;
  const current = state?.current.has ? state.current : design;
  const label = !design.has ? T.designFixed : `${T.designName(current.id, current.name) || T.designUnnamed}${current.id ? '' : ` · ${T.designAdapted}`}`;

  const run = async (body: object) => {
    setBusy(true);
    try {
      const r = await post(body);
      if (r.error) window.alert(r.error);
      else {
        setState(r);
        if (r.warning) window.alert(r.warning);
      }
      return r;
    } catch {
      window.alert(T.serverDown);
      return null;
    } finally {
      setBusy(false);
    }
  };
  const apply = async (d: DesignItem) => {
    if (d.id === current.id) return;
    // an adapted design exists only in this presentation: say so before it is replaced
    if (!current.id && !window.confirm(T.designReplaceAdapted(T.designName(d.id, d.name)))) return;
    const r = await run({apply: d.id});
    if (r && !r.error) onChanged();
  };
  const save = async () => {
    const name = window.prompt(T.designSavePrompt, current.id ? '' : current.name);
    if (!name?.trim()) return;
    const r = await run({save: name});
    if (r?.exists && window.confirm(T.designOverwrite(name.trim()))) await run({save: name, overwrite: true});
    load();
  };
  const remove = async (d: DesignItem) => {
    if (window.confirm(T.designRemoveConfirm(d.name))) await run({remove: d.id});
  };

  return (
    <details className="libs design" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary>{T.designSummary(label)}</summary>
      {!design.has ? (
        <div className="libs-hint">{T.designFixedHint}</div>
      ) : (
        <>
          <div className="dz">
            {(state?.list ?? []).map((d) => (
              <Tile key={d.id} d={d} on={d.id === current.id} disabled={busy || locked} onPick={() => apply(d)} onRemove={d.own && !busy ? () => remove(d) : undefined} />
            ))}
          </div>
          <div className="dz-row">
            <button disabled={busy} onClick={save}>
              {T.designSave}
            </button>
          </div>
          <div className="libs-hint">{T.designHint}</div>
        </>
      )}
    </details>
  );
};
