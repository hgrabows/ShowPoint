import React, {useEffect, useRef, useState} from 'react';
import {useFloat, useFollowLog} from './float';
import {T} from './i18n';

type Turn = {q: string; quote?: string; a: string; thinking: boolean; error?: string; looked?: string[]};

const withQuote = (t: {q: string; quote?: string}) => (t.quote ? T.quoted(t.quote, t.q) : t.q);

export const askCss = `
.ask{position:absolute;right:2.5%;bottom:4%;width:46%;max-height:88%;display:flex;flex-direction:column;
  background:rgba(13,18,36,.97);border:2px solid #8b6cff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.6);
  cursor:default;font-size:clamp(14px,1.25vw,26px);line-height:1.45;color:#e8ecf8}
.ask-head{display:flex;align-items:center;gap:.6em;padding:.6em .9em;border-bottom:1px solid #2e3a63;font-weight:700}
.ask-head{white-space:nowrap}
.ask-head span{color:#9aa6c7;font-weight:400;font-size:.8em;overflow:hidden;text-overflow:ellipsis;min-width:0}
.ask-head button{margin-left:auto;padding:.2em .6em;font-size:.8em}
.ask-log{flex:1;min-height:3em;overflow-y:auto;padding:.7em .9em;display:flex;flex-direction:column;gap:.7em}
.ask-q{color:#ffb020;font-weight:600;white-space:pre-wrap}
.ask-a{white-space:pre-wrap}
.ask,.ask *{user-select:text}
.ask-quote{border-left:3px solid #8b6cff;padding:.1em .6em;color:#c9d1ec;font-style:italic;font-size:.9em;margin:.2em 0}
.ask-pending{display:flex;align-items:flex-start;gap:.5em;padding:.5em .9em 0}
.ask-pending .ask-quote{flex:1;margin:0;max-height:5.5em;overflow:auto}
.ask-pending button{padding:.1em .5em;font-size:.8em}
.ask-head select{width:auto;font-size:.8em;padding:.2em .4em;margin-left:auto}
.ask-head select + button{margin-left:0}
.selbtn{position:absolute;z-index:20;transform:translate(-50%,0);background:#8b6cff;border-color:#8b6cff;color:#fff;font-weight:600;
  font-size:clamp(13px,1.1vw,22px);padding:.35em .7em;white-space:nowrap;box-shadow:0 6px 20px rgba(0,0,0,.5)}
.selbtn:hover{background:#7a5cf0}
.ask-err{color:#f87171}
.ask-dim{color:#9aa6c7}
.ask-web{font-size:.8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ask-src{margin-top:.6em;font-size:.85em}
.ask-in{display:flex;gap:.5em;padding:.6em .9em;border-top:1px solid #2e3a63}
.ask-in .ask-ta{font-size:1em;padding:.5em .7em;min-height:0;resize:none;line-height:1.4;max-height:8em;overflow-y:auto}
.ask-in button{font-size:.9em;white-space:nowrap}
.ask-hand{margin-top:.4em;padding:.15em .6em;font-size:.8em}
`;

