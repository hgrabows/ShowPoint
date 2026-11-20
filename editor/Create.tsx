import React, {useEffect, useRef, useState} from 'react';
import {RebuildState} from './Rebuild';

export const createCss = `
.cr-back{position:fixed;inset:0;z-index:50;background:rgba(5,8,18,.72);display:flex;align-items:center;justify-content:center}
.cr{width:min(920px,94vw);max-height:94vh;display:flex;flex-direction:column;background:#0d1224;border:2px solid #8b6cff;
  border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);font-size:14px;line-height:1.45}
.cr-head{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #2e3a63;font-weight:700;font-size:16px}
.cr-head span{color:#9aa6c7;font-weight:400;font-size:13px}
.cr-head button{margin-left:auto;padding:3px 10px}
.cr-body{padding:14px 16px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;min-height:0}
.cr-body label{margin:6px 0 2px}
.cr-row{display:flex;gap:8px}
.cr-row button{white-space:nowrap}
.cr-prompt{min-height:340px;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5}
.cr-note{border-left:3px solid #ffb020;background:#151c33;padding:8px 12px;border-radius:0 8px 8px 0;color:#c9d1ec;margin-top:6px}
.cr-note code{color:#ffb020;word-break:break-all}
.cr-foot{display:flex;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid #2e3a63}
.cr-foot .hint{margin-right:auto}
.cr-log{display:flex;flex-direction:column;gap:8px}
.cr-q{color:#ffb020;white-space:pre-wrap;max-height:7.5em;overflow:auto;border-left:3px solid #ffb020;padding-left:10px}
.cr-a{white-space:pre-wrap}
.cr,.cr *{user-select:text;-webkit-user-select:text}
`;

const DRAFT = 'create-draft';
const load = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const store = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nicht merkbar – kein Problem
  }
};

/**
 * Neue Präsentation erzeugen: Ordner und Prompt angeben, dann füllt Claude Code auf dem Server ein Gerüst.
 * Der Auftrag läuft weiter, auch wenn dieses Fenster geschlossen oder die Seite neu geladen wird.
 */
