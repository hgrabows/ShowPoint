import React, {useEffect, useRef, useState} from 'react';
import {useFloat} from './float';

type Line = {kind: 'text' | 'tool' | 'error' | 'check'; text: string};
export type RebuildState = {running: boolean; kind?: 'rebuild' | 'create'; created: string; createdPath: string; startedAt?: number; id: number; instruction: string; log: Line[]; canUndo: boolean; seconds: number};

export const rebuildCss = `
.rb{left:2.5%;right:auto}
.rb textarea{font-size:1em;min-height:5.5em;max-height:14em}
.rb-tool{color:#9aa6c7;font-size:.85em;font-family:ui-monospace,Menlo,monospace}
.rb-ok{color:#34d399}
.rb .ask-in{flex-wrap:wrap}
`;

/** Auftrag an Claude Code, die Folien umzubauen. Der Auftrag läuft auf dem Server weiter, auch wenn die Seite neu lädt. */
export const Rebuild: React.FC<{
  sceneId: string;
  sceneName: string;
  state: RebuildState | null;
  onStart: (instruction: string) => void;
  onUndo: () => void;
  onClose: () => void;
  /** Vorgefüllter Auftrag, z. B. aus „Frage zur Folie“; n wechselt bei jeder neuen Übergabe. */
  draft?: {text: string; n: number} | null;
}> = ({sceneName, state, onStart, onUndo, onClose, draft}) => {
  const fl = useFloat('rebuild-box', {l: 0.025, t: 0.06, w: 0.46});
  const [text, setText] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const running = !!state?.running;

  useEffect(() => {
    area.current?.focus();
  }, []);
  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    area.current?.focus();
  }, [draft?.n]);
  useEffect(() => {
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [state]);

  const start = () => {
    const t = text.trim();
    if (!t || running) return;
    onStart(t);
    setText('');
  };

  return (
    <div className="ask rb" ref={fl.ref} style={fl.style} onClick={(e) => e.stopPropagation()}>
      <div {...fl.head}>
        Folie umbauen <span>{sceneName} · Claude Code</span>
        <button title="Schließen (Esc) – ein laufender Umbau läuft weiter" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="ask-log" ref={log}>
        {!state?.instruction ? (
          <div className="ask-dim">
            Beschreibe, was an den Folien anders werden soll – Grafik, Aufbau oder Text. Claude Code ändert
            die Dateien in src/, danach lädt die Präsentation neu. Vor jedem Umbau wird der Stand gesichert;
            „Rückgängig“ stellt ihn wieder her. Das dauert meist einige Minuten.
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
                  className={l.kind === 'error' ? 'ask-err ask-a' : l.kind === 'check' ? (/meldet Fehler/.test(l.text) ? 'ask-err ask-a' : 'rb-ok ask-a') : 'ask-a'}
                >
                  {l.text}
                </div>
              ),
            )}
            {running ? <div className="ask-dim">arbeitet … {state.seconds} s</div> : null}
          </>
        )}
      </div>
      <div className="ask-in">
        <textarea
          ref={area}
          value={text}
          disabled={running}
          placeholder={running ? 'Umbau läuft …' : 'Auftrag eingeben, ⌘/Strg + Enter startet'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start();
            if (e.key === 'Escape') onClose();
          }}
        />
        <button className="primary" onClick={start} disabled={running}>
          Umbauen
        </button>
        {state?.canUndo ? <button onClick={onUndo}>Rückgängig</button> : null}
      </div>
      {fl.grip}
    </div>
  );
};