export const Ask: React.FC<{
  sceneId: string;
  sceneName: string;
  caption: string;
  quote: string;
  onClearQuote: () => void;
  onClose: () => void;
  /** Hands a suggestion over to “Rebuild slide” as its instruction. */
  onHandover: (instruction: string) => void;
  /** Name of the agent chosen in the presenter (Claude Code or OpenAI Codex); it answers unless the LLM from .env is picked. */
  agentName: string;
  /** the agent is the LLM from .env itself ("custom"): nothing else to choose */
  onlyAgent: boolean;
}> = ({sceneId, sceneName, caption, quote, onClearQuote, onClose, onHandover, agentName, onlyAgent}) => {
  const [provider, setProvider] = useState(() => {
    try {
      return localStorage.getItem('ask-provider') === 'llm' ? 'llm' : 'agent';
    } catch {
      return 'agent';
    }
  });
  const fl = useFloat('ask-box', {l: 0.515, t: 0.06, w: 0.46});
  const [turns, setTurns] = useState<Turn[]>([]);
  const log = useFollowLog(turns);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<{name: string; chars: number; note?: string}[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, [quote]);
  useEffect(() => {
    fetch('/api/sources')
      .then((r) => r.json())
      .then(setSources)
      .catch(() => setSources([]));
  }, []);

  const patchLast = (fn: (t: Turn) => Turn) =>
    setTurns((prev) => prev.map((t, i) => (i === prev.length - 1 ? fn(t) : t)));

  const send = async () => {
    const q = text.trim() || (quote ? T.explainQuote : '');
    if (!q || busy) return;
    const history = turns
      .filter((t) => t.a && !t.error)
      .flatMap((t) => [
        {role: 'user', content: withQuote(t)},
        {role: 'assistant', content: t.a},
      ]);
    setText('');
    setBusy(true);
    setTurns((prev) => [...prev, {q, quote: quote || undefined, a: '', thinking: true}]);
    onClearQuote();
    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        body: JSON.stringify({question: q, quote, provider, sceneId, caption, history}),
      });
      if (!r.ok || !r.body) {
        const msg = await r.text();
        patchLast((t) => ({...t, thinking: false, error: msg || T.errorStatus(r.status)}));
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {stream: true});
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            if (json.error) {
              const msg = typeof json.error === 'string' ? json.error : json.error.message;
              patchLast((t) => ({...t, thinking: false, error: msg}));
            }
            if (json.status) patchLast((t) => ({...t, looked: [...(t.looked ?? []), String(json.status)]}));
            const delta = json.choices?.[0]?.delta;
            if (delta?.content) {
              patchLast((t) => ({...t, thinking: false, a: t.a + delta.content}));
            }
          } catch {
            // incomplete line – ignore
          }
        }
      }
      patchLast((t) => (t.a || t.error ? {...t, thinking: false} : {...t, thinking: false, error: T.noAnswer}));
    } catch (e) {
      patchLast((t) => ({...t, thinking: false, error: String((e as Error).message)}));
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  };

  return (
    <div className="ask" ref={fl.ref} style={fl.style} onClick={(e) => e.stopPropagation()}>
      <div {...fl.head}>
        {T.askHead} <span>{sceneName}</span>
        <select
          value={onlyAgent ? 'agent' : provider}
          title={T.whoAnswers}
          onChange={(e) => {
            setProvider(e.target.value);
            try {
              localStorage.setItem('ask-provider', e.target.value);
            } catch {
              // without storage the choice applies to this dialog only
            }
          }}
        >
          <option value="agent">{agentName}</option>
          {onlyAgent ? null : <option value="llm">{T.llmEnv}</option>}
        </select>
        <button title={T.close} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="ask-log" {...log}>
        {turns.length === 0 ? (
          <div className="ask-dim">
            {T.askIntro}
            <div className="ask-src">
              {sources.length ? T.sources : T.noSources}
              {sources.map((q, i) => (
                <span key={q.name} className={q.note ? 'ask-err' : undefined}>
                  {i ? ' · ' : ''}
                  {q.name} ({T.kChars(Math.round(q.chars / 1000))}{q.note ? `, ${q.note}` : ''})
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {turns.map((t, i) => (
          <div key={i}>
            {t.quote ? <div className="ask-quote">{t.quote}</div> : null}
            <div className="ask-q">{t.q}</div>
            {t.looked?.map((l, k) => (
              <div key={k} className="ask-dim ask-web">
                {l}
              </div>
            ))}
            {t.thinking ? <div className="ask-dim">{T.thinking}</div> : null}
            {t.a ? <div className="ask-a">{t.a}</div> : null}
            {t.a && !t.thinking && !(busy && i === turns.length - 1) ? (
              <button
                className="ask-hand"
                title={T.handoverTitle}
                onClick={() => onHandover(T.handoverText(withQuote(t), t.a))}
              >
                {T.handover}
              </button>
            ) : null}
            {t.error ? <div className="ask-err">{t.error}</div> : null}
          </div>
        ))}
      </div>
      {quote ? (
        <div className="ask-pending">
          <div className="ask-quote">{quote}</div>
          <button title={T.dropQuote} onClick={onClearQuote}>
            ✕
          </button>
        </div>
      ) : null}
      <div className="ask-in">
        <textarea
          ref={input}
          className="ask-ta"
          rows={Math.min(6, text.split('\n').length)}
          value={text}
          placeholder={quote ? T.askPlaceholderQuote : T.askPlaceholder}
          title={T.askInputTitle}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
            if (e.key === 'Escape') onClose();
          }}
        />
        <button className="primary" onClick={send} disabled={busy}>
          {T.askSend}
        </button>
      </div>
      {fl.grip}
    </div>
  );
};