export const Create: React.FC<{
  state: RebuildState | null;
  seen: string;
  onSeen: () => void;
  onStarted: (st: RebuildState) => void;
  onOpen: (dir: string) => void;
  onClose: () => void;
}> = ({state, seen, onSeen, onStarted, onOpen, onClose}) => {
  const [template, setTemplate] = useState('');
  const [dir, setDir] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/create')
      .then((r) => r.json())
      .then((d: {template: string; parent: string}) => {
        setTemplate(d.template);
        let draft: {dir?: string; prompt?: string} = {};
        try {
          draft = JSON.parse(load(DRAFT) ?? '{}');
        } catch {
          // kein Entwurf
        }
        setDir(draft.dir || `${d.parent}/`);
        setPrompt(draft.prompt || d.template);
      })
      .catch(() => setError('Die Vorlage ließ sich nicht laden.'));
  }, []);
  useEffect(() => {
    if (prompt || dir) store(DRAFT, JSON.stringify({dir, prompt}));
  }, [dir, prompt]);
  useEffect(() => {
    log.current?.scrollTo(0, log.current.scrollHeight);
  }, [state]);

  const mine = state?.kind === 'create' && !!state.instruction;
  const showLog = mine && (state!.running || String(state!.startedAt) !== seen);
  const running = mine && state!.running;
  const failed = mine && state!.log.some((l) => l.kind === 'error' || (l.kind === 'check' && /^Typprüfung meldet Fehler:/.test(l.text)));

  const pick = async () => {
    setError('');
    const r = await fetch('/api/create', {method: 'POST', body: JSON.stringify({pick: true})}).then((x) => x.json());
    if (r.error) setError(r.error);
    else if (r.picked) setDir(String(r.picked).replace(/\/$/, ''));
  };
  const start = async () => {
    if (busy) return;
    setError('');
    if (!dir.trim() || dir.trim().endsWith('/')) return setError('Bitte den Ordner der neuen Präsentation angeben, z. B. …/Mein-Thema.');
    if (/<[^<>\n]{3,}>/.test(prompt) && !window.confirm('Im Prompt stehen noch Platzhalter in spitzen Klammern (<…>). Trotzdem starten?')) return;
    setBusy(true);
    try {
      const r = await fetch('/api/create', {method: 'POST', body: JSON.stringify({path: dir.trim(), prompt})}).then((x) => x.json());
      if (r.error) setError(r.error);
      else {
        store(DRAFT, JSON.stringify({dir: '', prompt}));
        onStarted(r);
      }
    } catch {
      setError('Der Server ist nicht erreichbar.');
    }
    setBusy(false);
  };
  const again = () => {
    onSeen();
  };

  const quellen = (base: string) => `${base.replace(/\/$/, '')}/quellen`;

  return (
    <div className="cr-back" onClick={(e) => e.stopPropagation()}>
      <div className="cr">
        <div className="cr-head">
          Neue Präsentation erzeugen <span>Claude Code</span>
          <button title="Schließen (Esc) – ein laufender Auftrag läuft weiter" onClick={onClose}>
            ✕
          </button>
        </div>
        {showLog ? (
          <>
            <div className="cr-body cr-log" ref={log}>
              <div className="hint">Ordner: {state!.createdPath}</div>
              <div className="cr-q">{state!.instruction}</div>
              {state!.log.map((l, i) =>
                l.kind === 'tool' ? (
                  <div key={i} className="rb-tool">
                    ▸ {l.text}
                  </div>
                ) : (
                  <div key={i} className={`cr-a ${l.kind === 'error' || (l.kind === 'check' && /meldet Fehler/.test(l.text)) ? 'ask-err' : l.kind === 'check' ? 'rb-ok' : ''}`}>
                    {l.text}
                  </div>
                ),
              )}
              {running ? (
                <div className="ask-dim">
                  arbeitet … {Math.floor(state!.seconds / 60)} min {state!.seconds % 60} s. Eine ganze Präsentation dauert oft 10 bis 20 Minuten.
                  Das Fenster kann zu; der Auftrag läuft weiter, und die bisherige Präsentation bleibt benutzbar.
                </div>
              ) : (
                <div className="cr-note">
                  {failed ? 'Fertig, aber mit Meldungen (siehe oben). ' : 'Fertig. '}
                  Die Folien wurden nicht gerendert oder angesehen – bitte einmal durchklicken; Korrekturen gehen mit „Folie umbauen“.
                  <br />
                  Soll der Präsentator bei Fragen (Taste ?) in den Papers nachlesen, kopiere sie nach <code>{quellen(state!.createdPath)}</code> (.pdf, .md, .txt).
                </div>
              )}
            </div>
            <div className="cr-foot">
              <span className="hint">{running ? 'läuft …' : ''}</span>
              {!running ? <button onClick={again}>Weitere erzeugen …</button> : null}
              {!running ? (
                <button className="primary" onClick={() => onOpen(state!.created)}>
                  Präsentation öffnen
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="cr-body">
              <label>Ordner der neuen Präsentation (neu oder leer; darf irgendwo liegen)</label>
              <div className="cr-row">
                <input value={dir} placeholder="/Pfad/zu/Mein-Thema" onChange={(e) => setDir(e.target.value)} />
                <button onClick={pick}>Ordner wählen …</button>
              </div>
              <label>Prompt (Vorlage aus prompt.txt im Präsentator-Ordner)</label>
              <textarea className="cr-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start();
              }} />
              <div className="cr-note">
                Der Prompt darf auf Papers verweisen: als Dateipfad (<code>~/Downloads/paper.pdf</code>) oder als Link. Claude liest sie beim Erzeugen.
                <br />
                Soll der Präsentator auch <b>während des Vortrags</b> bei Fragen (Taste ?) darin nachlesen, kopiere die Papers zusätzlich nach{' '}
                <code>{dir.trim() && !dir.trim().endsWith('/') ? quellen(dir.trim()) : '<Ordner der Präsentation>/quellen'}</code> (.pdf, .md, .txt).
                Der Ordner wird beim Erzeugen angelegt; Claude legt dort nur eigene Notizen ab.
              </div>
              {error ? <div className="pres-err">{error}</div> : null}
            </div>
            <div className="cr-foot">
              <span className="hint">⌘/Strg + Enter startet · dauert oft 10 bis 20 Minuten</span>
              <button title="Setzt den Prompt auf den Inhalt von prompt.txt zurück" onClick={() => setPrompt(template)}>
                Vorlage neu laden
              </button>
              <button className="primary" onClick={start} disabled={busy || !!state?.running}>
                {state?.running ? 'Es läuft schon ein Auftrag' : 'Erzeugen'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
