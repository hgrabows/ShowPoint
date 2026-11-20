import {execFile, execFileSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {defineConfig} from 'vite';

const root = process.cwd();

const readEnv = (): Record<string, string> => {
  const p = path.resolve(root, '.env');
  if (!fs.existsSync(p)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(p, 'utf8')
      .split('\n')
      .map((l) => l.match(/^([A-Z_]+)=(.*)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2].trim()]),
  );
};

// Der Inhalt (Folien, Texte, Quellen) liegt getrennt vom Präsentator in einem Ordner mit src/ und quellen/.
// Welcher Ordner gezeigt wird, lässt sich im Präsentator wählen („Präsentation“); die Wahl steht als INHALT in .env.
// „.“ ist der Projektordner selbst, sonst ein Ordner unter inhalte/. Ordner von anderswo werden dort als
// Verknüpfung eingehängt, damit sie die installierten Pakete des Projekts finden.
const linksDir = path.join(root, 'inhalte');
const isPresentation = (dir: string) =>
  fs.existsSync(path.join(dir, 'src', 'content.json')) && fs.existsSync(path.join(dir, 'src', 'Video.tsx'));
const titleOf = (dir: string) => {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8')).title || '') || path.basename(dir);
  } catch {
    return path.basename(dir);
  }
};
const real = (p: string) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

// '' = keine Präsentation gewählt (der Präsentator zeigt dann nur die Auswahl).
const fallback = () => (isPresentation(root) ? '.' : '');
let inhaltRel = (process.env.INHALT || readEnv().INHALT || '').replace(/\/+$/, '');
if (!inhaltRel || !isPresentation(path.resolve(root, inhaltRel))) {
  if (inhaltRel) console.warn(`INHALT=${inhaltRel} enthält keine Präsentation (src/Video.tsx und src/content.json).`);
  inhaltRel = fallback();
}
const hasInhalt = () => inhaltRel !== '' && isPresentation(path.resolve(root, inhaltRel));
const inhaltDir = () => path.resolve(root, inhaltRel);
const inhaltSrc = () => path.join(inhaltDir(), 'src');
const contentFile = () => path.join(inhaltSrc(), 'content.json');
const quellenDir = () => path.join(inhaltDir(), 'quellen');
const rel = (p: string) => path.relative(root, p) || '.';

const isLink = (p: string) => {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};

/** Nimmt eine eingehängte Präsentation aus der Liste: löscht nur die Verknüpfung, nie die Dateien. */
function removePresentation(dir: string) {
  const target = path.resolve(root, dir);
  if (path.dirname(target) !== linksDir || !isLink(target)) {
    throw new Error('Entfernen geht nur bei eingehängten Ordnern. Der Projektordner und echte Ordner unter inhalte/ bleiben.');
  }
  const wasCurrent = rel(target) === inhaltRel;
  fs.unlinkSync(target);
  if (wasCurrent) {
    inhaltRel = fallback();
    saveChoice();
  }
}

const listPresentations = () => {
  const dirs = ['.'];
  if (fs.existsSync(linksDir)) {
    for (const n of fs.readdirSync(linksDir).sort()) if (!n.startsWith('.')) dirs.push(path.join('inhalte', n));
  }
  return dirs
    .filter((d) => isPresentation(path.resolve(root, d)))
    .map((d) => {
      const abs = path.resolve(root, d);
      return {dir: d, title: titleOf(abs), path: real(abs), linked: isLink(abs)};
    });
};

const saveChoice = () => {
  const p = path.resolve(root, '.env');
  const text = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  const line = `INHALT=${inhaltRel}`;
  fs.writeFileSync(p, /^INHALT=.*$/m.test(text) ? text.replace(/^INHALT=.*$/m, line) : `${text.replace(/\n*$/, '\n')}${line}\n`);
};

const expandHome = (p: string) => p.replace(/^~(?=\/|$)/, process.env.HOME ?? '~');

/** Hängt einen Ordner von außerhalb als Verknüpfung unter inhalte/ ein und liefert deren Pfad. */
function linkFolder(r: string) {
  fs.mkdirSync(linksDir, {recursive: true});
  const base = path.basename(r).replace(/[^\w.-]+/g, '-') || 'praesentation';
  let name = base;
  for (let n = 2; fs.existsSync(path.join(linksDir, name)) || isLink(path.join(linksDir, name)); n++) name = `${base}-${n}`;
  fs.symlinkSync(r, path.join(linksDir, name), 'dir');
  return path.join(linksDir, name);
}

