import React, {useEffect, useRef, useState} from 'react';
import {RebuildState, isBad} from './Rebuild';
import {T, lang} from './i18n';
import {useFollowLog} from './float';
import {DesignChoice} from './Design';

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
.cr-prompt{flex:none;height:340px;min-height:120px;resize:vertical;font-family:ui-monospace,Menlo,monospace;font-size:13px;line-height:1.5}
.cr-note{border-left:3px solid #ffb020;background:#151c33;padding:8px 12px;border-radius:0 8px 8px 0;color:#c9d1ec;margin-top:6px}
.cr-note code{color:#ffb020;word-break:break-all}
.cr-foot{display:flex;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid #2e3a63}
.cr-foot .hint{margin-right:auto}
.cr-log{display:flex;flex-direction:column;gap:8px}
.cr-q{color:#ffb020;white-space:pre-wrap;max-height:7.5em;overflow:auto;border-left:3px solid #ffb020;padding-left:10px}
.cr-a{white-space:pre-wrap}
.cr,.cr *{user-select:text;-webkit-user-select:text}
`;

// Drafts are kept per UI language, so the English window starts from the English template.
const DRAFT = lang === 'de' ? 'create-draft' : `create-draft-${lang}`;
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
    // not remembered – no problem
  }
};

/**
 * Create a new presentation: give a folder and a prompt, then Claude Code fills a skeleton on the server.
 * The job keeps running even if this window is closed or the page reloads.
 */
export const Create: React.FC<{
  /** name of the agent chosen in the presenter */
  agentName: string;
  state: RebuildState | null;
  seen: string;
  onSeen: () => void;
  onStarted: (st: RebuildState) => void;
  onOpen: (dir: string) => void;
  onClose: () => void;
}> = ({agentName, state, seen, onSeen, onStarted, onOpen, onClose}) => {
  const log = useFollowLog(state);
  const [template, setTemplate] = useState('');
  const [dir, setDir] = useState('');
  const [prompt, setPrompt] = useState('');
  const [design, setDesign] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/create')
      .then((r) => r.json())
      .then((d: {template: string; parent: string}) => {
        setTemplate(d.template);
        let draft: {dir?: string; prompt?: string; design?: string} = {};
        try {
          draft = JSON.parse(load(DRAFT) ?? '{}');
        } catch {
          // no draft
        }
        setDir(draft.dir || `${d.parent}/`);
        setPrompt(draft.prompt || d.template);
        setDesign(draft.design || '');
      })
      .catch(() => setError(T.templateFailed));
  }, []);
  useEffect(() => {
    if (prompt || dir) store(DRAFT, JSON.stringify({dir, prompt, design}));
  }, [dir, prompt, design]);

  const mine = state?.kind === 'create' && !!state.instruction;
  const showLog = mine && (state!.running || String(state!.startedAt) !== seen);
  const running = mine && state!.running;
  const failed = mine && state!.log.some((l) => l.kind === 'error' || l.kind === 'checkfail');

  const pick = async () => {
    setError('');
    const r = await fetch('/api/create', {method: 'POST', body: JSON.stringify({pick: true})}).then((x) => x.json());
    if (r.error) setError(r.error);
    else if (r.picked) setDir(String(r.picked).replace(/\/$/, ''));
  };
  const start = async () => {
    if (busy) return;
    setError('');
    if (!dir.trim() || dir.trim().endsWith('/')) return setError(T.needFolder);
    if (/<[^<>\n]{3,}>/.test(prompt) && !window.confirm(T.placeholdersLeft)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/create', {method: 'POST', body: JSON.stringify({path: dir.trim(), prompt, design})}).then((x) => x.json());
      if (r.error) setError(r.error);
      else {
        store(DRAFT, JSON.stringify({dir: '', prompt, design}));
        onStarted(r);
      }
    } catch {
      setError(T.serverDown);
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
          {T.createHead} <span>{agentName}</span>
          <button title={T.createClose} onClick={onClose}>
            ✕
          </button>
        </div>
        {showLog ? (
          <>
            <div className="cr-body cr-log" {...log}>
              <div className="hint">{T.folder(state!.createdPath)}</div>
              <div className="cr-q">{state!.instruction}</div>
              {state!.log.map((l, i) =>
                l.kind === 'tool' ? (
                  <div key={i} className="rb-tool">
                    ▸ {l.text}
                  </div>
                ) : (
                  <div key={i} className={`cr-a ${isBad(l) ? 'ask-err' : l.kind === 'check' ? 'rb-ok' : l.kind === 'warn' ? 'rb-warn' : ''}`}>
                    {l.text}
                  </div>
                ),
              )}
              {running ? (
                <div className="ask-dim">{T.createWorking(Math.floor(state!.seconds / 60), state!.seconds % 60)}</div>
              ) : (
                <div className="cr-note">
                  {failed ? T.doneWithNotes : T.done}
                  {T.doneCheck}
                  <br />
                  {T.copyPapers} <code>{quellen(state!.createdPath)}</code> (.pdf, .md, .txt).
                </div>
              )}
            </div>
            <div className="cr-foot">
              <span className="hint">{running ? T.running : ''}</span>
              {!running ? <button onClick={again}>{T.createAnother}</button> : null}
              {!running ? (
                <button className="primary" onClick={() => onOpen(state!.created)}>
                  {T.openPresentation}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="cr-body">
              <label>{T.folderLabel}</label>
              <div className="cr-row">
                <input value={dir} placeholder={T.folderPlaceholder} onChange={(e) => setDir(e.target.value)} />
                <button onClick={pick}>{T.chooseFolder}</button>
              </div>
              <DesignChoice value={design} onChange={setDesign} />
              <label>{T.promptLabel}</label>
              <textarea className="cr-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start();
              }} />
              <div className="cr-note">
                {T.papersNote1} (<code>~/Downloads/paper.pdf</code>) {T.papersNote2}
                <br />
                {T.papersNote3a} <b>{T.papersNote3b}</b> {T.papersNote3c}{' '}
                <code>{dir.trim() && !dir.trim().endsWith('/') ? quellen(dir.trim()) : T.papersFolderFallback}</code> (.pdf, .md, .txt).
                {' '}{T.papersNote4}
              </div>
              {error ? <div className="pres-err">{error}</div> : null}
            </div>
            <div className="cr-foot">
              <span className="hint">{T.createHint}</span>
              <button title={T.reloadTemplateTitle} onClick={() => setPrompt(template)}>
                {T.reloadTemplate}
              </button>
              <button className="primary" onClick={start} disabled={busy || !!state?.running}>
                {state?.running ? T.jobRunning : T.create}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
