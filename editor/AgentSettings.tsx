import React, {useEffect, useState} from 'react';
import {T, lang} from './i18n';

/**
 * Model and reasoning effort of the chosen AI, below the AI choice. The lists come from the server (which asks the
 * programs themselves); a choice is written to .env and applies from the next question or task.
 */
type ModelInfo = {id: string; name: string; note?: string; efforts?: string[]};
type Settings = {
  agent: string;
  models: ModelInfo[];
  efforts: string[];
  model: string;
  fragen: string;
  umbau: string;
  shared: boolean;
  fixedModel: boolean;
  defaultModel: string;
  error?: string;
};

export const agentSettingsCss = `
.as{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.as-row{display:flex;align-items:center;gap:8px}
.as-row>span{color:#9aa6c7;font-size:12px;flex:none;width:9.5em;line-height:1.25}
.as-row select{flex:1;min-width:0;padding:6px 8px;font-size:13px}
.as-note{color:#7d89ad;font-size:11.5px;line-height:1.4;margin:-2px 0 2px}
.as h4{margin:6px 0 0;color:#9aa6c7;font-size:12px;font-weight:600}
`;

const post = (body: object) =>
  fetch('/api/agent-settings', {method: 'POST', headers: {'X-Lang': lang}, body: JSON.stringify(body)}).then((r) => r.json() as Promise<Settings>);

export const AgentSettings: React.FC<{agent: string; available: boolean}> = ({agent, available}) => {
  const [s, setS] = useState<Settings | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setS(null);
    setError('');
    if (!available) return;
    let live = true;
    fetch('/api/agent-settings', {headers: {'X-Lang': lang}})
      .then((r) => r.json())
      .then((d: Settings) => live && setS(d))
      .catch(() => live && setError(T.serverDown));
    return () => {
      live = false;
    };
  }, [agent, available]);
  if (!available) return null;
  if (!s) return <div className="as as-note">{error || T.modelsLoading}</div>;

  const save = async (which: string, value: string) => {
    setError('');
    try {
      const d = await post({which, value});
      setS(d);
      if (d.error) setError(T.settingFailed(d.error));
    } catch {
      setError(T.serverDown);
    }
  };
  const note = (m: ModelInfo) => (s.agent === 'claude' ? T.claudeNotes[m.id] : m.note) ?? '';
  const current = s.models.find((m) => m.id === s.model);
  // efforts the chosen model supports (Codex says so per model), otherwise those of the program
  const efforts = current?.efforts?.length ? current.efforts : s.efforts;
  const effortSelect = (which: 'fragen' | 'umbau', value: string) => (
    <select value={value} onChange={(e) => save(which, e.target.value)}>
      <option value="">{T.effortDefault}</option>
      {[...efforts, ...(value && !efforts.includes(value) ? [value] : [])].map((e) => (
        <option key={e} value={e}>
          {T.effortNames[e] ?? e}
        </option>
      ))}
    </select>
  );

  return (
    <div className="as">
      {s.fixedModel ? (
        <div className="as-note">{T.modelCustom(s.model)}</div>
      ) : (
        <>
          <div className="as-row">
            <span>{T.modelLabel}</span>
            <select value={s.model} onChange={(e) => save('model', e.target.value)}>
              <option value="">{T.modelDefault(s.defaultModel)}</option>
              {s.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              {s.model && !current ? <option value={s.model}>{`${s.model} (${T.modelFromEnv})`}</option> : null}
            </select>
          </div>
          {current && note(current) ? <div className="as-note">{note(current)}</div> : null}
          {!s.models.length ? <div className="as-note">{T.modelsNone}</div> : null}
        </>
      )}
      {s.shared ? (
        <div className="as-row">
          <span>{T.effortLabel}</span>
          {effortSelect('fragen', s.fragen)}
        </div>
      ) : (
        <>
          <h4>{T.effortLabel}</h4>
          <div className="as-row">
            <span>{T.effortAsk}</span>
            {effortSelect('fragen', s.fragen)}
          </div>
          <div className="as-row">
            <span>{T.effortBuild}</span>
            {effortSelect('umbau', s.umbau)}
          </div>
        </>
      )}
      <div className="as-note">{T.effortHint}</div>
      {error ? <div className="pres-err">{error}</div> : null}
    </div>
  );
};
