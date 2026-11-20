import React, {useEffect, useRef, useState} from 'react';
import {useFloat, useFollowLog} from './float';
import {T} from './i18n';

type Line = {kind: 'text' | 'tool' | 'error' | 'check' | 'checkfail' | 'checkretry'; text: string};
/** Log lines shown in red: errors, failed checks and type errors Claude is asked to fix again. */
export const isBad = (l: Line) => l.kind === 'error' || l.kind === 'checkfail' || l.kind === 'checkretry';
export type RebuildState = {running: boolean; kind?: 'rebuild' | 'create'; created: string; createdPath: string; startedAt?: number; id: number; instruction: string; log: Line[]; canUndo: boolean; seconds: number};

export const rebuildCss = `
.rb{left:2.5%;right:auto}
.rb textarea{font-size:1em;min-height:5.5em;max-height:14em}
.rb-tool{color:#9aa6c7;font-size:.85em;font-family:ui-monospace,Menlo,monospace}
.rb-ok{color:#34d399}
.rb .ask-in{flex-wrap:wrap}
`;

/** Instruction for Claude Code to rebuild slides. The job keeps running on the server even if the page reloads. */
export const Rebuild: React.FC<{
  sceneId: string;
  sceneName: string;
  state: RebuildState | null;
  onStart: (instruction: string) => void;
  onUndo: () => void;
  onClose: () => void;
  /** Prefilled instruction, e.g. from “Ask about slide”; n changes with every new handover. */
  draft?: {text: string; n: number} | null;
}> = ({sceneName, state, onStart, onUndo, onClose, draft}) => {
  const log = useFollowLog(state);
  const fl = useFloat('rebuild-box', {l: 0.025, t: 0.06, w: 0.46});
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const running = !!state?.running;

  useEffect(() => {
    area.current?.focus();
  }, []);
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    area.current?.focus();
  }, [draft?.n]);

  const start = () => {
    const t = text.trim();
    if (!t || running) return;
    onStart(t);
    setText('');
  };

  return (
    <div className="ask rb" ref={fl.ref} style={fl.style} onClick={(e) => e.stopPropagation()}>
      <div {...fl.head}>
        {T.rebuildHead} <span>{sceneName} · Claude Code</span>
        <button title={T.rebuildClose} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="ask-log" {...log}>
        {!state?.instruction ? (
          <div className="ask-dim">
            {T.rebuildIntro}
          </div>
        ) : (
          <>
            <div className="ask-q">{state.instruction}</div>
            {state.log.map((l, i) =>
              l.kind === 'tool' ? (
                <div key={i} className="rb-tool">
                  ▸ {l.text}
                </div>
              ) : (
                <div
                  key={i}
                  className={isBad(l) ? 'ask-err ask-a' : l.kind === 'check' ? 'rb-ok ask-a' : 'ask-a'}
                >
                  {l.text}
                </div>
              ),
            )}
            {running ? <div className="ask-dim">{T.working(state.seconds)}</div> : null}
          </>
        )}
      </div>
      <div className="ask-in">
        <textarea
          ref={area}
          value={text}
          disabled={running}
          placeholder={running ? T.rebuildBusy : T.rebuildPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start();
            if (e.key === 'Escape') onClose();
          }}
        />
        <button className="primary" onClick={start} disabled={running}>
          {T.rebuildStart}
        </button>
        {state?.canUndo ? <button onClick={onUndo}>{T.undo}</button> : null}
      </div>
      {fl.grip}
    </div>
  );
};
