import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, PlayerRef} from '@remotion/player';
import {Content, SceneContent, sceneStarts, totalFrames} from './types';
import {Ask, askCss} from './Ask';
import {Rebuild, RebuildState, rebuildCss} from './Rebuild';
import {floatCss} from './float';
import {Create, createCss} from './Create';

const css = `
*{box-sizing:border-box}
body{margin:0;background:#0a0d18;color:#e8ecf8;font:14px -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.app{display:flex;height:100vh}
.stage{flex:1;min-width:0;display:flex;flex-direction:column;padding:16px;gap:12px}
.screen{position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:16/9;max-height:calc(100vh - 150px);cursor:pointer;align-self:center;width:100%}
.screen:fullscreen{border-radius:0;max-height:none;aspect-ratio:auto;width:100vw;height:100vh}
.screen:fullscreen.idle{cursor:none}
.screen,.screen *{user-select:text;-webkit-user-select:text}
.screen ::selection{background:rgba(255,176,32,.55);color:#fff}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{background:#1b2442;color:#e8ecf8;border:1px solid #2e3a63;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}
button:hover{background:#26315a}
button.primary{background:#8b6cff;border-color:#8b6cff;color:#fff;font-weight:600}
.info{color:#9aa6c7;margin-left:auto;font-variant-numeric:tabular-nums;min-width:25em;text-align:right;white-space:nowrap}
.bar .primary{min-width:9.5em}
.bar button{white-space:nowrap}
.bar .fix-stop{width:10.5em}
.bar .fix-rb{width:11em}
.tl{position:relative;height:34px;display:flex;border-radius:8px;overflow:hidden;cursor:pointer;background:#151c33}
.seg{border-right:1px solid #0a0d18;font-size:11px;color:#9aa6c7;padding:9px 4px;white-space:nowrap;overflow:hidden}
.seg.cur{background:#26315a;color:#fff}
.tick{position:absolute;top:0;width:2px;height:100%;background:#ffb020;pointer-events:none}
.head{position:absolute;top:0;width:2px;height:100%;background:#fff;pointer-events:none}
.panel{width:430px;flex-shrink:0;border-left:1px solid #2e3a63;background:#11162a;overflow-y:auto;padding:16px}
.panel h2{font-size:16px;margin:0 0 4px}
.panel h3{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8b6cff;margin:20px 0 8px}
label{display:block;color:#9aa6c7;font-size:12px;margin:10px 0 4px}
textarea,input{width:100%;background:#0a0d18;color:#e8ecf8;border:1px solid #2e3a63;border-radius:8px;padding:8px;font:inherit;resize:vertical}
textarea:focus,input:focus{outline:none;border-color:#8b6cff}
.cap{display:flex;gap:8px;margin-bottom:8px}
.cap input{width:74px;flex-shrink:0;height:36px}
.hint{color:#9aa6c7;font-size:12px;line-height:1.5}
.pres{margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid #2e3a63}
.pres label{margin-top:0}
.pres-rm{margin-top:8px;margin-right:6px;padding:5px 10px;font-size:12px}
select{width:100%;background:#0a0d18;color:#e8ecf8;border:1px solid #2e3a63;border-radius:8px;padding:8px;font:inherit}
.pres-err{color:#f87171;font-size:12px;margin-top:6px;line-height:1.4}
@keyframes jobspin{to{transform:rotate(360deg)}}
.job{position:fixed;left:16px;bottom:16px;z-index:40;display:flex;align-items:center;gap:8px;max-width:min(560px,60vw);
  background:#1b2442;border:2px solid #ffb020;border-radius:999px;padding:8px 14px;box-shadow:0 8px 30px rgba(0,0,0,.6);white-space:nowrap;font-variant-numeric:tabular-nums}
.job-spin{width:14px;height:14px;border-radius:50%;border:2px solid #ffb020;border-top-color:transparent;animation:jobspin 1s linear infinite;flex-shrink:0}
.job-step{color:#9aa6c7;font-family:ui-monospace,Menlo,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis;min-width:0}
.job-done{border-color:#34d399}
.job-x{margin-left:6px;color:#9aa6c7;padding:0 4px}
kbd{background:#1b2442;border:1px solid #2e3a63;border-radius:4px;padding:1px 5px;font:inherit;font-size:11px}
`;