/** Wählt eine Präsentation: einen Eintrag der Liste (dir) oder einen beliebigen Ordner (abs). */
function choosePresentation(sel: {dir?: string; abs?: string}) {
  let target: string;
  if (sel.dir !== undefined) {
    target = path.resolve(root, sel.dir);
    if (target !== root && path.dirname(target) !== linksDir) throw new Error('Unbekannte Präsentation.');
  } else {
    let abs = path.resolve(expandHome(String(sel.abs ?? '').trim()));
    if (!isPresentation(abs) && path.basename(abs) === 'src' && isPresentation(path.dirname(abs))) abs = path.dirname(abs);
    if (!isPresentation(abs)) throw new Error(`In ${abs} liegt keine Präsentation: Es fehlen src/Video.tsx und src/content.json.`);
    const r = real(abs);
    const known = listPresentations().find((q) => q.path === r);
    if (known) target = path.resolve(root, known.dir);
    else if (r === root || r.startsWith(root + path.sep)) throw new Error('Ordner innerhalb des Präsentator-Ordners bitte unter inhalte/ ablegen.');
    else target = linkFolder(r); // von außerhalb: als Verknüpfung unter inhalte/ einhängen
  }
  if (!isPresentation(target)) throw new Error('Dort liegt keine Präsentation (src/Video.tsx und src/content.json fehlen).');
  inhaltRel = rel(target);
  saveChoice();
}

/** macOS: Ordner-Dialog des Systems öffnen; liefert den gewählten Pfad oder '' bei Abbruch. */
const pickFolder = (prompt = 'Ordner der Präsentation wählen (enthält src/)') =>
  new Promise<string>((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to activate', '-e', `POSIX path of (choose folder with prompt "${prompt}")`],
      {timeout: 300_000},
      (err, stdout, stderr) => {
        if (!err) return resolve(String(stdout).trim());
        if (/-128/.test(String(stderr))) return resolve(''); // abgebrochen
        reject(new Error('Der Ordner-Dialog ließ sich nicht öffnen; Pfad bitte eintippen.'));
      },
    );
  });

const presentationInfo = () => ({
  current: hasInhalt() ? inhaltRel : '',
  title: hasInhalt() ? titleOf(inhaltDir()) : '',
  path: hasInhalt() ? real(inhaltDir()) : '',
  videoUrl: hasInhalt() ? `/@fs${path.join(inhaltSrc(), 'Video.tsx')}` : '',
  list: listPresentations(),
});

const readOptional = (name: string) => {
  const p = path.join(inhaltSrc(), name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
};

const SYSTEM = `Du hilfst bei einer Präsentation. Jemand stellt eine Frage zur gerade gezeigten Folie.
Antworte knapp und in der Sprache der Frage. Stütze dich auf die Folie und die Quellen unten. Schlage Details und Zahlen dort nach. Was dort nicht steht, kennzeichne als allgemeines Wissen oder sag, dass die Quellen es nicht hergeben. Erfinde keine Zahlen.
Schreibe Fließtext ohne Markdown-Formatierung.`;

// Zusatz-Quellen: alle .md/.txt/.pdf im Ordner quellen/ gehen als Text an das Modell (PDF über pdftotext).
const BUDGET = 600_000; // Zeichen insgesamt

type Source = {name: string; chars: number; used: number; note?: string; text: string};

function readSources(): Source[] {
  if (!hasInhalt()) return [];
  if (!fs.existsSync(quellenDir())) return [];
  let left = BUDGET;
  return fs
    .readdirSync(quellenDir())
    .filter((n) => /\.(md|txt|pdf)$/i.test(n) && !n.startsWith('.'))
    .sort()
    .map((name) => {
      const p = path.join(quellenDir(), name);
      let text = '';
      let note: string | undefined;
      try {
        if (/\.pdf$/i.test(name)) {
          const cache = path.join(quellenDir(), '.cache', `${name}.txt`);
          if (!fs.existsSync(cache) || fs.statSync(cache).mtimeMs < fs.statSync(p).mtimeMs) {
            fs.mkdirSync(path.dirname(cache), {recursive: true});
            execFileSync('pdftotext', ['-q', p, cache]);
          }
          text = fs.readFileSync(cache, 'utf8');
        } else {
          text = fs.readFileSync(p, 'utf8');
        }
      } catch (e) {
        note = /\.pdf$/i.test(name) ? 'PDF nicht lesbar (pdftotext fehlt?)' : 'nicht lesbar';
      }
      const used = Math.min(text.length, left);
      left -= used;
      if (!note && used < text.length) note = used ? 'gekürzt, Gesamtgrenze erreicht' : 'ausgelassen, Gesamtgrenze erreicht';
      return {name, chars: text.length, used, note, text: text.slice(0, used)};
    });
}

type AskBody = {
  question: string;
  sceneId: string;
  caption?: string;
  quote?: string;
  provider?: string;
  history?: {role: string; content: string}[];
};

const sse = (res: import('node:http').ServerResponse, obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

/** Antwort von Claude Code (Befehl `claude`, Anmeldung über das Abo – kein API-Schlüssel nötig). */
function askClaude(
  system: string,
  history: {role: string; content: string}[],
  question: string,
  res: import('node:http').ServerResponse,
) {
  const fileEnv = readEnv();
  // Variablen einer umgebenden Claude-Sitzung nicht weiterreichen, sonst greift deren Anmeldung nicht.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)));
  const prompt = [
    ...history.map((m) => `${m.role === 'user' ? 'Frühere Frage' : 'Deine frühere Antwort'}: ${m.content}`),
    history.length ? `Neue Frage: ${question}` : question,
  ].join('\n\n');
  const child = spawn(
    'claude',
    ['-p', '--model', fileEnv.CLAUDE_MODEL || 'sonnet', '--system-prompt', system, '--tools', '', '--strict-mcp-config',
      '--no-session-persistence', '--output-format', 'stream-json', '--include-partial-messages', '--verbose'],
    {cwd: os.tmpdir(), env},
  );
  res.setHeader('Content-Type', 'text/event-stream');
  let buf = '';
  let got = false;
  let failed = false;
  const fail = (msg: string) => {
    if (failed) return;
    failed = true;
    const hint = /authenticat|log ?in|oauth/i.test(msg)
      ? ' – Claude Code ist nicht angemeldet: im Terminal „claude“ starten und dort /login ausführen.'
      : '';
    sse(res, {error: `Claude Code: ${msg.slice(0, 300)}${hint}`});
  };
  child.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        const delta = ev.type === 'stream_event' ? ev.event?.delta : null;
        if (delta?.type === 'text_delta' && delta.text) {
          got = true;
          sse(res, {choices: [{delta: {content: delta.text}}]});
        } else if (ev.type === 'result' && ev.is_error) {
          fail(String(ev.result ?? 'unbekannter Fehler'));
        }
      } catch {
        // keine JSON-Zeile – ignorieren
      }
    }
  });
  let err = '';
  child.stderr.on('data', (d) => (err += d));
  child.on('error', (e) => {
    fail((e as NodeJS.ErrnoException).code === 'ENOENT' ? 'Befehl „claude“ nicht gefunden.' : e.message);
    res.end();
  });
  child.on('close', (code) => {
    if (!got && code !== 0) fail(err.trim() || `beendet mit Code ${code}`);
    res.end();
  });
  res.on('close', () => child.kill());
  child.stdin.end(prompt);
}

