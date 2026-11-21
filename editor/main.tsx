import {T, LangSwitch, langCss} from './i18n';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Player, PlayerRef} from '../runtime';
import {Content, SceneContent, sceneStarts, totalFrames} from './types';
import {Ask, askCss} from './Ask';
import {Rebuild, RebuildState, rebuildCss} from './Rebuild';
import {floatCss} from './float';
import {Create, createCss} from './Create';
import {Slides, slidesCss} from './Slides';

const css = `
*{box-sizing:border-box}
body{margin:0;background:#0a0d18;color:#e8ecf8;font:14px -apple-system,BlinkMacSystemFont,"Helvetica Neue",sans-serif}
.app{display:flex;height:100vh}
.stage{flex:1;min-width:0;display:flex;flex-direction:column;padding:16px;gap:12px}
.screen{position:relative;background:#000;border-radius:10px;overflow:hidden;aspect-ratio:16/9;max-height:calc(100vh - 150px);cursor:pointer;align-self:center;width:100%}
.screen:fullscreen{border-radius:0;max-height:none;aspect-ratio:auto;width:100vw;height:100vh}
.screen:fullscreen.idle{cursor:none}
.run-dot{position:absolute;top:14px;right:14px;opacity:.6;pointer-events:none;z-index:5}
.screen:fullscreen .run-dot{top:22px;right:22px}
.screen,.screen *{user-select:text;-webkit-user-select:text}
.screen ::selection{background:rgba(255,176,32,.55);color:#fff}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
button{background:#1b2442;color:#e8ecf8;border:1px solid #2e3a63;border-radius:8px;padding:8px 12px;font:inherit;cursor:pointer}
button:hover{background:#26315a}
button.primary{background:#8b6cff;border-color:#8b6cff;color:#fff;font-weight:600}
.info{color:#9aa6c7;margin-left:auto;font-variant-numeric:tabular-nums;min-width:31em;text-align:right;white-space:nowrap}
.bar .primary{min-width:9.5em}
.bar button{white-space:nowrap}
.bar .fix-stop{width:10.5em}
.bar .fix-rb{width:11em}
.tl{position:relative;height:34px;display:flex;border-radius:8px;overflow:hidden;cursor:pointer;background:#151c33}
.seg{border-right:1px solid #0a0d18;font-size:11px;color:#9aa6c7;padding:9px 4px;white-space:nowrap;overflow:hidden}
.seg.cur{background:#26315a;color:#fff}
.skip{position:absolute;top:0;height:100%;pointer-events:none;background:repeating-linear-gradient(135deg,rgba(10,13,24,.7) 0 4px,rgba(255,176,32,.18) 4px 8px)}
.sections{display:flex;flex-direction:column;gap:2px;margin:4px 0 10px}
.sec-row{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:6px;background:#151c33;font-size:12px;cursor:pointer}
.sec-row.cur{background:#26315a}
.sec-row.skipped .sec-text{opacity:.5;text-decoration:line-through}
.sec-nr{color:#9aa6c7;min-width:1.4em;text-align:right;font-variant-numeric:tabular-nums}
.sec-range{color:#5d6a92;font-variant-numeric:tabular-nums;white-space:nowrap}
.sec-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#c9d1ec}
.sec-row label{display:flex;align-items:center;gap:4px;margin:0;color:#9aa6c7;white-space:nowrap;cursor:pointer}
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
.libs{margin-top:22px;padding-top:10px;border-top:1px solid #2e3a63;font-size:12px;color:#7d89ad}
.libs summary{cursor:pointer}
.libs-row{display:flex;gap:8px;margin-top:6px;line-height:1.45}
.libs-k{flex:none;width:7.5em;color:#5d6a92}
.libs-warn{color:#ffb020}
.libs-hint{margin-top:6px;color:#5d6a92}
.lic-note{border-left:3px solid #ffb020;background:#1f1a0d;color:#ffd27a;padding:8px 12px;border-radius:0 8px 8px 0;font-size:13px;line-height:1.45}
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
  licenses?: {name: string; version: string; license: string}[];
  packages?: {name: string; version: string; license: string; free: boolean}[];
  builtins?: string[];
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
  // The slides (Video.tsx) come from the chosen content folder and are loaded at runtime.
  const [pres, setPres] = useState<Presentation | null>(null);
  const [Video, setVideo] = useState<React.FC<{content: Content}> | null>(null);
  const [presError, setPresError] = useState('');
  useEffect(() => {
    fetch('/api/presentation')
      .then((r) => r.json())
      .then(async (p: Presentation) => {
        setPres(p);
        if (!p.videoUrl) return; // no presentation chosen yet
        const mod = await import(/* @vite-ignore */ p.videoUrl);
        if (typeof mod.Video !== 'function') throw new Error(T.noVideoExport);
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
  const [saved, setSaved] = useState(T.loaded);
  const [asking, setAsking] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [rbDraft, setRbDraft] = useState<{text: string; n: number} | null>(null);
  const [pdf, setPdf] = useState<{running: boolean; progress: number; file: string; error: string} | null>(null);
  const pdfExport = useCallback(async () => {
    if (pdf?.running) return;
    let st = await fetch('/api/pdf', {method: 'POST'}).then((r) => (r.ok ? r.json() : r.text().then((t) => ({running: false, progress: 0, file: '', error: t}))));
    setPdf(st);
    while (st.running) {
      await new Promise((r) => setTimeout(r, 1000));
      st = await fetch('/api/pdf').then((r) => r.json());
      setPdf(st);
    }
    if (st.error) window.alert(T.pdfFailed(st.error));
    else if (st.file) window.open('/api/pdf/file', '_blank');
  }, [pdf?.running]);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  creatingRef.current = creating;
  const [rb, setRb] = useState<RebuildState | null>(null);
  // Which finished create job has already been acknowledged (start time as id).
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
      // not remembered
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

  // Rebuild by Claude Code: poll the state; if one is running (also after a reload), show its window.
  // The slide being shown (scene id + frame within it). Kept in sessionStorage so a page reload – e.g. when Claude
  // changed slide code during a rebuild – returns to the same slide; restored after content refreshes as well.
  const pos = useRef<{id: string; local: number} | null>(null);
  const restorePending = useRef(false);
  const posKey = () => `showpoint-pos:${pres?.current ?? ''}`;

  // Which running rebuild the user has closed the window of (survives page reloads during the rebuild).
  const closedJob = () => {
    try {
      return sessionStorage.getItem('showpoint-rb-closed') ?? '';
    } catch {
      return '';
    }
  };

  const pollRebuild = useCallback(async () => {
    try {
      const st: RebuildState = await fetch('/api/rebuild').then((r) => r.json());
      setRb(st);
      // A rebuild found running (e.g. after a reload) opens its window once; closed, it stays closed – the badge
      // bottom left shows the progress, and a click on it opens the window again.
      // Not if the user had closed (minimised) the window for this very job – e.g. before Claude changed slide code
      // and the page reloaded.
      if (st.running && !rbWas.current && st.kind !== 'create' && closedJob() !== String(st.id)) setRebuilding(true);
      // A new presentation is created in the background; its window only opens by itself once it is done.
      if (rbWas.current && !st.running && st.kind === 'create') setCreating(true);
      if (rbWas.current && !st.running && st.kind !== 'create') {
        // done: reload the texts from the server so the editor does not write stale content back
        dirty.current = false;
        restorePending.current = true;
        fetch('/api/content')
          .then((r) => r.json())
          .then(setContent);
        // a rebuild may have installed packages: refresh the licence notice
        fetch('/api/presentation')
          .then((r) => r.json())
          .then((p: Presentation) => setPres((old) => (old ? {...old, licenses: p.licenses, packages: p.packages, builtins: p.builtins} : p)));
      }
      rbWas.current = st.running;
    } catch {
      // server is restarting
    }
  }, []);
  useEffect(() => {
    if (!rb?.running || rb.kind === 'create') return;
    try {
      if (rebuilding) sessionStorage.removeItem('showpoint-rb-closed');
      else sessionStorage.setItem('showpoint-rb-closed', String(rb.id));
    } catch {
      // not remembered – the window may open again after a reload
    }
  }, [rebuilding, rb?.running, rb?.id, rb?.kind]);
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

  // Save (debounced) as soon as something changed
  useEffect(() => {
    if (!content || !dirty.current) return;
    setSaved(T.saving);
    const id = setTimeout(() => {
      fetch('/api/content', {method: 'POST', body: JSON.stringify(content)})
        .then((r) => setSaved(r.ok ? T.saved : T.saveError))
        .catch(() => setSaved(T.saveError));
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
  // Sections marked "jump": absolute [start, end) – advancing at their start jumps straight to their end.
  const skips = useMemo(() => {
    if (!content) return [];
    return content.order.flatMap((sid, i) => {
      const sc = content.scenes[sid];
      const bounds = sectionBounds(sc);
      return (sc.skip ?? [])
        .filter((s) => bounds.includes(s) && s < sc.dur)
        .map((s) => ({start: starts[i] + s, end: starts[i] + bounds[bounds.indexOf(s) + 1]}));
    });
  }, [content, starts]);
  const skipsRef = useRef(skips);
  skipsRef.current = skips;

  let idx = 0;
  starts.forEach((s, i) => {
    if (frame >= s) idx = i;
  });

  const ready = content !== null && Video !== null;

  /** Shows the remembered slide again (same frame within it); does nothing if that slide no longer exists. */
  const restorePos = useCallback(() => {
    const p = pos.current;
    const pl = player.current;
    if (!p || !content || !pl) return;
    const i = content.order.indexOf(p.id);
    if (i < 0) return;
    const f = sceneStarts(content)[i] + Math.min(p.local, content.scenes[p.id].dur - 1);
    pl.pause();
    pl.seekTo(f);
    last.current = f;
    setFrame(f);
  }, [content]);

  // remember the current slide (only once the remembered one has been restored after loading)
  const restoredOnLoad = useRef(false);
  useEffect(() => {
    if (!content || !ready || !restoredOnLoad.current || restorePending.current) return;
    const id = content.order[idx];
    if (!id) return;
    pos.current = {id, local: frame - (starts[idx] ?? 0)};
    try {
      sessionStorage.setItem(posKey(), JSON.stringify(pos.current));
    } catch {
      // not remembered – only this page
    }
  }, [frame, idx, content, ready]);

  // after loading the page: back to the remembered slide
  useEffect(() => {
    if (!ready || restoredOnLoad.current) return;
    restoredOnLoad.current = true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(posKey()) ?? 'null');
      if (saved?.id) {
        pos.current = saved;
        restorePos();
      }
    } catch {
      // nothing remembered
    }
  }, [ready, restorePos]);

  // after a rebuild or undo refreshed the texts: stay on the same slide even if durations changed
  useEffect(() => {
    if (!restorePending.current || !content) return;
    restorePending.current = false;
    restorePos();
  }, [content, restorePos]);
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
        // running into a "jump" section that does not start at a stop (e.g. a new slide): straight to its end
        const sk = skipsRef.current.find((k) => f >= k.start && f < k.end);
        if (sk) {
          if (stopsRef.current.includes(sk.end)) p.pause();
          p.seekTo(sk.end);
          last.current = sk.end;
          setFrame(sk.end);
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

  /** Next: plays to the next stop. While playing: jump there. */
  const advance = useCallback(() => {
    const p = player.current;
    if (!p) return;
    const cur = p.getCurrentFrame();
    if (playingRef.current) {
      const next = stopsRef.current.find((s) => s > cur);
      if (next !== undefined) goto(next);
    } else {
      // standing at the start of a "jump" section: show its end at once
      const sk = skipsRef.current.find((k) => cur >= k.start && cur < k.end);
      if (sk) {
        if (stopsRef.current.includes(sk.end)) return goto(sk.end);
        goto(sk.end);
        last.current = sk.end;
        p.play();
        return;
      }
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
      cleanSkip(sc);
    });
  }, [content, edit]);

  /** J: switch "jump" for the section at the current frame (at a stop: the one that comes next). */
  const toggleSkip = useCallback(() => {
    const p = player.current;
    if (!p || !content) return;
    const cur = p.getCurrentFrame();
    const st = sceneStarts(content);
    let i = 0;
    st.forEach((s, k) => {
      if (cur >= s) i = k;
    });
    const local = cur - st[i];
    edit((c) => {
      const sc = c.scenes[c.order[i]];
      const bounds = sectionBounds(sc);
      let k = 0;
      while (k < bounds.length - 2 && local >= bounds[k + 1]) k++;
      const start = bounds[k];
      const skip = (sc.skip ?? []).filter((s) => bounds.includes(s));
      sc.skip = skip.includes(start) ? skip.filter((s) => s !== start) : [...skip, start].sort((a, b) => a - b);
      if (!sc.skip.length) delete sc.skip;
    });
  }, [content, edit]);

  const openAsk = useCallback(() => {
    player.current?.pause();
    setAsking(true);
  }, []);

  /** Marked text inside the slide (or an answer), otherwise null. */
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
    // Button below the selection; if there is no room, above it.
    const above = r.bottom - box.top + 60 > box.height;
    return {
      text,
      x: Math.min(Math.max(r.left + r.width / 2 - box.left, 90), box.width - 90),
      y: above ? r.top - box.top - 8 : r.bottom - box.top + 8,
      above,
    };
  }, []);

  // After marking text, an “ask about this” button appears at the selection.
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

  // In fullscreen the cursor only disappears once the mouse rests.
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
      } else if (e.key === 'j' || e.key === 'J') {
        toggleSkip();
      } else if (e.key === 'f' || e.key === 'F') {
        fullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, back, toggleStop, toggleSkip, fullscreen, openAsk, selectedText, askAbout]);

  const chooser = pres ? (
    <div className="pres">
      <div className="pres-top">
        <label>{T.presentation}</label>
        <LangSwitch />
      </div>
      <select
        value={pres.current}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') return;
          if (v === '#pick') switchTo({pick: true});
          else if (v === '#path') {
            const p = window.prompt(T.pathPrompt);
            if (p) switchTo({path: p});
          } else switchTo({dir: v});
        }}
      >
        {pres.current === '' ? <option value="">{T.pleaseChoose}</option> : null}
        {pres.list.map((q) => (
          <option key={q.dir} value={q.dir} title={q.path}>
            {q.title} — {q.path}
          </option>
        ))}
        <option value="#pick">{T.pickFolder}</option>
        <option value="#path">{T.typePath}</option>
      </select>
      {pres.list.find((q) => q.dir === pres.current)?.linked ? (
        <button
          className="pres-rm"
          title={T.removeTitle}
          onClick={() => {
            if (window.confirm(T.removeConfirm(pres.title, pres.path)))
              switchTo({remove: pres.current});
          }}
        >
          {T.removeFromList}
        </button>
      ) : null}
      <button
        className="pres-rm"
        title={T.createTitle}
        onClick={() => {
          player.current?.pause();
          setCreating(true);
        }}
      >
        {rb?.running && rb.kind === 'create' ? T.createRunning : T.createNew}
      </button>
      {presError ? <div className="pres-err">{presError}</div> : null}
    </div>
  ) : null;

  // Persistent badge bottom left while a job runs or a new presentation waits to be opened.
  const lastStep = rb?.log.filter((l) => l.kind === 'tool').pop()?.text ?? '';
  const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const jobBadge =
    rb?.running && !(rb.kind === 'create' ? creating : rebuilding) ? (
      <button className="job" onClick={() => (rb.kind === 'create' ? setCreating(true) : setRebuilding(true))} title={T.badgeLogTitle}>
        <span className="job-spin" />
        <b>{rb.kind === 'create' ? T.badgeCreating : T.badgeRebuilding}</b> · {mmss(rb.seconds)}
        {lastStep ? <span className="job-step">{lastStep}</span> : null}
      </button>
    ) : createDone && !creating ? (
      <button className="job job-done" onClick={() => setCreating(true)} title={T.badgeDoneTitle}>
        <b>{T.badgeDone}</b> · {T.badgeView}
        <span
          className="job-x"
          title={T.hide}
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
        <style>{css + askCss + rebuildCss + createCss + langCss}</style>
        {createBox}
        {jobBadge}
        {pres && !pres.videoUrl ? (
          <>
            <h2>ShowPoint</h2>
            <p className="hint">{T.noPresentation}</p>
          </>
        ) : presError ? (
          <p className="pres-err">{T.loadFailed(presError)}</p>
        ) : (
          T.loading
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
      <style>{css + askCss + rebuildCss + floatCss + createCss + langCss + slidesCss}</style>
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
            // Marking text or clearing a selection does not advance.
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
          />
          {playing ? <RunDot frame={frame} stops={stops} total={total} /> : null}
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
              state={rb?.kind === 'create' || rb?.presentation !== pres?.path ? null : rb}
              draft={rbDraft}
              onStart={(instruction) => {
                if (rb?.running) return window.alert(T.createBusy);
                rebuildPost({instruction, sceneId: id, frame: local});
              }}
              onUndo={() => rebuildPost({undo: true}).then(() => {
                dirty.current = false;
                restorePending.current = true;
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
              {T.askAbout}
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
          {skips.map((k) => (
            <div key={`j${k.start}`} className="skip" title={T.skipTitle} style={{left: `${(k.start / total) * 100}%`, width: `${((k.end - k.start) / total) * 100}%`}} />
          ))}
          {stops.map((s) => (
            <div key={s} className="tick" style={{left: `${(s / total) * 100}%`}} />
          ))}
          <div className="head" style={{left: `${(frame / total) * 100}%`}} />
        </div>
        <div className="bar">
          <button onClick={back}>{T.back}</button>
          <button className="primary" title={T.nextTitle} onClick={advance}>
            {playing ? T.jump : T.next}
          </button>
          <button className="fix-stop" title={T.stopTitle} onClick={toggleStop}>
            {onStop ? T.stopRemove : T.stopAdd}
          </button>
          <button onClick={fullscreen}>{T.fullscreen}</button>
          <button
            onClick={pdfExport}
            disabled={pdf?.running}
            title={T.pdfTitle}
          >
            {pdf?.running ? `PDF … ${pdf.progress} %` : '⤓ PDF'}
          </button>
          <button onClick={openAsk}>{T.askSlide}</button>
          <button
            className="fix-rb"
            onClick={() => {
              player.current?.pause();
              setRebuilding(true);
            }}
          >
            {rb?.running && rb.kind !== 'create' ? T.rebuildRunning : T.rebuildSlide}
          </button>
          <span className="info">
            {T.info(idx + 1, content.order.length, ...sectionOf(sc, local), local, sc.dur, saved)}
          </span>
        </div>
        <div className="hint">{T.keys}</div>
        {pres?.licenses?.length ? (
          <div className="lic-note" title={pres.licenses.map((l) => `${l.name}@${l.version}: ${l.license}`).join('\n')}>
            {T.licenseNote(pres.licenses.map((l) => l.name).join(', '))}
          </div>
        ) : null}
      </div>

      <div className="panel">
        {chooser}
        <Slides
          order={content.order}
          current={id}
          nameOf={nameOf}
          durOf={(sid) => content.scenes[sid].dur}
          onJump={(sid) => goto(starts[content.order.indexOf(sid)] + midOf(content.scenes[sid]))}
          removed={Object.keys(content.scenes).filter((sid) => !content.order.includes(sid))}
          onRemove={(sid) => {
            const i = content.order.indexOf(sid);
            const next = content.order.filter((x) => x !== sid);
            const startOf = (sid2: string) => next.slice(0, next.indexOf(sid2)).reduce((a, x) => a + content.scenes[x].dur, 0);
            edit((c) => {
              c.order = next;
              c.removed = [...(c.removed ?? []).filter((r) => r.id !== sid), {id: sid, after: i > 0 ? content.order[i - 1] : null}];
            });
            // removed the slide being shown: show the one that takes its place; otherwise stay where we are
            if (sid === id) {
              const take = next[Math.min(i, next.length - 1)];
              goto(startOf(take) + midOf(content.scenes[take]));
            }
            else goto(startOf(id) + local);
          }}
          onRestore={(sid) => {
            const hint = content.removed?.find((r) => r.id === sid);
            const next = [...content.order];
            const at = hint?.after === null ? 0 : hint && next.includes(hint.after) ? next.indexOf(hint.after) + 1 : next.length;
            next.splice(at, 0, sid);
            edit((c) => {
              c.order = next;
              c.removed = (c.removed ?? []).filter((r) => r.id !== sid);
              if (!c.removed.length) delete c.removed;
            });
            goto(next.slice(0, next.indexOf(sid)).reduce((a, x) => a + content.scenes[x].dur, 0) + midOf(content.scenes[sid]));
          }}
          onReorder={(next) => {
            // keep showing the same slide at the same point after the move
            const start = next.slice(0, next.indexOf(id)).reduce((a, sid) => a + content.scenes[sid].dur, 0);
            edit((c) => {
              c.order = next;
            });
            goto(start + local);
          }}
        />
        <h2>
          {idx + 1} · {nameOf(id)}
        </h2>
        <div className="hint">{T.liveEdit}</div>

        <label>{T.shortName}</label>
        <input value={sc.name ?? ''} onChange={(e) => scene((s) => (s.name = e.target.value))} />

        {sc.title !== undefined ? (
          <>
            <h3>{T.heading}</h3>
            <label>{T.kicker}</label>
            <Area value={sc.kicker ?? ''} onChange={(v) => scene((s) => (s.kicker = v))} />
            <label>{T.title}</label>
            <Area value={sc.title} onChange={(v) => scene((s) => (s.title = v))} />
          </>
        ) : null}

        {sc.captions?.length ? (
          <>
            <h3>{T.captions}</h3>
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

        {Object.keys(sc.t).length ? <h3>{T.texts}</h3> : null}
        {Object.entries(sc.t).map(([k, v]) => (
          <div key={k} style={{marginBottom: 8}}>
            <Area value={v} onChange={(nv) => scene((s) => (s.t[k] = nv))} />
          </div>
        ))}

        {Object.entries(sc.lists).map(([k, list]) => (
          <div key={k}>
            <h3>{T.listHead(k)}</h3>
            <Area
              rows={list.length + 1}
              value={list.join('\n')}
              onChange={(v) => scene((s) => (s.lists[k] = v.split('\n')))}
            />
          </div>
        ))}

        <h3>{T.timing}</h3>
        <label>{T.durLabel}</label>
        <input
          type="number"
          value={sc.dur}
          onChange={(e) => scene((s) => (s.dur = Math.max(30, Number(e.target.value) || 30)))}
        />
        <label>{T.stopsLabel}</label>
        <StopsInput
          key={id + sc.stops.join(',')}
          stops={sc.stops}
          onChange={(v) => scene((s) => {
            s.stops = v;
            cleanSkip(s);
          })}
        />
        <label>{T.sectionsLabel}</label>
        <div className="sections">
          {sectionBounds(sc).slice(0, -1).map((b, k) => {
            const end = sectionBounds(sc)[k + 1];
            const on = (sc.skip ?? []).includes(b);
            const cap = [...(sc.captions ?? [])].filter((c) => c.at <= Math.max(b, end - 1) && c.at < end).pop();
            return (
              <div
                key={b}
                className={`sec-row${sectionOf(sc, local)[0] === k + 1 ? ' cur' : ''}${on ? ' skipped' : ''}`}
                title={T.sectionRowTitle}
                onClick={() => goto((starts[idx] ?? 0) + b)}
              >
                <span className="sec-nr">{k + 1}</span>
                <span className="sec-range">{b}–{end}</span>
                <span className="sec-text">{cap?.text ?? ''}</span>
                <label onClick={(e) => e.stopPropagation()} title={T.skipTitle}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      scene((s) => {
                        const skip = (s.skip ?? []).filter((x) => sectionBounds(s).includes(x));
                        s.skip = on ? skip.filter((x) => x !== b) : [...skip, b].sort((x, y) => x - y);
                        if (!s.skip.length) delete s.skip;
                      })
                    }
                  />
                  {T.skipLabel}
                </label>
              </div>
            );
          })}
        </div>
        <Libraries builtins={pres?.builtins ?? []} packages={pres?.packages ?? []} />
      </div>
    </div>
  );
};

/** Start frames of a slide's sections plus its end: [0, stop1, stop2, …, dur]. */
const sectionBounds = (sc: SceneContent) => [0, ...[...new Set(sc.stops.filter((s) => s > 0 && s < sc.dur))].sort((a, b) => a - b), sc.dur];

/** Drop "jump" marks whose section no longer exists (its stop was removed). */
const cleanSkip = (sc: SceneContent) => {
  if (!sc.skip) return;
  const bounds = sectionBounds(sc);
  sc.skip = sc.skip.filter((s) => bounds.includes(s) && s < sc.dur);
  if (!sc.skip.length) delete sc.skip;
};

/**
 * Section of a slide = stretch between two of its stops, counted from 1. Paused exactly at a stop, it is the
 * section that has just played up to it (the same rule the rebuild uses when it tells Claude the position).
 */
const sectionOf = (sc: SceneContent, local: number): [number, number] => {
  const stops = [...new Set(sc.stops.filter((s) => s > 0 && s < sc.dur))].sort((a, b) => a - b);
  const bounds = [0, ...stops, sc.dur];
  const n = bounds.length - 1;
  const at = stops.indexOf(local);
  if (at >= 0) return [at + 1, n];
  let k = 0;
  while (k < n - 1 && local >= bounds[k + 1]) k++;
  return [k + 1, n];
};

/**
 * Small mark top right while the animation runs, only in the presenter (not in PDF or video): a dot with a thin ring
 * that fills up until the next stop. No mark = standing at a stop, the next key press starts the next step.
 */
const RunDot: React.FC<{frame: number; stops: number[]; total: number}> = ({frame, stops, total}) => {
  const prev = [0, ...stops].filter((s) => s <= frame).pop() ?? 0;
  const next = stops.find((s) => s > frame) ?? total - 1;
  const p = Math.max(0, Math.min(1, (frame - prev) / Math.max(1, next - prev)));
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg className="run-dot" width={24} height={24} viewBox="0 0 24 24" aria-hidden>
      <circle cx={12} cy={12} r={r} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={2} />
      <circle cx={12} cy={12} r={r} fill="none" stroke="#ffb020" strokeWidth={2} strokeDasharray={`${c * p} ${c}`} transform="rotate(-90 12 12)" />
      <circle cx={12} cy={12} r={3.5} fill="#ffb020" />
    </svg>
  );
};

/** Bottom of the side panel, unobtrusive: which libraries the slides really use (built in and installed). */
const Libraries: React.FC<{builtins: string[]; packages: NonNullable<Presentation['packages']>}> = ({builtins, packages}) => {
  if (!builtins.length && !packages.length) return null;
  return (
    <details className="libs">
      <summary>{T.libsSummary(builtins.length + packages.length)}</summary>
      {builtins.length ? (
        <div className="libs-row">
          <span className="libs-k">{T.libsBuiltin}</span>
          <span>{builtins.map((b) => T.builtinName[b as keyof typeof T.builtinName] ?? b).join(', ')}</span>
        </div>
      ) : null}
      {packages.length ? (
        <div className="libs-row">
          <span className="libs-k">{T.libsInstalled}</span>
          <span>
            {packages.map((p, i) => (
              <React.Fragment key={p.name}>
                {i ? ', ' : ''}
                <span title={p.license} className={p.free ? '' : 'libs-warn'}>
                  {p.free ? '' : '⚠ '}
                  {p.name} {p.version}
                </span>
              </React.Fragment>
            ))}
          </span>
        </div>
      ) : null}
      <div className="libs-hint">{T.libsHint}</div>
    </details>
  );
};

/**
 * Where to show a slide when jumping to it: not its (often still empty) first frame, but the stop closest to its
 * middle, so “Next” continues from there; without stops, the middle frame.
 */
const midOf = (sc: SceneContent) => {
  const mid = sc.dur / 2;
  const inner = sc.stops.filter((s) => s > 0 && s < sc.dur);
  return inner.length ? inner.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a)) : Math.floor(mid);
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