type Presentation = {
  current: string;
  title: string;
  path: string;
  videoUrl: string;
  list: {dir: string; title: string; path: string; linked: boolean}[];
  error?: string;
};

const Area: React.FC<{value: string; onChange: (v: string) => void; rows?: number}> = ({
  value,
  onChange,
  rows,
}) => (
  <textarea
    value={value}
    rows={rows ?? Math.max(1, Math.ceil(value.length / 48))}
    onChange={(e) => onChange(e.target.value)}
  />
);

const App: React.FC = () => {
  const [content, setContent] = useState<Content | null>(null);
  // Die Folien (Video.tsx) kommen aus dem gewählten Inhaltsordner und werden erst zur Laufzeit geladen.
  const [pres, setPres] = useState<Presentation | null>(null);
  const [Video, setVideo] = useState<React.FC<{content: Content}> | null>(null);
  const [presError, setPresError] = useState('');
  useEffect(() => {
    fetch('/api/presentation')
      .then((r) => r.json())
      .then(async (p: Presentation) => {
        setPres(p);
        if (!p.videoUrl) return; // noch keine Präsentation gewählt
        const mod = await import(/* @vite-ignore */ p.videoUrl);
        if (typeof mod.Video !== 'function') throw new Error('src/Video.tsx exportiert keine Komponente „Video“.');
        setVideo(() => mod.Video);
      })
      .catch((e) => setPresError(String(e?.message ?? e)));
  }, []);
  const switchTo = useCallback(async (body: object) => {
    setPresError('');
    const r = await fetch('/api/presentation', {method: 'POST', body: JSON.stringify(body)});
    const p: Presentation = await r.json();
    if (p.error) return setPresError(p.error);
    if (p.current !== pres?.current) location.reload();
    else setPres(p);
  }, [pres]);
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [saved, setSaved] = useState('geladen');
  const [asking, setAsking] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rbDraft, setRbDraft] = useState<{text: string; n: number} | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  creatingRef.current = creating;
  const [rb, setRb] = useState<RebuildState | null>(null);
  // Welchen fertigen Erzeugen-Auftrag man schon zur Kenntnis genommen hat (Startzeit als Kennung).
  const [seen, setSeen] = useState(() => {
    try {
      return localStorage.getItem('create-seen') ?? '';
    } catch {
      return '';
    }
  });
  const markSeen = useCallback(() => {
    const v = String(rb?.startedAt ?? '');
    setSeen(v);
    try {
      localStorage.setItem('create-seen', v);
    } catch {
      // nicht merkbar
    }
  }, [rb]);
  const createDone = rb?.kind === 'create' && !rb.running && !!rb.instruction && String(rb.startedAt) !== seen;
  const jobMark = rb?.running ? '⏳ ' : createDone ? '✓ ' : '';
  const rbWas = useRef(false);
  const [quote, setQuote] = useState('');
  const [sel, setSel] = useState<{text: string; x: number; y: number; above: boolean} | null>(null);
  const [idle, setIdle] = useState(false);
  const hadSel = useRef(false);
  const player = useRef<PlayerRef>(null);
  const screen = useRef<HTMLDivElement>(null);
  const last = useRef(0);
  const playingRef = useRef(false);
  const stopsRef = useRef<number[]>([]);
  const dirty = useRef(false);

  useEffect(() => {
    fetch('/api/content')
      .then((r) => (r.ok ? r.json() : null))
      .then(setContent);
  }, []);

  // Umbau durch Claude Code: Stand abfragen; läuft einer (auch nach dem Neuladen), Fenster zeigen.
  const pollRebuild = useCallback(async () => {
    try {
      const st: RebuildState = await fetch('/api/rebuild').then((r) => r.json());
      setRb(st);
      if (st.running && st.kind !== 'create') setRebuilding(true);
      // Eine neue Präsentation entsteht im Hintergrund; ihr Fenster geht nur beim Fertigwerden von selbst auf.
      if (rbWas.current && !st.running && st.kind === 'create') setCreating(true);
      if (rbWas.current && !st.running && st.kind !== 'create') {
        // fertig: Texte neu vom Server holen, damit der Editor nichts Altes zurückschreibt
        dirty.current = false;
        fetch('/api/content')
          .then((r) => r.json())
          .then(setContent);
      }
      rbWas.current = st.running;
    } catch {
      // Server startet gerade neu
    }
  }, []);
  useEffect(() => {
    pollRebuild();
    const id = setInterval(pollRebuild, 1500);
    return () => clearInterval(id);
  }, [pollRebuild]);
  const rebuildPost = useCallback(
    (body: object) =>
      fetch('/api/rebuild', {method: 'POST', body: JSON.stringify(body)})
        .then((r) => r.json())
        .then((st: RebuildState) => {
          setRb(st);
          rbWas.current = st.running || rbWas.current;
          if (!st.running) pollRebuild();
        }),
    [pollRebuild],
  );

  // Speichern (verzögert), sobald etwas geändert wurde
  useEffect(() => {
    if (!content || !dirty.current) return;
    setSaved('speichert …');
    const id = setTimeout(() => {
      fetch('/api/content', {method: 'POST', body: JSON.stringify(content)})
        .then((r) => setSaved(r.ok ? 'gespeichert' : 'Fehler beim Speichern'))
        .catch(() => setSaved('Fehler beim Speichern'));
    }, 400);
    return () => clearTimeout(id);
  }, [content]);

  const title = content?.title;
  useEffect(() => {
    document.title = `${jobMark}${title ? `${title} – ShowPoint` : 'ShowPoint'}`;
  }, [title, jobMark]);
  const nameOf = (sid: string) => content?.scenes[sid]?.name || sid;

  const starts = useMemo(() => (content ? sceneStarts(content) : []), [content]);
  const total = content ? totalFrames(content) : 1;
  const stops = useMemo(() => {
    if (!content) return [];
    const all = content.order.flatMap((id, i) =>
      content.scenes[id].stops.map((s) => starts[i] + s),
    );
    return [...new Set(all)].filter((s) => s > 0 && s < total).sort((a, b) => a - b);
  }, [content, starts, total]);
  stopsRef.current = stops;

  let idx = 0;
  starts.forEach((s, i) => {
    if (frame >= s) idx = i;
  });

  const ready = content !== null && Video !== null;
  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: {detail: {frame: number}}) => {
      const f = e.detail.frame;
      if (playingRef.current) {
        const hit = stopsRef.current.find((s) => s > last.current && s <= f);
        if (hit !== undefined) {
          p.pause();
          p.seekTo(hit);
          last.current = hit;
          setFrame(hit);
          return;
        }
      }
      last.current = f;
      setFrame(f);
    };
    const onPlay = () => {
      playingRef.current = true;
      setPlaying(true);
    };
    const onPause = () => {
      playingRef.current = false;
      setPlaying(false);
    };
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, [ready]);

  const goto = useCallback((f: number) => {
    const p = player.current;
    if (!p) return;
    p.pause();
    p.seekTo(f);
    last.current = f;
    setFrame(f);
  }, []);

  /** Weiter: läuft bis zum nächsten Haltepunkt. Während es läuft: dorthin springen. */
  const advance = useCallback(() => {
    const p = player.current;
    if (!p) return;
    const cur = p.getCurrentFrame();
    if (playingRef.current) {
      const next = stopsRef.current.find((s) => s > cur);
      if (next !== undefined) goto(next);
    } else {
      last.current = cur;
      p.play();
    }
  }, [goto]);

  const back = useCallback(() => {
    const p = player.current;
    if (!p) return;
    const cur = p.getCurrentFrame();
    const prev = [0, ...stopsRef.current].filter((s) => s < cur);
    goto(prev.length ? prev[prev.length - 1] : 0);
  }, [goto]);

  const edit = useCallback((fn: (c: Content) => void) => {
    dirty.current = true;
    setContent((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }, []);

  const toggleStop = useCallback(() => {
    const p = player.current;
    if (!p || !content) return;
    const cur = p.getCurrentFrame();
    const st = sceneStarts(content);
    let i = 0;
    st.forEach((s, k) => {
      if (cur >= s) i = k;
    });
    const local = cur - st[i];
    if (local < 1) return;
    edit((c) => {
      const sc = c.scenes[c.order[i]];
      sc.stops = sc.stops.includes(local)
        ? sc.stops.filter((s) => s !== local)
        : [...sc.stops, local].sort((a, b) => a - b);
    });
  }, [content, edit]);

  const openAsk = useCallback(() => {
    player.current?.pause();
    setAsking(true);
  }, []);

  /** Markierter Text innerhalb der Folie (oder einer Antwort), sonst leer. */
  const selectedText = useCallback(() => {
    const s = window.getSelection();
    const root = screen.current;
    if (!s || s.isCollapsed || !root || !s.rangeCount) return null;
    const range = s.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return null;
    const text = s.toString().replace(/\s+/g, ' ').trim();
    if (!text) return null;
    const r = range.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    // Knopf unter die Markierung; ist dort kein Platz mehr, darüber.
    const above = r.bottom - box.top + 60 > box.height;
    return {
      text,
      x: Math.min(Math.max(r.left + r.width / 2 - box.left, 90), box.width - 90),
      y: above ? r.top - box.top - 8 : r.bottom - box.top + 8,
      above,
    };
  }, []);

  // Nach dem Markieren erscheint ein Knopf „Dazu fragen“ an der Markierung.
  useEffect(() => {
    const update = () => setTimeout(() => setSel(selectedText()), 0);
    const clear = () => {
      if (window.getSelection()?.isCollapsed) setSel(null);
    };
    document.addEventListener('mouseup', update);
    document.addEventListener('selectionchange', clear);
    return () => {
      document.removeEventListener('mouseup', update);
      document.removeEventListener('selectionchange', clear);
    };
  }, [selectedText]);

  const askAbout = useCallback(
    (text: string) => {
      setQuote(text);
      setSel(null);
      window.getSelection()?.removeAllRanges();
      openAsk();
    },
    [openAsk],
  );

  // Im Vollbild verschwindet der Mauszeiger erst, wenn die Maus ruht.
  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const move = () => {
      setIdle(false);
      clearTimeout(id);
      id = setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mousemove', move);
      clearTimeout(id);
    };
  }, []);

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else screen.current?.requestFullscreen();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        if (e.key === 'Escape') el.blur();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        const cur = selectedText();
        if (cur) askAbout(cur.text);
        else openAsk();
        return;
      }
      if (e.key === 'Escape') {
        setAsking(false);
        setRebuilding(false);
        setCreating(false);
        return;
      }
      if (creatingRef.current) return;
      if ((e.key === 'u' || e.key === 'U') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        player.current?.pause();
        setRebuilding(true);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if ([' ', 'ArrowRight', 'PageDown', 'Enter'].includes(e.key)) {
        e.preventDefault();
        advance();
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        back();
      } else if (e.key === 's' || e.key === 'S') {
        toggleStop();
      } else if (e.key === 'f' || e.key === 'F') {
        fullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back, toggleStop, fullscreen, openAsk, selectedText, askAbout]);

  const chooser = pres ? (
    <div className="pres">
      <label>Präsentation</label>
      <select
        value={pres.current}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') return;
          if (v === '#pick') switchTo({pick: true});
          else if (v === '#path') {
            const p = window.prompt('Pfad zum Ordner der Präsentation (er enthält src/ mit Video.tsx und content.json):');
            if (p) switchTo({path: p});
          } else switchTo({dir: v});
        }}
      >
        {pres.current === '' ? <option value="">– bitte wählen –</option> : null}
        {pres.list.map((q) => (
          <option key={q.dir} value={q.dir} title={q.path}>
            {q.title} — {q.path}
          </option>
        ))}
        <option value="#pick">Anderen Ordner wählen …</option>
        <option value="#path">Pfad eintippen …</option>
      </select>
      {pres.list.find((q) => q.dir === pres.current)?.linked ? (
        <button
          className="pres-rm"
          title="Nimmt diese Präsentation aus der Liste. Ihre Dateien bleiben unverändert an ihrem Ort."
          onClick={() => {
            if (window.confirm(`„${pres.title}“ aus der Liste entfernen?\n\nDie Dateien in ${pres.path} bleiben erhalten. Danach wird wieder der Projektordner gezeigt.`))
              switchTo({remove: pres.current});
          }}
        >
          Aus Liste entfernen
        </button>
      ) : null}
      <button
        className="pres-rm"
        title="Lässt Claude Code eine komplette Präsentation in einem neuen Ordner erzeugen"
        onClick={() => {
          player.current?.pause();
          setCreating(true);
        }}
      >
        {rb?.running && rb.kind === 'create' ? '＋ Präsentation entsteht …' : '＋ Neue Präsentation erzeugen …'}
      </button>
      {presError ? <div className="pres-err">{presError}</div> : null}
    </div>
  ) : null;

  // Dauerhafte Anzeige unten links, solange ein Auftrag läuft oder eine neue Präsentation auf das Öffnen wartet.
  const lastStep = rb?.log.filter((l) => l.kind === 'tool').pop()?.text ?? '';
  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const jobBadge =
    rb?.running && !(rb.kind === 'create' ? creating : rebuilding) ? (
      <button className="job" onClick={() => (rb.kind === 'create' ? setCreating(true) : setRebuilding(true))} title="Klick zeigt das Protokoll">
        <span className="job-spin" />
        <b>{rb.kind === 'create' ? 'Neue Präsentation entsteht' : 'Umbau läuft'}</b> · {mmss(rb.seconds)}
        {lastStep ? <span className="job-step">{lastStep}</span> : null}
      </button>
    ) : createDone && !creating ? (
      <button className="job job-done" onClick={() => setCreating(true)} title="Klick zeigt das Ergebnis und öffnet die Präsentation">
        <b>✓ Neue Präsentation fertig</b> · ansehen
        <span
          className="job-x"
          title="Ausblenden"
          onClick={(e) => {
            e.stopPropagation();
            markSeen();
          }}
        >
          ✕
        </span>
      </button>
    ) : null;

  const createBox = creating ? (
    <Create
      state={rb}
      seen={seen}
      onSeen={markSeen}
      onStarted={(st) => {
        setRb(st);
        rbWas.current = st.running;
      }}
      onOpen={(dir) => {
        markSeen();
        if (dir === pres?.current) location.reload();
        else switchTo({dir});
      }}
      onClose={() => setCreating(false)}
    />
  ) : null;

  if (!content || !Video)
    return (
      <div style={{padding: 30, maxWidth: 640}}>
        <style>{css + askCss + rebuildCss + createCss}</style>
        {createBox}
        {jobBadge}
        {pres && !pres.videoUrl ? (
          <>
            <h2>Präsentator</h2>
            <p className="hint">
              Noch keine Präsentation gewählt. Wähle unten den Ordner einer Präsentation – er enthält
              <code> src/Video.tsx</code> und <code>src/content.json</code> – oder lass eine neue erzeugen.
            </p>
          </>
        ) : presError ? (
          <p className="pres-err">Die Präsentation ließ sich nicht laden: {presError}</p>
        ) : (
          'Lädt …'
        )}
        {chooser}
      </div>
    );

  const id = content.order[idx];
  const sc: SceneContent = content.scenes[id];
  const local = frame - starts[idx];
  const onStop = stops.includes(frame);
  const caption = [...(sc.captions ?? [])].reverse().find((cp) => local >= cp.at)?.text ?? '';
  const scene = (fn: (s: SceneContent) => void) => edit((c) => fn(c.scenes[id]));

  return (
    <div className="app">
      <style>{css + askCss + rebuildCss + floatCss + createCss}</style>
      {createBox}
      {jobBadge}
      <div className="stage">
        <div
          className={`screen${idle ? ' idle' : ''}`}
          ref={screen}
          onMouseDown={() => {
            hadSel.current = !window.getSelection()?.isCollapsed;
          }}
          onClick={() => {
            // Markieren oder Markierung aufheben blättert nicht weiter.
            if (asking || rebuilding || hadSel.current || !window.getSelection()?.isCollapsed) return;
            advance();
          }}
        >
          <Player
            ref={player}
            component={Video}
            inputProps={{content}}
            durationInFrames={total}
            compositionWidth={1920}
            compositionHeight={1080}
            fps={30}
            style={{width: '100%', height: '100%'}}
            clickToPlay={false}
            doubleClickToFullscreen={false}
            spaceKeyToPlayOrPause={false}
          />
          {asking ? (
            <Ask
              key={id}
              sceneId={id}
              sceneName={`${idx + 1} · ${nameOf(id)}`}
              caption={caption}
              quote={quote}
              onClearQuote={() => setQuote('')}
              onClose={() => setAsking(false)}
              onHandover={(text) => {
                setRbDraft((d) => ({text, n: (d?.n ?? 0) + 1}));
                setRebuilding(true);
              }}
            />
          ) : null}
          {rebuilding ? (
            <Rebuild
              sceneId={id}
              sceneName={`${idx + 1} · ${nameOf(id)}`}
              state={rb?.kind === 'create' ? null : rb}
              draft={rbDraft}
              onStart={(instruction) => {
                if (rb?.running) return window.alert('Gerade entsteht eine neue Präsentation. Ein Umbau geht erst, wenn sie fertig ist.');
                rebuildPost({instruction, sceneId: id});
              }}
              onUndo={() => rebuildPost({undo: true}).then(() => {
                dirty.current = false;
                fetch('/api/content')
                  .then((r) => r.json())
                  .then(setContent);
              })}
              onClose={() => setRebuilding(false)}
            />
          ) : null}
          {sel ? (
            <button
              className="selbtn"
              style={{left: sel.x, top: sel.y, transform: `translate(-50%, ${sel.above ? '-100%' : '0'})`}}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                askAbout(sel.text);
              }}
            >
              ? Dazu fragen
            </button>
          ) : null}
        </div>
        <div
          className="tl"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            goto(Math.round(((e.clientX - r.left) / r.width) * (total - 1)));
          }}
        >
          {content.order.map((sid, i) => (
            <div
              key={sid}
              className={`seg${i === idx ? ' cur' : ''}`}
              style={{flex: `${content.scenes[sid].dur} 0 0`}}
            >
              {i + 1} {nameOf(sid)}
            </div>
          ))}
          {stops.map((s) => (
            <div key={s} className="tick" style={{left: `${(s / total) * 100}%`}} />
          ))}
          <div className="head" style={{left: `${(frame / total) * 100}%`}} />
        </div>
        <div className="bar">
          <button onClick={back}>◀ Zurück</button>
          <button className="primary" title="Läuft bis zum nächsten Haltepunkt; während es läuft: direkt dorthin springen" onClick={advance}>
            {playing ? 'Springen ▶▶' : 'Weiter ▶'}
          </button>
          <button className="fix-stop" title="Haltepunkt an dieser Stelle einfügen oder entfernen (S)" onClick={toggleStop}>
            {onStop ? '− Haltepunkt' : '+ Haltepunkt'}
          </button>
          <button onClick={fullscreen}>Vollbild</button>
          <button onClick={openAsk}>? Frage zur Folie</button>
          <button
            className="fix-rb"
            onClick={() => {
              player.current?.pause();
              setRebuilding(true);
            }}
          >
            {rb?.running && rb.kind !== 'create' ? '✎ Umbau läuft …' : '✎ Folie umbauen'}
          </button>
          <span className="info">
            Szene {idx + 1}/{content.order.length} · Bild {local}/{sc.dur} · {saved}
          </span>
        </div>
        <div className="hint">
          Weiter: <kbd>Leertaste</kbd> <kbd>→</kbd> <kbd>Enter</kbd> oder Klick ins Bild ·
          Zurück: <kbd>←</kbd> · Haltepunkt ein/aus: <kbd>S</kbd> · Vollbild: <kbd>F</kbd> · Frage ans LLM: <kbd>?</kbd> (Text vorher markieren = gezielt dazu fragen) · Folie umbauen lassen: <kbd>U</kbd> ·
          gelbe Striche = Haltepunkte · Klick in die Leiste springt dorthin
        </div>
      </div>

      <div className="panel">
        {chooser}
        <h2>
          {idx + 1} · {nameOf(id)}
        </h2>
        <div className="hint">Änderungen erscheinen sofort und werden automatisch gespeichert.</div>

        <label>Kurzname in der Leiste</label>
        <input value={sc.name ?? ''} onChange={(e) => scene((s) => (s.name = e.target.value))} />

        {sc.title !== undefined ? (
          <>
            <h3>Überschrift</h3>
            <label>Dachzeile</label>
            <Area value={sc.kicker ?? ''} onChange={(v) => scene((s) => (s.kicker = v))} />
            <label>Titel</label>
            <Area value={sc.title} onChange={(v) => scene((s) => (s.title = v))} />
          </>
        ) : null}

        {sc.captions?.length ? (
          <>
            <h3>Untertitel (ab Bild · Text)</h3>
            {sc.captions.map((cap, i) => (
              <div className="cap" key={i}>
                <input
                  type="number"
                  value={cap.at}
                  onChange={(e) => scene((s) => (s.captions![i].at = Number(e.target.value) || 0))}
                />
                <Area value={cap.text} onChange={(v) => scene((s) => (s.captions![i].text = v))} />
              </div>
            ))}
          </>
        ) : null}

        {Object.keys(sc.t).length ? <h3>Texte im Bild</h3> : null}
        {Object.entries(sc.t).map(([k, v]) => (
          <div key={k} style={{marginBottom: 8}}>
            <Area value={v} onChange={(nv) => scene((s) => (s.t[k] = nv))} />
          </div>
        ))}

        {Object.entries(sc.lists).map(([k, list]) => (
          <div key={k}>
            <h3>Liste „{k}“ (eine Zeile pro Eintrag)</h3>
            <Area
              rows={list.length + 1}
              value={list.join('\n')}
              onChange={(v) => scene((s) => (s.lists[k] = v.split('\n')))}
            />
          </div>
        ))}

        <h3>Ablauf</h3>
        <label>Dauer der Szene in Bildern (30 pro Sekunde)</label>
        <input
          type="number"
          value={sc.dur}
          onChange={(e) => scene((s) => (s.dur = Math.max(30, Number(e.target.value) || 30)))}
        />
        <label>Haltepunkte (Bildnummern in dieser Szene, mit Komma getrennt)</label>
        <StopsInput
          key={id + sc.stops.join(',')}
          stops={sc.stops}
          onChange={(v) => scene((s) => (s.stops = v))}
        />
      </div>
    </div>
  );
};

const StopsInput: React.FC<{stops: number[]; onChange: (v: number[]) => void}> = ({
  stops,
  onChange,
}) => {
  const [text, setText] = useState(stops.join(', '));
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() =>
        onChange(
          [...new Set(text.split(/[,\s]+/).map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort(
            (a, b) => a - b,
          ),
        )
      }
    />
  );
};

createRoot(document.getElementById('root')!).render(<App />);