async function ask(body: AskBody, res: import('node:http').ServerResponse) {
  if (!hasInhalt()) throw new Error('Keine Präsentation gewählt.');
  const env = readEnv();
  const content = JSON.parse(fs.readFileSync(contentFile(), 'utf8'));
  const sc = content.scenes[body.sceneId];
  const nr = content.order.indexOf(body.sceneId) + 1;
  const notes = readSources()
    .filter((q) => q.used)
    .map((q) => `## Quelle: ${q.name}\n${q.text}`)
    .join('\n\n');
  const outline = content.order
    .map((id: string, i: number) => `${i + 1}. ${content.scenes[id].title ?? id}`)
    .join('\n');
  const slide = [
    `Folie ${nr} von ${content.order.length}`,
    sc?.kicker ? `Dachzeile: ${sc.kicker}` : '',
    sc?.title ? `Titel: ${sc.title}` : '',
    sc?.captions?.length ? `Sprechtext der Folie:\n${sc.captions.map((c: {text: string}) => `- ${c.text}`).join('\n')}` : '',
    body.caption ? `Gerade eingeblendet: ${body.caption}` : '',
    sc ? `Beschriftungen im Bild:\n${Object.values(sc.t).map((t) => `- ${t}`).join('\n')}` : '',
    ...Object.values(sc?.lists ?? {}).map((l) => (l as string[]).map((x) => `- ${x}`).join('\n')),
  ]
    .filter(Boolean)
    .join('\n');
  const extra = readOptional('begleittext.md');
  const system = `${SYSTEM}${extra ? `\n\n## Zu dieser Präsentation\n${extra}` : ''}\n\n## Aufbau der Präsentation\n${outline}\n\n## Aktuelle Folie\n${slide}\n\n${notes}`;
  const history = (body.history ?? []).slice(-8);
  const quote = String(body.quote ?? '').trim().slice(0, 1500);
  const question =
    (quote ? `Markierte Stelle, auf die sich die Frage bezieht:\n„${quote}“\n\n` : '') +
    String(body.question).slice(0, 2000);
  if (body.provider === 'claude') return askClaude(system, history, question, res);
  if (!env.LLM_BASE_URL || !env.LLM_API_KEY || !env.LLM_MODEL) {
    res.statusCode = 500;
    return res.end('In .env fehlen LLM_BASE_URL, LLM_API_KEY oder LLM_MODEL.');
  }
  const messages = [{role: 'system', content: system}, ...history, {role: 'user', content: question}];
  const r = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${env.LLM_API_KEY}`},
    body: JSON.stringify({
      model: env.LLM_MODEL,
      messages,
      stream: true,
      ...(env.LLM_REASONING_EFFORT ? {reasoning_effort: env.LLM_REASONING_EFFORT} : {}),
    }),
  });
  if (!r.ok || !r.body) {
    res.statusCode = 502;
    return res.end(`LLM-Fehler ${r.status}: ${(await r.text()).slice(0, 300)}`);
  }
  res.setHeader('Content-Type', 'text/event-stream');
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
  res.end();
}

// ── Umbau: Claude Code baut Folien im Auftrag aus dem Präsentator um ──────────────────────────
// Läuft als Auftrag auf dem Server weiter, auch wenn die Seite wegen geänderter Dateien neu lädt.
type LogLine = {kind: 'text' | 'tool' | 'error' | 'check'; text: string};
const job: {running: boolean; kind: 'rebuild' | 'create'; created: string; createdPath: string; id: number; instruction: string; log: LogLine[]; backup: string; target: string; startedAt: number; endedAt: number} = {
  endedAt: 0,
  running: false,
  kind: 'rebuild',
  created: '',
  createdPath: '',
  id: 0,
  instruction: '',
  log: [],
  backup: '',
  target: '',
  startedAt: 0,
};
const backupDir = path.join(root, '.umbau');
// Der letzte Auftrag übersteht einen Neustart des Servers (nur sein Ergebnis; ein laufender Auftrag endet mit dem Server).
const jobFile = path.join(backupDir, 'auftrag.json');
try {
  const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  Object.assign(job, {kind: saved.kind, created: saved.created ?? '', createdPath: saved.createdPath ?? '', id: saved.id ?? 0, instruction: saved.instruction ?? '', log: saved.log ?? [], startedAt: saved.startedAt ?? 0, endedAt: saved.endedAt ?? 0});
} catch {
  // noch kein Auftrag gespeichert
}
const finishJob = () => {
  job.running = false;
  job.endedAt = Date.now();
  try {
    fs.mkdirSync(backupDir, {recursive: true});
    fs.writeFileSync(jobFile, JSON.stringify(jobStatus()));
  } catch {
    // nur fürs Wiederfinden nach einem Neustart
  }
};

const rebuildSystem = () => {
  const realDir = real(inhaltDir());
  const outside = realDir !== root && !realDir.startsWith(root + path.sep);
  const src = outside ? path.join(realDir, 'src') : rel(inhaltSrc());
  const extra = readOptional('umbau-regeln.md');
  return `Du baust Folien einer Remotion-Präsentation um, angestoßen aus dem Präsentator. Niemand kann Rückfragen beantworten: Triff sinnvolle Annahmen und nenne sie am Ende.
Regeln:
- Lies zuerst ${path.join(root, 'ANLEITUNG.md')} (Aufbau, Schnittstelle zwischen Präsentator und Inhalt), dann die betroffenen Dateien in ${src}/.
- Ändere nur Dateien in ${src}/. Texte, Dauer und Haltepunkte stehen in ${src}/content.json (gültiges JSON, gleiche Struktur beibehalten).
- Nichts darf sich überlappen oder aus dem Bild ragen; rechne Breiten und Positionen nach.
- Ändere nur, was der Auftrag verlangt. Sprechtexte (captions), Titel und andere Folien bleiben, wenn nichts anderes gesagt ist.
- Quellen zum Thema liegen, falls vorhanden, in ${outside ? path.join(realDir, 'quellen') : rel(quellenDir())}/.
- Du kannst nichts ausführen oder rendern. Der Server prüft danach die Typen; schreibe deshalb sorgfältig gültiges TypeScript.
${extra ? `Besonderheiten dieser Präsentation:\n${extra}\n` : ''}Antworte zum Schluss in wenigen Sätzen: was geändert wurde, in welchen Dateien, und was du nicht prüfen konntest.`;
};

const jobStatus = () => ({
  running: job.running,
  kind: job.kind,
  created: job.created,
  createdPath: job.createdPath,
  id: job.id,
  instruction: job.instruction,
  log: job.log,
  canUndo: !job.running && !!job.backup,
  startedAt: job.startedAt,
  endedAt: job.endedAt,
  seconds: Math.round(((job.running ? Date.now() : job.endedAt || Date.now()) - job.startedAt) / 1000),
});

const push = (kind: LogLine['kind'], text: string) => {
  const last = job.log[job.log.length - 1];
  if (kind === 'text' && last?.kind === 'text') last.text += text;
  else job.log.push({kind, text});
};

/** Startet Claude Code für den laufenden Auftrag; seine Ausgabe landet im Protokoll. Ohne Rechte-Regel ist nichts erlaubt. */
function runClaude(o: {prompt: string; system: string; tools: string; allowed: string[]; extra?: string[]; cwd: string; done: (ok: boolean) => void}) {
  const fileEnv = readEnv();
  // Variablen einer umgebenden Claude-Sitzung nicht weiterreichen, sonst greift deren Anmeldung nicht.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)));
  const child = spawn(
    'claude',
    ['-p', '--model', fileEnv.CLAUDE_MODEL || 'sonnet', '--append-system-prompt', o.system,
      '--tools', o.tools,
      '--allowedTools', ...o.allowed, ...(o.extra ?? []),
      '--disallowedTools', 'Read(.env)', 'Read(.env.*)', `Read(/${path.join(root, '.env')})`, `Read(/${path.join(root, '.env')}.*)`,
      '--strict-mcp-config', '--no-session-persistence',
      '--output-format', 'stream-json', '--include-partial-messages', '--verbose'],
    {cwd: o.cwd, env},
  );
  child.stdin.end(o.prompt);
  let buf = '';
  let err = '';
  let failed = false;
  child.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const ev = JSON.parse(line);
        const delta = ev.type === 'stream_event' ? ev.event?.delta : null;
        if (delta?.type === 'text_delta' && delta.text) push('text', delta.text);
        else if (ev.type === 'assistant') {
          for (const b of ev.message?.content ?? []) {
            if (b.type !== 'tool_use') continue;
            const target = b.input?.file_path ?? b.input?.pattern ?? b.input?.path ?? b.input?.url ?? '';
            push('tool', `${b.name} ${String(target).replace(o.cwd + '/', '').replace(root + '/', '')}`.trim());
          }
        } else if (ev.type === 'result' && ev.is_error) {
          failed = true;
          push('error', String(ev.result ?? 'unbekannter Fehler').slice(0, 400));
        }
      } catch {
        // keine JSON-Zeile
      }
    }
  });
  child.stderr.on('data', (d) => (err += d));
  let ended = false;
  const end = (ok: boolean) => {
    if (ended) return;
    ended = true;
    o.done(ok);
  };
  child.on('error', (e) => {
    push('error', (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'Befehl „claude“ nicht gefunden.' : e.message);
    end(false);
  });
  child.on('close', (code) => {
    if (code !== 0 && !failed) push('error', err.trim().slice(0, 400) || `Claude Code beendet mit Code ${code}`);
    end(code === 0 && !failed);
  });
}

/** Typprüfung des ganzen Projekts; mit only nur die Meldungen zu Dateien unter diesem Pfad (relativ zum Projekt). */
const typeCheck = (only: string | null, cb: (errors: string) => void) =>
  execFile('npx', ['tsc', '--noEmit', '-p', '.'], {cwd: root, maxBuffer: 8_000_000}, (_e, stdout) => {
    let out = String(stdout).trim();
    if (only && out) {
      // Folgezeilen einer Meldung sind eingerückt und gehören zur Meldung davor
      let keep = false;
      out = out
        .split('\n')
        .filter((l) => {
          if (!/^\s/.test(l)) keep = l.startsWith(only);
          return keep;
        })
        .join('\n');
    }
    cb(out);
  });

const checkContent = (file: string) => {
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(c.order) || !c.scenes) throw new Error('order/scenes fehlen');
    for (const id of c.order) {
      const sc = c.scenes[id];
      if (!sc) throw new Error(`Szene „${id}“ steht in order, fehlt aber in scenes`);
      if (typeof sc.dur !== 'number' || !Array.isArray(sc.stops) || !sc.t || !sc.lists) throw new Error(`Szene „${id}“: dur, stops, t oder lists fehlen`);
    }
  } catch (e) {
    push('error', `content.json ist beschädigt: ${(e as Error).message}`);
  }
};

function startRebuild(instruction: string, sceneId: string) {
  if (!hasInhalt()) throw new Error('Keine Präsentation gewählt.');
  const content = JSON.parse(fs.readFileSync(contentFile(), 'utf8'));
  const nr = content.order.indexOf(sceneId) + 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  job.running = true;
  job.kind = 'rebuild';
  job.created = '';
  job.createdPath = '';
  job.id += 1;
  job.instruction = instruction;
  job.log = [];
  job.startedAt = Date.now();
  job.backup = path.join(backupDir, stamp);
  job.target = inhaltSrc();
  fs.cpSync(job.target, path.join(job.backup, 'src'), {recursive: true});
  // nur die letzten 10 Sicherungen behalten
  const old = fs.readdirSync(backupDir).sort();
  old.slice(0, Math.max(0, old.length - 10)).forEach((d) => fs.rmSync(path.join(backupDir, d), {recursive: true, force: true}));

  // Liegt der Inhalt außerhalb des Projekts (eingehängt), braucht Claude den echten Pfad.
  const realDir = real(inhaltDir());
  const outside = realDir !== root && !realDir.startsWith(root + path.sep);
  const editRule = outside ? `/${path.join(realDir, 'src')}/**` : `${rel(inhaltSrc())}/**`;
  const file = contentFile();
  runClaude({
    prompt: `Gerade gezeigte Folie: Nr. ${nr} (Szenen-ID „${sceneId}“, Titel „${content.scenes[sceneId]?.title ?? ''}“).\n\nAuftrag:\n${instruction}`,
    system: rebuildSystem(),
    tools: 'Read,Edit,Write,Glob,Grep',
    allowed: ['Read', 'Glob', 'Grep', `Edit(${editRule})`, `Write(${editRule})`],
    extra: outside ? ['--add-dir', realDir] : [],
    cwd: root,
    done: () => {
      // Prüfung: gültiges JSON und fehlerfreie Typen
      checkContent(file);
      typeCheck(null, (out) => {
        push('check', out ? `Typprüfung meldet Fehler:\n${out.slice(0, 1200)}` : 'Typprüfung ohne Fehler.');
        finishJob();
      });
    },
  });
}

// ── Neue Präsentation: Gerüst aus vorlage/ anlegen, dann füllt Claude Code es nach dem Prompt ──────
const vorlageDir = path.join(root, 'vorlage');

const createSystem = (dir: string) => `Du erzeugst eine komplette Remotion-Präsentation für den „Präsentator“, angestoßen aus dessen Oberfläche. Niemand kann Rückfragen beantworten: Triff sinnvolle Annahmen und nenne sie am Ende.
Der Ordner der neuen Präsentation ist ${dir} (dein Arbeitsordner). Er enthält schon ein lauffähiges Gerüst mit zwei Platzhalter-Szenen.

Vorgehen:
1. Lies ${path.join(root, 'ANLEITUNG.md')} (Schnittstelle zwischen Präsentator und Inhalt, Regeln für Szenen) und das Gerüst: src/ui.tsx (Bausteine), src/scenes.tsx (Beispiel für ihre Verwendung), src/Video.tsx, src/content.json.
2. Lies die im Auftrag genannten Quellen: Dateien mit Read (lange PDFs seitenweise), Links mit WebFetch. Lässt sich eine Quelle nicht lesen, sag das am Ende deutlich; erfinde nichts, was du nicht gelesen hast.
3. Plane die Folien: ein Gedanke pro Folie, roter Faden vom Problem zum Fazit, Umfang wie im Auftrag.
4. Schreibe die Szenen als React.FC<SceneProps> nach src/ (höchstens etwa fünf Szenen je Datei, z. B. scenesA.tsx, scenesB.tsx), ersetze die Platzhalter-Szenen und melde jede Szene in REG in src/Video.tsx an.
5. Schreibe src/content.json: title, order und je Szene name (Kurzname), dur, stops, t, lists, dazu in der Regel kicker, title und captions (Sprechtext als Untertitel).
6. Schreibe src/begleittext.md (Thema, Zielgruppe, Ton – für Antworten auf Fragen während des Vortrags), src/umbau-regeln.md (Besonderheiten dieser Folien für spätere Umbauten), README.md und quellen/00-notizen.md: die wichtigsten Aussagen und Zahlen aus den Quellen, jeweils mit Fundstelle. Aus quellen/ beantwortet der Präsentator später Fragen.

Regeln:
- Bühne 1920×1080 bei 30 Bildern pro Sekunde. Mit Überschrift (Scene mit title) ist oben bis y≈170 belegt, der Untertitel-Kasten beginnt bei y=922: Zeichnungen zwischen y=190 und y=900 halten, seitlich 90 px Rand.
- Nichts darf sich überlappen oder aus dem Bild ragen. Rechne Breiten und Positionen nach; als Faustregel braucht ein Zeichen etwa 0,55 × Schriftgröße an Breite. Schrift im Bild mindestens 22 px, Untertitel höchstens etwa 150 Zeichen.
- Alle sichtbaren Texte kommen aus c.t (Schlüssel t01, t02, …) oder c.lists, nie fest aus dem Code – nur so sind sie im Präsentator änderbar.
- Elemente erscheinen nacheinander, passend zum Sprechtext (captions[].at). Jeder Untertitel steht etwa 4 bis 6 Sekunden. Haltepunkte (stops) kurz vor jedem nächsten Untertitel und am Ende der Szene (dur − 13).
- Grafiken statt Textlisten, gezeichnet mit div und SVG aus den Bausteinen. Keine Bilder oder Dateien von außen, nur die Pakete remotion und react. ui.tsx darfst du ergänzen, vorhandene Bausteine aber nicht ändern.
- Die Kompositions-ID in src/Root.tsx bleibt, wie sie ist.
- Schreibe nur in ${dir}. Du kannst nichts ausführen oder rendern; der Server prüft danach die Typen (TypeScript strict). Schreibe sorgfältig gültiges TypeScript und importiere nur, was du benutzt und was es gibt.
Antworte zum Schluss knapp: die Folien in ihrer Reihenfolge, deine Annahmen, welche Quellen du gelesen hast und welche nicht, und was du nicht prüfen konntest.`;

function startCreate(dirInput: string, prompt: string) {
  const typed = expandHome(dirInput.trim());
  if (!path.isAbsolute(typed)) throw new Error('Bitte den vollständigen Pfad des neuen Ordners angeben (beginnt mit / oder ~).');
  const abs = path.resolve(typed);
  if (abs === root || abs.startsWith(root + path.sep)) throw new Error('Der neue Ordner muss außerhalb des Präsentator-Ordners liegen.');
  if (!fs.existsSync(path.dirname(abs))) throw new Error(`Den übergeordneten Ordner ${path.dirname(abs)} gibt es nicht.`);
  if (fs.existsSync(abs)) {
    if (!fs.statSync(abs).isDirectory()) throw new Error(`${abs} ist eine Datei, kein Ordner.`);
    if (fs.readdirSync(abs).some((n) => n !== '.DS_Store')) throw new Error(`Der Ordner ${abs} ist nicht leer. Für eine neue Präsentation bitte einen neuen oder leeren Ordner angeben.`);
  }
  if (!isPresentation(vorlageDir)) throw new Error('Die Vorlage (Ordner vorlage/ im Präsentator) fehlt.');

  fs.cpSync(vorlageDir, abs, {recursive: true});
  fs.mkdirSync(path.join(abs, 'quellen'), {recursive: true});
  const dir = real(abs);
  const link = linkFolder(dir); // eingehängt, damit die Typprüfung die neuen Dateien sieht
  const only = `${rel(link)}/`;

  job.running = true;
  job.kind = 'create';
  job.created = rel(link);
  job.createdPath = dir;
  job.id += 1;
  job.instruction = prompt;
  job.log = [];
  job.startedAt = Date.now();
  job.backup = '';
  job.target = '';

  // Quellen aus dem Prompt: Dateien bekommen Leserecht, bei Links wird nur deren Adresse freigegeben.
  const files = new Set<string>();
  for (const m of prompt.matchAll(/["„“']((?:~|\/)[^"“”'\n]+\.(?:pdf|md|txt))["“”']/gi)) files.add(m[1]);
  for (const m of prompt.matchAll(/(?:^|[\s(])((?:~|\/)[^\s"'“”<>()]*\.(?:pdf|md|txt))/gim)) files.add(m[1]);
  const readRules: string[] = [];
  for (const f of files) {
    const p = path.resolve(expandHome(f));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) readRules.push(`Read(/${real(p)})`);
    else if (![...files].some((g) => g !== f && g.includes(f))) push('error', `Quelle nicht gefunden: ${f}`);
  }
  const hosts = new Set<string>();
  for (const m of prompt.matchAll(/https?:\/\/[^\s<>"'“”)]+/gi)) {
    try {
      hosts.add(new URL(m[0]).hostname);
    } catch {
      // keine gültige Adresse
    }
  }
  const allowed = [
    `Read(/${dir}/**)`, `Edit(/${dir}/**)`, `Write(/${dir}/**)`, `Read(/${path.join(root, 'ANLEITUNG.md')})`,
    ...readRules,
    ...[...hosts].map((h) => `WebFetch(domain:${h})`),
  ];
  const run = (text: string, round: number) =>
    runClaude({
      prompt: text,
      system: createSystem(dir),
      tools: `Read,Edit,Write,Glob,Grep${hosts.size ? ',WebFetch' : ''}`,
      allowed,
      cwd: dir,
      done: (ok) => {
        checkContent(path.join(dir, 'src', 'content.json'));
        typeCheck(only, (out) => {
          if (out && ok && round < 2) {
            push('check', `Typprüfung meldet Fehler – Claude bessert nach (Durchgang ${round + 1}):\n${out.slice(0, 1200)}`);
            return run(`Die Typprüfung (tsc --noEmit, strict) meldet in der eben erzeugten Präsentation diese Fehler. Behebe sie und ändere sonst nichts. Pfade beginnen mit ${only}, das ist dein Arbeitsordner.\n\n${out.slice(0, 6000)}`, round + 1);
          }
          push('check', out ? `Typprüfung meldet Fehler:\n${out.slice(0, 1200)}` : 'Typprüfung ohne Fehler.');
          finishJob();
        });
      },
    });
  run(`Auftrag für die neue Präsentation:\n\n${prompt}`, 0);
}

function undoRebuild() {
  if (!job.backup || !fs.existsSync(job.backup)) return false;
  fs.rmSync(job.target, {recursive: true, force: true});
  fs.cpSync(path.join(job.backup, 'src'), job.target, {recursive: true});
  job.log.push({kind: 'check', text: 'Rückgängig gemacht: der Inhalt ist wieder auf dem Stand vor diesem Umbau.'});
  job.backup = '';
  return true;
}

// PDF-Export: startet scripts/pdf.mjs (eine Seite je Haltepunkt) und merkt sich Fortschritt und Ergebnis.
const pdfJob = {running: false, progress: 0, file: '', error: '', startedAt: 0};
function startPdf() {
  if (pdfJob.running) return;
  Object.assign(pdfJob, {running: true, progress: 0, file: '', error: '', startedAt: Date.now()});
  const child = spawn(process.execPath, ['scripts/pdf.mjs'], {cwd: process.cwd(), env: {...process.env, INHALT: inhaltRel}});
  let err = '';
  let buf = '';
  child.stdout.on('data', (c) => {
    buf += c;
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const l of lines) {
      const m = l.match(/^PROGRESS (\d+)/);
      if (m) pdfJob.progress = Number(m[1]);
      if (l.startsWith('FERTIG ')) pdfJob.file = l.slice(7).trim();
    }
  });
  child.stderr.on('data', (c) => (err = (err + c).slice(-4000)));
  child.on('close', (code) => {
    pdfJob.running = false;
    if (code !== 0 || !pdfJob.file) pdfJob.error = err.trim().split('\n').slice(-6).join('\n') || `PDF-Export fehlgeschlagen (Code ${code}).`;
  });
}

// Kleiner Editor: liest und schreibt src/content.json, aus der auch das Video gerendert wird.
export default defineConfig({
  root: 'editor',
  server: {port: 5173, strictPort: true, fs: {allow: ['..']}},
  resolve: {preserveSymlinks: true},
  plugins: [
    {
      name: 'content-api',
      configureServer(server) {
        server.middlewares.use('/api/pdf', (req, res) => {
          if (req.url?.startsWith('/file')) {
            if (!pdfJob.file || !fs.existsSync(pdfJob.file)) {
              res.statusCode = 404;
              return res.end('Noch kein PDF erzeugt.');
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(path.basename(pdfJob.file))}`);
            return fs.createReadStream(pdfJob.file).pipe(res);
          }
          if (req.method === 'POST') {
            if (!hasInhalt()) {
              res.statusCode = 404;
              return res.end('Keine Präsentation gewählt.');
            }
            startPdf();
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(pdfJob));
        });

        server.middlewares.use('/api/content', (req, res) => {
          if (!hasInhalt()) {
            res.statusCode = 404;
            return res.end('Keine Präsentation gewählt.');
          }
          if (req.method === 'POST') {
            if (job.running && job.kind === 'rebuild') {
              res.statusCode = 409;
              return res.end('Umbau läuft – Speichern ist so lange gesperrt.');
            }
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
              try {
                const json = JSON.parse(body);
                if (!Array.isArray(json.order) || !json.scenes) throw new Error('unexpected shape');
                fs.writeFileSync(contentFile(), JSON.stringify(json, null, 2) + '\n');
                res.end('ok');
              } catch {
                res.statusCode = 400;
                res.end('bad content');
              }
            });
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(contentFile()));
          }
        });

        server.middlewares.use('/api/rebuild', (req, res) => {
          const send = () => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(jobStatus()));
          };
          if (req.method !== 'POST') return send();
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            try {
              const b = JSON.parse(body || '{}');
              if (b.undo) {
                if (job.running || !undoRebuild()) res.statusCode = 409;
              } else if (job.running) {
                res.statusCode = 409;
              } else {
                const instruction = String(b.instruction ?? '').trim().slice(0, 8000);
                if (!instruction) res.statusCode = 400;
                else startRebuild(instruction, String(b.sceneId ?? ''));
              }
            } catch (e) {
              res.statusCode = 500;
              finishJob();
              job.log.push({kind: 'error', text: String((e as Error).message)});
            }
            send();
          });
        });

        // Präsentation wählen: Liste, Wechsel per Listeneintrag, Pfad oder Ordner-Dialog
        server.middlewares.use('/api/presentation', (req, res) => {
          const send = (error?: string) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({...presentationInfo(), error}));
          };
          if (req.method !== 'POST') return send();
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              if (job.running && job.kind === 'rebuild') throw new Error('Umbau läuft – erst danach lässt sich die Präsentation wechseln.');
              const b = JSON.parse(body || '{}');
              if (b.remove !== undefined) removePresentation(String(b.remove));
              else if (b.pick) {
                const picked = await pickFolder();
                if (picked) choosePresentation({abs: picked});
              } else if (b.path) choosePresentation({abs: b.path});
              else choosePresentation({dir: String(b.dir ?? '.')});
              send();
            } catch (e) {
              res.statusCode = 400;
              send(String((e as Error).message));
            }
          });
        });

        // Neue Präsentation erzeugen: Vorlage für den Prompt (prompt.txt), Ordner-Dialog, Start des Auftrags
        server.middlewares.use('/api/create', (req, res) => {
          const send = (obj: object) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          };
          if (req.method !== 'POST') {
            const p = path.join(root, 'prompt.txt');
            return send({template: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '', parent: path.dirname(root)});
          }
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              const b = JSON.parse(body || '{}');
              if (b.pick) return send({picked: await pickFolder('Ordner für die neue Präsentation wählen (leer, oder im Dialog neu anlegen)')});
              if (job.running) throw new Error('Es läuft schon ein Auftrag – bitte warten, bis er fertig ist.');
              const prompt = String(b.prompt ?? '').trim().slice(0, 20000);
              if (!prompt) throw new Error('Der Prompt ist leer.');
              startCreate(String(b.path ?? ''), prompt);
              send(jobStatus());
            } catch (e) {
              res.statusCode = 400;
              send({error: String((e as Error).message)});
            }
          });
        });

        server.middlewares.use('/api/sources', (_req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readSources().map(({text, ...q}) => q)));
        });

        // ?-Taste: Frage zur aktuellen Folie an ein LLM (Zugang aus .env, bleibt auf dem Server).
        server.middlewares.use('/api/ask', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            ask(JSON.parse(body), res).catch((e) => {
              if (!res.headersSent) res.statusCode = 500;
              res.end(String(e?.message ?? e));
            });
          });
        });
      },
    },
  ],
});
