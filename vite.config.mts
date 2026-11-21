import {execFile, execFileSync, spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {defineConfig} from 'vite';
import {runtimeResolve} from './runtime/aliases.mjs';
import {nonFreePackages} from './scripts/paket.mjs';

const root = process.cwd();

// ── Language: the UI sends X-Lang (de|en) with every /api request; German is the default ───────────
type Lang = 'de' | 'en';
const langOf = (req: import('node:http').IncomingMessage): Lang => (req.headers['x-lang'] === 'en' ? 'en' : 'de');
const LANG_NAME: Record<Lang, string> = {de: 'German', en: 'English'};

// Every user-visible server string, in both languages.
const MSG = {
  de: {
    removeOnlyLinked: 'Entfernen geht nur bei eingehängten Ordnern. Der Projektordner und echte Ordner unter inhalte/ bleiben.',
    unknownPresentation: 'Unbekannte Präsentation.',
    noPresentationAt: (abs: string) => `In ${abs} liegt keine Präsentation: Es fehlen src/Video.tsx und src/content.json.`,
    insideProject: 'Ordner innerhalb des Präsentator-Ordners bitte unter inhalte/ ablegen.',
    notAPresentation: 'Dort liegt keine Präsentation (src/Video.tsx und src/content.json fehlen).',
    pickPresentation: 'Ordner der Präsentation wählen (enthält src/)',
    pickNewFolder: 'Ordner für die neue Präsentation wählen (leer, oder im Dialog neu anlegen)',
    dialogFailed: 'Der Ordner-Dialog ließ sich nicht öffnen; Pfad bitte eintippen.',
    pdfUnreadable: 'PDF nicht lesbar (pdftotext fehlt?)',
    unreadable: 'nicht lesbar',
    truncated: 'gekürzt, Gesamtgrenze erreicht',
    omitted: 'ausgelassen, Gesamtgrenze erreicht',
    notLoggedIn: ' – Claude Code ist nicht angemeldet: im Terminal „claude“ starten und dort /login ausführen.',
    unknownError: 'unbekannter Fehler',
    claudeNotFound: 'Befehl „claude“ nicht gefunden.',
    exited: (code: number | null) => `beendet mit Code ${code}`,
    noPresentation: 'Keine Präsentation gewählt.',
    llmEnvMissing: 'In .env fehlen LLM_BASE_URL, LLM_API_KEY oder LLM_MODEL.',
    llmError: (status: number, text: string) => `LLM-Fehler ${status}: ${text}`,
    previewLabel: 'Vorschau',
    packageLabel: 'Paket installieren',
    licenseNote: (list: string) => `⚠ Lizenzhinweis: Die Präsentation nutzt Pakete ohne freie Lizenz: ${list}. Für die eigene Nutzung in Ordnung – vor dem Weitergeben (auch als PDF oder Video) oder einer kommerziellen Nutzung die Lizenz prüfen. Übersicht: PAKETE.md im Ordner der Präsentation.`,
    allScenes: 'alle Szenen',
    contentDamaged: (msg: string) => `content.json ist beschädigt: ${msg}`,
    contentNoOrder: 'order/scenes fehlen',
    sceneMissing: (id: string) => `Szene „${id}“ steht in order, fehlt aber in scenes`,
    sceneFields: (id: string) => `Szene „${id}“: dur, stops, t oder lists fehlen`,
    typeOk: 'Typprüfung ohne Fehler.',
    typeErrors: (out: string) => `Typprüfung meldet Fehler:\n${out}`,
    typeErrorsRetry: (round: number, out: string) => `Typprüfung meldet Fehler – Claude bessert nach (Durchgang ${round}):\n${out}`,
    needAbsPath: 'Bitte den vollständigen Pfad des neuen Ordners angeben (beginnt mit / oder ~).',
    newInsideProject: 'Der neue Ordner muss außerhalb des Präsentator-Ordners liegen.',
    parentMissing: (p: string) => `Den übergeordneten Ordner ${p} gibt es nicht.`,
    isFile: (abs: string) => `${abs} ist eine Datei, kein Ordner.`,
    notEmpty: (abs: string) => `Der Ordner ${abs} ist nicht leer. Für eine neue Präsentation bitte einen neuen oder leeren Ordner angeben.`,
    templateMissing: 'Die Vorlage (Ordner vorlage/ im Präsentator) fehlt.',
    sourceNotFound: (f: string) => `Quelle nicht gefunden: ${f}`,
    imageNotFound: (f: string) => `Bild nicht gefunden: ${f}`,
    imageCopied: (name: string) => `Bild übernommen → src/bilder/${name}`,
    undone: 'Rückgängig gemacht: der Inhalt ist wieder auf dem Stand vor diesem Umbau.',
    noPdf: 'Noch kein PDF erzeugt.',
    pdfFailed: (code: number | null) => `PDF-Export fehlgeschlagen (Code ${code}).`,
    saveLocked: 'Umbau läuft – Speichern ist so lange gesperrt.',
    badContent: 'Ungültiger Inhalt.',
    switchLocked: 'Umbau läuft – erst danach lässt sich die Präsentation wechseln.',
    jobRunning: 'Es läuft schon ein Auftrag – bitte warten, bis er fertig ist.',
    promptEmpty: 'Der Prompt ist leer.',
  },
  en: {
    removeOnlyLinked: 'Only linked folders can be removed. The project folder and real folders under inhalte/ stay.',
    unknownPresentation: 'Unknown presentation.',
    noPresentationAt: (abs: string) => `${abs} contains no presentation: src/Video.tsx and src/content.json are missing.`,
    insideProject: 'Please put folders inside the presenter folder under inhalte/.',
    notAPresentation: 'There is no presentation there (src/Video.tsx and src/content.json are missing).',
    pickPresentation: 'Choose the presentation folder (contains src/)',
    pickNewFolder: 'Choose a folder for the new presentation (empty, or create one in the dialog)',
    dialogFailed: 'Could not open the folder dialog; please type the path.',
    pdfUnreadable: 'PDF not readable (pdftotext missing?)',
    unreadable: 'not readable',
    truncated: 'truncated, total limit reached',
    omitted: 'omitted, total limit reached',
    notLoggedIn: ' – Claude Code is not logged in: start "claude" in a terminal and run /login there.',
    unknownError: 'unknown error',
    claudeNotFound: 'Command "claude" not found.',
    exited: (code: number | null) => `exited with code ${code}`,
    noPresentation: 'No presentation selected.',
    llmEnvMissing: '.env is missing LLM_BASE_URL, LLM_API_KEY or LLM_MODEL.',
    llmError: (status: number, text: string) => `LLM error ${status}: ${text}`,
    previewLabel: 'Preview',
    packageLabel: 'Install package',
    licenseNote: (list: string) => `⚠ Licence notice: the presentation uses packages without a free licence: ${list}. Fine for your own use – before passing it on (also as PDF or video) or using it commercially, check the licence. Overview: PAKETE.md in the presentation folder.`,
    allScenes: 'all scenes',
    contentDamaged: (msg: string) => `content.json is damaged: ${msg}`,
    contentNoOrder: 'order/scenes missing',
    sceneMissing: (id: string) => `Scene "${id}" is in order but missing from scenes`,
    sceneFields: (id: string) => `Scene "${id}": dur, stops, t or lists missing`,
    typeOk: 'Type check passed.',
    typeErrors: (out: string) => `Type check reports errors:\n${out}`,
    typeErrorsRetry: (round: number, out: string) => `Type check reports errors – Claude is fixing them (round ${round}):\n${out}`,
    needAbsPath: 'Please enter the full path of the new folder (starting with / or ~).',
    newInsideProject: 'The new folder must be outside the presenter folder.',
    parentMissing: (p: string) => `The parent folder ${p} does not exist.`,
    isFile: (abs: string) => `${abs} is a file, not a folder.`,
    notEmpty: (abs: string) => `The folder ${abs} is not empty. Please choose a new or empty folder for a new presentation.`,
    templateMissing: 'The template (folder vorlage/ in the presenter) is missing.',
    sourceNotFound: (f: string) => `Source not found: ${f}`,
    imageNotFound: (f: string) => `Image not found: ${f}`,
    imageCopied: (name: string) => `Image added → src/bilder/${name}`,
    undone: 'Undone: the content is back to the state before this rebuild.',
    noPdf: 'No PDF created yet.',
    pdfFailed: (code: number | null) => `PDF export failed (code ${code}).`,
    saveLocked: 'Rebuild in progress – saving is locked until it finishes.',
    badContent: 'Invalid content.',
    switchLocked: 'Rebuild in progress – the presentation can be switched once it has finished.',
    jobRunning: 'A job is already running – please wait until it has finished.',
    promptEmpty: 'The prompt is empty.',
  },
} satisfies Record<Lang, unknown>;

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

// The content (slides, texts, sources) lives separately from the presenter in a folder with src/ and quellen/.
// Which folder is shown can be chosen in the presenter ("Presentation"); the choice is stored as INHALT in .env.
// "." is the project folder itself, otherwise a folder under inhalte/. Folders from elsewhere are linked there
// as symlinks so they find the project's installed packages.
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

// '' = no presentation chosen (the presenter then only shows the chooser).
const fallback = () => (isPresentation(root) ? '.' : '');
let inhaltRel = (process.env.INHALT || readEnv().INHALT || '').replace(/\/+$/, '');
if (!inhaltRel || !isPresentation(path.resolve(root, inhaltRel))) {
  if (inhaltRel) console.warn(`INHALT=${inhaltRel} contains no presentation (src/Video.tsx and src/content.json).`);
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

/** Removes a linked presentation from the list: deletes only the symlink, never the files. */
function removePresentation(dir: string, lang: Lang) {
  const target = path.resolve(root, dir);
  if (path.dirname(target) !== linksDir || !isLink(target)) {
    throw new Error(MSG[lang].removeOnlyLinked);
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

/** Links a folder from outside as a symlink under inhalte/ and returns the link's path. */
function linkFolder(r: string) {
  fs.mkdirSync(linksDir, {recursive: true});
  const base = path.basename(r).replace(/[^\w.-]+/g, '-') || 'praesentation';
  let name = base;
  for (let n = 2; fs.existsSync(path.join(linksDir, name)) || isLink(path.join(linksDir, name)); n++) name = `${base}-${n}`;
  fs.symlinkSync(r, path.join(linksDir, name), 'dir');
  return path.join(linksDir, name);
}

/** Chooses a presentation: an entry of the list (dir) or any folder (abs). */
function choosePresentation(sel: {dir?: string; abs?: string}, lang: Lang) {
  const t = MSG[lang];
  let target: string;
  if (sel.dir !== undefined) {
    target = path.resolve(root, sel.dir);
    if (target !== root && path.dirname(target) !== linksDir) throw new Error(t.unknownPresentation);
  } else {
    let abs = path.resolve(expandHome(String(sel.abs ?? '').trim()));
    if (!isPresentation(abs) && path.basename(abs) === 'src' && isPresentation(path.dirname(abs))) abs = path.dirname(abs);
    if (!isPresentation(abs)) throw new Error(t.noPresentationAt(abs));
    const r = real(abs);
    const known = listPresentations().find((q) => q.path === r);
    if (known) target = path.resolve(root, known.dir);
    else if (r === root || r.startsWith(root + path.sep)) throw new Error(t.insideProject);
    else target = linkFolder(r); // from outside: link it as a symlink under inhalte/
  }
  if (!isPresentation(target)) throw new Error(t.notAPresentation);
  inhaltRel = rel(target);
  saveChoice();
}

/** macOS: opens the system folder dialog; returns the chosen path or '' if cancelled. */
const pickFolder = (prompt: string, lang: Lang) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to activate', '-e', `POSIX path of (choose folder with prompt "${prompt}")`],
      {timeout: 300_000},
      (err, stdout, stderr) => {
        if (!err) return resolve(String(stdout).trim());
        if (/-128/.test(String(stderr))) return resolve(''); // cancelled
        reject(new Error(MSG[lang].dialogFailed));
      },
    );
  });

const presentationInfo = () => ({
  current: hasInhalt() ? inhaltRel : '',
  title: hasInhalt() ? titleOf(inhaltDir()) : '',
  path: hasInhalt() ? real(inhaltDir()) : '',
  videoUrl: hasInhalt() ? `/@fs${path.join(inhaltSrc(), 'Video.tsx')}` : '',
  // packages without a free licence: the presenter shows a notice
  licenses: hasInhalt() ? nonFreePackages(real(inhaltDir())) : [],
  list: listPresentations(),
});

const readOptional = (name: string) => {
  const p = path.join(inhaltSrc(), name);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() : '';
};

const askSystem = (lang: Lang) => `You are helping with a presentation. Someone asks a question, usually about the slide currently shown, but it may refer to any other slide (e.g. an earlier one); the texts of all slides are below.
Answer briefly, in ${LANG_NAME[lang]} (the language of the user interface), even if the slide or the sources are in another language. Base your answer on the slide and the sources below. Look up details and numbers there. Mark anything not found there as general knowledge, or say that the sources do not cover it. Do not invent numbers.
Write plain prose without Markdown formatting.`;

// Extra sources: all .md/.txt/.pdf in the quellen/ folder go to the model as text (PDF via pdftotext).
const BUDGET = 600_000; // characters in total

type Source = {name: string; chars: number; used: number; note?: string; text: string};

function readSources(lang: Lang): Source[] {
  if (!hasInhalt()) return [];
  if (!fs.existsSync(quellenDir())) return [];
  const t = MSG[lang];
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
        note = /\.pdf$/i.test(name) ? t.pdfUnreadable : t.unreadable;
      }
      const used = Math.min(text.length, left);
      left -= used;
      if (!note && used < text.length) note = used ? t.truncated : t.omitted;
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

/** Answer from Claude Code (command `claude`, logged in via the subscription – no API key needed). */
const askWebNote = `## Internet
You can search the web (WebSearch) and read web pages (WebFetch). Use them when the slide and the sources do not answer the question, for current facts, or when asked to look something up. Then name the pages you used (title and URL) briefly at the end.`;

function askClaude(
  system: string,
  history: {role: string; content: string}[],
  question: string,
  res: import('node:http').ServerResponse,
  lang: Lang,
) {
  const t = MSG[lang];
  const fileEnv = readEnv();
  // Do not pass on variables of a surrounding Claude session, otherwise its login would not apply.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|ANTHROPIC)/.test(k)));
  const prompt = [
    ...history.map((m) => `${m.role === 'user' ? 'Earlier question' : 'Your earlier answer'}: ${m.content}`),
    history.length ? `New question: ${question}` : question,
  ].join('\n\n');
  const child = spawn(
    'claude',
    // Questions may use the internet: web search and reading web pages. No other tools (no files, no shell).
    ['-p', '--model', fileEnv.CLAUDE_MODEL || 'sonnet', '--system-prompt', `${system}\n\n${askWebNote}`,
      '--tools', 'WebSearch,WebFetch', '--allowedTools', 'WebSearch', 'WebFetch', '--strict-mcp-config',
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
    const hint = /authenticat|log ?in|oauth/i.test(msg) ? t.notLoggedIn : '';
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
        } else if (ev.type === 'assistant') {
          // show what Claude is looking up while the answer is not there yet
          for (const b of ev.message?.content ?? []) {
            if (b.type === 'tool_use' && b.name === 'WebSearch') sse(res, {status: `🔎 ${String(b.input?.query ?? '')}`});
            if (b.type === 'tool_use' && b.name === 'WebFetch') sse(res, {status: `🌐 ${String(b.input?.url ?? '')}`});
          }
        } else if (ev.type === 'result' && ev.is_error) {
          fail(String(ev.result ?? t.unknownError));
        }
      } catch {
        // not a JSON line – ignore
      }
    }
  });
  let err = '';
  child.stderr.on('data', (d) => (err += d));
  child.on('error', (e) => {
    fail((e as NodeJS.ErrnoException).code === 'ENOENT' ? t.claudeNotFound : e.message);
    res.end();
  });
  child.on('close', (code) => {
    if (!got && code !== 0) fail(err.trim() || t.exited(code));
    res.end();
  });
  res.on('close', () => child.kill());
  child.stdin.end(prompt);
}

async function ask(body: AskBody, res: import('node:http').ServerResponse, lang: Lang) {
  const t = MSG[lang];
  if (!hasInhalt()) throw new Error(t.noPresentation);
  const env = readEnv();
  const content = JSON.parse(fs.readFileSync(contentFile(), 'utf8'));
  const sc = content.scenes[body.sceneId];
  const nr = content.order.indexOf(body.sceneId) + 1;
  const notes = readSources(lang)
    .filter((q) => q.used)
    .map((q) => `## Source: ${q.name}\n${q.text}`)
    .join('\n\n');
  // All slides with their full texts, so questions may refer to any slide (e.g. "on the slide before …").
  type Sc = {name?: string; kicker?: string; title?: string; captions?: {text: string}[]; t?: Record<string, string>; lists?: Record<string, string[]>};
  const slideText = (s: Sc | undefined) =>
    [
      s?.kicker ? `Kicker: ${s.kicker}` : '',
      s?.title ? `Title: ${s.title}` : '',
      s?.captions?.length ? `Spoken text:\n${s.captions.map((c) => `- ${c.text}`).join('\n')}` : '',
      s?.t && Object.keys(s.t).length ? `Labels in the picture:\n${Object.values(s.t).map((x) => `- ${x}`).join('\n')}` : '',
      ...Object.entries(s?.lists ?? {}).map(([k, l]) => `List "${k}":\n${l.map((x) => `- ${x}`).join('\n')}`),
    ]
      .filter(Boolean)
      .join('\n');
  const allSlides = content.order
    .map((id: string, i: number) => {
      const s: Sc = content.scenes[id];
      return `### Slide ${i + 1}${s?.name ? ` (${s.name})` : ''}${id === body.sceneId ? ' – CURRENTLY SHOWN' : ''}\n${slideText(s)}`;
    })
    .join('\n\n');
  const slide = [
    `Slide ${nr} of ${content.order.length}${sc?.title ? `: ${sc.title}` : ''}`,
    body.caption ? `Currently shown caption: ${body.caption}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const extra = readOptional('begleittext.md');
  const system = `${askSystem(lang)}${extra ? `\n\n## About this presentation\n${extra}` : ''}\n\n## All slides\n${allSlides}\n\n## Current slide\n${slide}\n\n${notes}`;
  const history = (body.history ?? []).slice(-8);
  const quote = String(body.quote ?? '').trim().slice(0, 1500);
  const question =
    (quote ? `Highlighted passage the question refers to:\n"${quote}"\n\n` : '') +
    String(body.question).slice(0, 2000);
  if (body.provider === 'claude') return askClaude(system, history, question, res, lang);
  if (!env.LLM_BASE_URL || !env.LLM_API_KEY || !env.LLM_MODEL) {
    res.statusCode = 500;
    return res.end(t.llmEnvMissing);
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
    return res.end(t.llmError(r.status, (await r.text()).slice(0, 300)));
  }
  res.setHeader('Content-Type', 'text/event-stream');
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) res.write(chunk);
  res.end();
}

// ── Rebuild: Claude Code rebuilds slides on request from the presenter ─────────────────────────────
// Runs on as a job on the server, even if the page reloads because files changed.
// check = check passed; checkfail = final check failed; checkretry = type errors, Claude is asked to fix them again.
type LogLine = {kind: 'text' | 'tool' | 'error' | 'check' | 'checkfail' | 'checkretry' | 'warn'; text: string};
const job: {running: boolean; kind: 'rebuild' | 'create'; lang: Lang; created: string; createdPath: string; id: number; instruction: string; log: LogLine[]; backup: string; target: string; presentation: string; startedAt: number; endedAt: number} = {
  endedAt: 0,
  running: false,
  kind: 'rebuild',
  lang: 'de',
  created: '',
  createdPath: '',
  id: 0,
  instruction: '',
  log: [],
  backup: '',
  target: '',
  presentation: '',
  startedAt: 0,
};
const backupDir = path.join(root, '.umbau');
// The last job survives a server restart (only its result; a running job ends with the server).
const jobFile = path.join(backupDir, 'auftrag.json');
try {
  const saved = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
  Object.assign(job, {kind: saved.kind, lang: saved.lang === 'en' ? 'en' : 'de', created: saved.created ?? '', createdPath: saved.createdPath ?? '', id: saved.id ?? 0, instruction: saved.instruction ?? '', presentation: saved.presentation ?? '', log: saved.log ?? [], startedAt: saved.startedAt ?? 0, endedAt: saved.endedAt ?? 0});
} catch {
  // no job saved yet
}
const finishJob = () => {
  job.running = false;
  job.endedAt = Date.now();
  try {
    fs.mkdirSync(backupDir, {recursive: true});
    fs.writeFileSync(jobFile, JSON.stringify(jobStatus()));
  } catch {
    // only for finding it again after a restart
  }
};

const rebuildSystem = (lang: Lang) => {
  const realDir = real(inhaltDir());
  const outside = realDir !== root && !realDir.startsWith(root + path.sep);
  const src = outside ? path.join(realDir, 'src') : rel(inhaltSrc());
  const extra = readOptional('umbau-regeln.md');
  return `You are rebuilding slides of a ShowPoint presentation (React components animated per frame), triggered from the presenter. Nobody can answer follow-up questions: make sensible assumptions and state them at the end.
Rules:
- First read ${path.join(root, 'ANLEITUNG.md')} (structure, interface between presenter and content), then the affected files in ${src}/.
- Only change files in ${src}/. Texts, durations and stops are in ${src}/content.json (valid JSON, keep the same structure).
- Nothing may overlap or stick out of the frame; check widths and positions by calculation.
- Change only what the task asks for. Spoken texts (captions), titles and other slides stay as they are unless stated otherwise.
- Keep the language of the existing slide texts unless the task says otherwise.
- Sources on the topic, if any, are in ${outside ? path.join(realDir, 'quellen') : rel(quellenDir())}/.
${imageRule}
${chartRule}
${formulaRule}
${paketRule}
${vorschauHint(realDir)}
  After the rebuild, check at least the changed scenes; look at the images before reporting that you are done.
${extra ? `Special notes for this presentation:\n${extra}\n` : ''}Finally answer in a few sentences: what was changed, in which files, what the preview showed and what you could not check. Write your final answer in ${LANG_NAME[lang]}.`;
};

const jobStatus = () => ({
  running: job.running,
  kind: job.kind,
  lang: job.lang,
  created: job.created,
  createdPath: job.createdPath,
  id: job.id,
  instruction: job.instruction,
  log: job.log,
  // the presentation this job belongs to (real path): the presenter shows log and "Undo" only there
  presentation: job.presentation,
  canUndo: !job.running && !!job.backup,
  startedAt: job.startedAt,
  endedAt: job.endedAt,
  seconds: Math.round(((job.running ? Date.now() : job.endedAt || Date.now()) - job.startedAt) / 1000),
});

// Preview tool for Claude: type check and images at every stop, as a small MCP server (scripts/vorschau-mcp.mjs).
// Claude gets no Bash for it: the server fixes folder and command, Claude only chooses the scenes.
const vorschauRule = 'mcp__showpoint__vorschau';
const paketToolRule = 'mcp__showpoint__paket';
const vorschauMcp = (dir: string) => [
  '--mcp-config',
  JSON.stringify({mcpServers: {showpoint: {command: process.execPath, args: [path.join(root, 'scripts', 'vorschau-mcp.mjs'), dir]}}}),
];
const vorschauHint = (_dir: string) => `- Check with the tool "vorschau" (input: scenes = list of scene IDs from content.json):
  It checks content.json and the types and returns every named scene at every stop as an image. Look at the images and check: nothing overlaps, nothing sticks out of the frame or into the caption box, everything is easy to read, the elements appear in a sensible order. Fix any errors you find and check again until everything is right (at most about three rounds). A call takes a few seconds per scene.`;

const push = (kind: LogLine['kind'], text: string) => {
  const last = job.log[job.log.length - 1];
  if (kind === 'text' && last?.kind === 'text') last.text += text;
  else job.log.push({kind, text});
};

/** Starts Claude Code for the current job; its output goes to the log. Nothing is allowed without a permission rule. */
function runClaude(o: {prompt: string; system: string; tools: string; allowed: string[]; extra?: string[]; cwd: string; done: (ok: boolean) => void}) {
  const t = MSG[job.lang];
  const fileEnv = readEnv();
  // Do not pass on variables of a surrounding Claude session, otherwise its login would not apply.
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
            const target = b.name === vorschauRule ? `${(b.input?.scenes ?? []).join(', ') || t.allScenes}` : b.name === paketToolRule ? String(b.input?.name ?? '') : (b.input?.file_path ?? b.input?.pattern ?? b.input?.path ?? b.input?.url ?? '');
            const label = b.name === vorschauRule ? t.previewLabel : b.name === paketToolRule ? t.packageLabel : b.name;
            push('tool', `${label} ${String(target).replace(o.cwd + '/', '').replace(root + '/', '')}`.trim());
          }
        } else if (ev.type === 'result' && ev.is_error) {
          failed = true;
          push('error', String(ev.result ?? t.unknownError).slice(0, 400));
        }
      } catch {
        // not a JSON line
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
    push('error', (e as NodeJS.ErrnoException).code === 'ENOENT' ? t.claudeNotFound : e.message);
    end(false);
  });
  child.on('close', (code) => {
    if (code !== 0 && !failed) push('error', err.trim().slice(0, 400) || `Claude Code: ${t.exited(code)}`);
    end(code === 0 && !failed);
  });
}

/** Type check of the whole project; with `only`, just the messages for files under that path (relative to the project). */
const typeCheck = (only: string | null, cb: (errors: string) => void) =>
  execFile('npx', ['tsc', '--noEmit', '-p', '.'], {cwd: root, maxBuffer: 8_000_000}, (_e, stdout) => {
    let out = String(stdout).trim();
    if (only && out) {
      // continuation lines of a message are indented and belong to the message before
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
  const t = MSG[job.lang];
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(c.order) || !c.scenes) throw new Error(t.contentNoOrder);
    for (const id of c.order) {
      const sc = c.scenes[id];
      if (!sc) throw new Error(t.sceneMissing(id));
      if (typeof sc.dur !== 'number' || !Array.isArray(sc.stops) || !sc.t || !sc.lists) throw new Error(t.sceneFields(id));
    }
  } catch (e) {
    push('error', t.contentDamaged((e as Error).message));
  }
};

/** Final log line of a type check: passed (check) or failed (checkfail). */
const pushTypeResult = (out: string) => {
  const t = MSG[job.lang];
  if (out) push('checkfail', t.typeErrors(out.slice(0, 1200)));
  else push('check', t.typeOk);
};

/** Notice in the log if the presentation now uses packages without a free licence. */
const pushLicenseNote = (dir: string) => {
  const list = nonFreePackages(dir);
  if (list.length) push('warn', MSG[job.lang].licenseNote(list.map((p) => `${p.name} (${p.license})`).join(', ')));
};

// Images named in a task by file path are copied into src/bilder/ of the presentation, so they become part of it
// (presenter, PDF, video, other computers) and "Undo" removes them again. Returns a note for Claude's task text.
const IMAGE_EXT = 'png|jpe?g|webp|gif|svg';
function takeImages(text: string, srcDir: string, lang: Lang): string {
  const found = new Set<string>();
  for (const m of text.matchAll(new RegExp(`["„“'‚]((?:~|/)[^"“”'\\n]+\\.(?:${IMAGE_EXT}))["“”'‘]`, 'gi'))) found.add(m[1]);
  for (const m of text.matchAll(new RegExp(`(?:^|[\\s(])((?:~|/)[^\\s"'“”<>()]*\\.(?:${IMAGE_EXT}))`, 'gim'))) found.add(m[1]);
  const dest = path.join(srcDir, 'bilder');
  const lines: string[] = [];
  for (const f of found) {
    const from = path.resolve(expandHome(f));
    if (!fs.existsSync(from) || !fs.statSync(from).isFile()) {
      // a path with spaces is also found cut off at the first space – only report the full one
      if (![...found].some((g) => g !== f && g.includes(f))) push('error', MSG[lang].imageNotFound(f));
      continue;
    }
    const ext = path.extname(from).toLowerCase();
    const stem = path.basename(from, path.extname(from)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'bild';
    fs.mkdirSync(dest, {recursive: true});
    let name = `${stem}${ext}`;
    for (let i = 2; fs.existsSync(path.join(dest, name)) && !fs.readFileSync(path.join(dest, name)).equals(fs.readFileSync(from)); i++) name = `${stem}-${i}${ext}`;
    fs.copyFileSync(from, path.join(dest, name));
    push('tool', MSG[lang].imageCopied(name));
    lines.push(`- ${f} → ${path.join(dest, name)} (in the code: src/bilder/${name})`);
  }
  return lines.length ? `\n\nImages supplied with this task, already copied into the presentation (look at each with Read before placing it):\n${lines.join('\n')}` : '';
}
const paketRule = `- Other libraries (maps, network graphs, physics, special charts …): only when the building blocks from 'showpoint' cannot do it reasonably. Install with the tool "paket" (input: name, e.g. "d3-geo"); it installs into the presentation's own node_modules, then import as usual. Prefer small, freely licensed packages (MIT, ISC, BSD, Apache-2.0); if the tool reports a licence warning, mention it in your final answer. Never install react, never use the library's own animation clock, timers or transitions: switch them off (e.g. animation: false, frameloop "never") and compute everything from useCurrentFrame(), otherwise jumping, stops, PDF and video will not match. Maps: prefer SVG with d3-geo and offline data (world-atlas / topojson) over tile maps from the internet. Check with "vorschau" that two different frames look different where they should.`;
const chartRule = `- Numbers and proportions as charts from 'showpoint': <BarChart> (columns; horizontal for long labels; highlight = index to emphasise), <LineChart> (values or series = [{name, values}], area), <PieChart> (shares; donut, center text). Props: x, y, w, h in stage pixels, labels, values, at (start frame), unit (e.g. " %"), decimalComma for German-style numbers. Put labels and values into c.lists (values as strings like "3,5"), so they stay editable in the presenter. Never draw charts by hand when these fit.`;
const imageRule = `- Images: use only image files inside the presentation's src/bilder/ (the user supplies them; the server copies image paths named in a task there). Import them relative to the scene file, e.g. \`import foto from './bilder/foto.png'\`, and show them with \`<Img src={foto} style={{width: …, height: …, objectFit: 'contain'}} />\` (Img from 'showpoint', never a plain <img>, never paths outside the presentation). Keep labels as real text from c.t next to or on top of the image, not baked into it. Images may fade or move in like other elements; check size and position with the preview.`;
const formulaRule = `- Formulas: always with \`<Formula tex={c.t.f1} x={…} y={…} at={…} fontSize={56} />\` from 'showpoint' (KaTeX; LaTeX text in c.t, steps of a calculation as \`steps={c.lists.…}\`, they appear one after the other), never as an image or pieced together from Unicode characters, sub/sup tags or SVG text. In content.json backslashes are doubled ("\\\\frac{a}{b}").`;

function startRebuild(instruction: string, sceneId: string, lang: Lang) {
  if (!hasInhalt()) throw new Error(MSG[lang].noPresentation);
  const content = JSON.parse(fs.readFileSync(contentFile(), 'utf8'));
  const nr = content.order.indexOf(sceneId) + 1;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  job.running = true;
  job.kind = 'rebuild';
  job.lang = lang;
  job.created = '';
  job.createdPath = '';
  job.id += 1;
  job.instruction = instruction;
  job.log = [];
  job.startedAt = Date.now();
  job.backup = path.join(backupDir, stamp);
  job.target = inhaltSrc();
  job.presentation = real(inhaltDir());
  fs.cpSync(job.target, path.join(job.backup, 'src'), {recursive: true});
  // keep only the last 10 backups
  const old = fs.readdirSync(backupDir).sort();
  old.slice(0, Math.max(0, old.length - 10)).forEach((d) => fs.rmSync(path.join(backupDir, d), {recursive: true, force: true}));

  // If the content lives outside the project (linked), Claude needs the real path.
  const realDir = real(inhaltDir());
  const outside = realDir !== root && !realDir.startsWith(root + path.sep);
  const editRule = outside ? `/${path.join(realDir, 'src')}/**` : `${rel(inhaltSrc())}/**`;
  const file = contentFile();
  const images = takeImages(instruction, real(inhaltSrc()), lang); // after the backup, so "Undo" removes them
  runClaude({
    prompt: `Slide currently shown: no. ${nr} (scene ID "${sceneId}", title "${content.scenes[sceneId]?.title ?? ''}").\n\nTask:\n${instruction}${images}`,
    system: rebuildSystem(lang),
    tools: 'Read,Edit,Write,Glob,Grep',
    allowed: ['Read', 'Glob', 'Grep', `Edit(${editRule})`, `Write(${editRule})`, vorschauRule, paketToolRule],
    extra: [...(outside ? ['--add-dir', realDir] : []), ...vorschauMcp(realDir)],
    cwd: root,
    done: () => {
      // check: valid JSON and error-free types
      checkContent(file);
      typeCheck(null, (out) => {
        pushTypeResult(out);
        pushLicenseNote(realDir);
        finishJob();
      });
    },
  });
}

// ── New presentation: create the scaffold from vorlage/, then Claude Code fills it according to the prompt ──
const vorlageDir = path.join(root, 'vorlage');
// English overrides of some template files live in vorlage/en/ (same relative paths); never copied as a folder.
const vorlageEnDir = path.join(vorlageDir, 'en');
const vorlageEnFiles = ['README.md', 'src/begleittext.md', 'src/content.json', 'src/umbau-regeln.md'];

const createSystem = (dir: string, lang: Lang) => `You are creating a complete ShowPoint presentation (React components animated per frame) for the "presenter", triggered from its user interface. Nobody can answer follow-up questions: make sensible assumptions and state them at the end.
The folder of the new presentation is ${dir} (your working folder). It already contains a working scaffold with two placeholder scenes.

Language: write all slide texts, captions, notes, begleittext.md, umbau-regeln.md, README.md and quellen/00-notizen.md in the language the task (the user's request) is written in; if that is unclear, use ${LANG_NAME[lang]}. Write your final answer in ${LANG_NAME[lang]}.

Procedure:
1. Read ${path.join(root, 'ANLEITUNG.md')} (interface between presenter and content, rules for scenes) and the scaffold: src/ui.tsx (building blocks), src/scenes.tsx (example of their use), src/Video.tsx, src/content.json.
2. Read the sources named in the task: files with Read (long PDFs page by page), links with WebFetch. If a source cannot be read, say so clearly at the end; do not invent anything you have not read.
3. Plan the slides: one idea per slide, a clear thread from the problem to the conclusion, scope as in the task.
4. Write the scenes as React.FC<SceneProps> to src/ (at most about five scenes per file, e.g. scenesA.tsx, scenesB.tsx), replace the placeholder scenes and register every scene in REG in src/Video.tsx.
5. Write src/content.json: title, order and for each scene name (short name), dur, stops, t, lists, plus usually kicker, title and captions (spoken text shown as subtitles).
6. Write src/begleittext.md (topic, audience, tone – for answering questions during the talk), src/umbau-regeln.md (special notes on these slides for later rebuilds), README.md and quellen/00-notizen.md: the most important statements and numbers from the sources, each with its location. The presenter later answers questions from quellen/.

Rules:
- Stage 1920×1080 at 30 frames per second. With a heading (Scene with title) the top is occupied down to y≈170, the caption box starts at y=922: keep drawings between y=190 and y=900, with a 90 px margin at the sides.
- Nothing may overlap or stick out of the frame. Check widths and positions by calculation; as a rule of thumb a character needs about 0.55 × font size of width. Text in the picture at least 22 px, captions at most about 150 characters.
- All visible texts come from c.t (keys t01, t02, …) or c.lists, never hard-coded – only then can they be edited in the presenter.
- Elements appear one after another, matching the spoken text (captions[].at). Each caption stays about 4 to 6 seconds. Stops shortly before each next caption and at the end of the scene (dur − 13).
- Graphics instead of text lists, drawn with div and SVG from the building blocks. No files from outside the presentation, only the packages showpoint and react plus packages installed with the tool "paket" (see below) (building blocks from 'showpoint': AbsoluteFill, Sequence, Series, Img, Formula, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, random, BarChart, LineChart, PieChart); images only as described in the next rule. You may add to ui.tsx, but do not change existing building blocks.
${imageRule}
${chartRule}
${formulaRule}
${paketRule}
- Only write in ${dir}. Write valid TypeScript (strict) carefully and import only what you use and what exists.
${vorschauHint(dir)}
  Check every scene this way at the end (several scene IDs per call are possible, at most 40 images).
Finally answer briefly: the slides in their order, your assumptions, which sources you read and which not, what the preview showed and what you could not check.`;

function startCreate(dirInput: string, prompt: string, lang: Lang) {
  const t = MSG[lang];
  const typed = expandHome(dirInput.trim());
  if (!path.isAbsolute(typed)) throw new Error(t.needAbsPath);
  const abs = path.resolve(typed);
  if (abs === root || abs.startsWith(root + path.sep)) throw new Error(t.newInsideProject);
  if (!fs.existsSync(path.dirname(abs))) throw new Error(t.parentMissing(path.dirname(abs)));
  if (fs.existsSync(abs)) {
    if (!fs.statSync(abs).isDirectory()) throw new Error(t.isFile(abs));
    if (fs.readdirSync(abs).some((n) => n !== '.DS_Store')) throw new Error(t.notEmpty(abs));
  }
  if (!isPresentation(vorlageDir)) throw new Error(t.templateMissing);

  fs.cpSync(vorlageDir, abs, {recursive: true, filter: (s) => ![vorlageEnDir, path.join(vorlageDir, 'beispiele'), path.join(vorlageDir, 'node_modules')].includes(path.resolve(s))});
  if (lang === 'en') {
    for (const f of vorlageEnFiles) {
      const from = path.join(vorlageEnDir, f);
      if (fs.existsSync(from)) fs.copyFileSync(from, path.join(abs, f));
    }
  }
  fs.mkdirSync(path.join(abs, 'quellen'), {recursive: true});
  const dir = real(abs);
  const link = linkFolder(dir); // linked so the type check sees the new files
  const only = `${rel(link)}/`;

  job.running = true;
  job.kind = 'create';
  job.lang = lang;
  job.created = rel(link);
  job.createdPath = dir;
  job.id += 1;
  job.instruction = prompt;
  job.log = [];
  job.startedAt = Date.now();
  job.backup = '';
  job.target = '';
  job.presentation = dir;

  // Sources from the prompt: files get read permission, for links only their host is allowed.
  const files = new Set<string>();
  for (const m of prompt.matchAll(/["„“']((?:~|\/)[^"“”'\n]+\.(?:pdf|md|txt))["“”']/gi)) files.add(m[1]);
  for (const m of prompt.matchAll(/(?:^|[\s(])((?:~|\/)[^\s"'“”<>()]*\.(?:pdf|md|txt))/gim)) files.add(m[1]);
  const readRules: string[] = [];
  for (const f of files) {
    const p = path.resolve(expandHome(f));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) readRules.push(`Read(/${real(p)})`);
    else if (![...files].some((g) => g !== f && g.includes(f))) push('error', t.sourceNotFound(f));
  }
  const hosts = new Set<string>();
  for (const m of prompt.matchAll(/https?:\/\/[^\s<>"'“”)]+/gi)) {
    try {
      hosts.add(new URL(m[0]).hostname);
    } catch {
      // not a valid URL
    }
  }
  const allowed = [
    `Read(/${dir}/**)`, `Edit(/${dir}/**)`, `Write(/${dir}/**)`, `Read(/${path.join(root, 'ANLEITUNG.md')})`, vorschauRule, paketToolRule,
    ...readRules,
    ...[...hosts].map((h) => `WebFetch(domain:${h})`),
  ];
  const run = (text: string, round: number) =>
    runClaude({
      prompt: text,
      system: createSystem(dir, lang),
      tools: `Read,Edit,Write,Glob,Grep${hosts.size ? ',WebFetch' : ''}`,
      extra: vorschauMcp(dir),
      allowed,
      cwd: dir,
      done: (ok) => {
        checkContent(path.join(dir, 'src', 'content.json'));
        typeCheck(only, (out) => {
          if (out && ok && round < 2) {
            push('checkretry', t.typeErrorsRetry(round + 1, out.slice(0, 1200)));
            return run(`The type check (tsc --noEmit, strict) reports these errors in the presentation you just created. Fix them and change nothing else. Paths start with ${only}, which is your working folder.\n\n${out.slice(0, 6000)}`, round + 1);
          }
          pushTypeResult(out);
          pushLicenseNote(dir);
          finishJob();
        });
      },
    });
  const images = takeImages(prompt, path.join(dir, 'src'), lang);
  run(`Task for the new presentation:\n\n${prompt}${images}`, 0);
}

function undoRebuild(lang: Lang) {
  if (!job.backup || !fs.existsSync(job.backup)) return false;
  // only for the presentation that was rebuilt (another one may be shown by now)
  if (!hasInhalt() || real(inhaltDir()) !== job.presentation) return false;
  fs.rmSync(job.target, {recursive: true, force: true});
  fs.cpSync(path.join(job.backup, 'src'), job.target, {recursive: true});
  job.log.push({kind: 'check', text: MSG[lang].undone});
  job.backup = '';
  return true;
}

// PDF export: starts scripts/pdf.mjs (one page per stop) and remembers progress and result.
const pdfJob = {running: false, progress: 0, file: '', error: '', startedAt: 0, lang: 'de' as Lang};
function startPdf(lang: Lang) {
  if (pdfJob.running) return;
  Object.assign(pdfJob, {running: true, progress: 0, file: '', error: '', startedAt: Date.now(), lang});
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
      if (l.startsWith('DONE ')) pdfJob.file = l.slice(5).trim();
    }
  });
  child.stderr.on('data', (c) => (err = (err + c).slice(-4000)));
  child.on('close', (code) => {
    pdfJob.running = false;
    if (code !== 0 || !pdfJob.file) pdfJob.error = err.trim().split('\n').slice(-6).join('\n') || MSG[pdfJob.lang].pdfFailed(code);
  });
}

// Small editor: reads and writes src/content.json, from which the video is rendered too.
export default defineConfig({
  root: 'editor',
  server: {port: 5173, strictPort: true, fs: {allow: ['..']}},
  resolve: runtimeResolve,
  plugins: [
    {
      name: 'content-api',
      configureServer(server) {
        server.middlewares.use('/api/pdf', (req, res) => {
          const t = MSG[langOf(req)];
          if (req.url?.startsWith('/file')) {
            if (!pdfJob.file || !fs.existsSync(pdfJob.file)) {
              res.statusCode = 404;
              return res.end(t.noPdf);
            }
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(path.basename(pdfJob.file))}`);
            return fs.createReadStream(pdfJob.file).pipe(res);
          }
          if (req.method === 'POST') {
            if (!hasInhalt()) {
              res.statusCode = 404;
              return res.end(t.noPresentation);
            }
            startPdf(langOf(req));
          }
          res.setHeader('Content-Type', 'application/json');
          const {lang: _lang, ...status} = pdfJob;
          res.end(JSON.stringify(status));
        });

        server.middlewares.use('/api/content', (req, res) => {
          const t = MSG[langOf(req)];
          if (!hasInhalt()) {
            res.statusCode = 404;
            return res.end(t.noPresentation);
          }
          if (req.method === 'POST') {
            if (job.running && job.kind === 'rebuild') {
              res.statusCode = 409;
              return res.end(t.saveLocked);
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
                res.end(t.badContent);
              }
            });
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(fs.readFileSync(contentFile()));
          }
        });

        server.middlewares.use('/api/rebuild', (req, res) => {
          const lang = langOf(req);
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
                if (job.running || !undoRebuild(lang)) res.statusCode = 409;
              } else if (job.running) {
                res.statusCode = 409;
              } else {
                const instruction = String(b.instruction ?? '').trim().slice(0, 8000);
                if (!instruction) res.statusCode = 400;
                else startRebuild(instruction, String(b.sceneId ?? ''), lang);
              }
            } catch (e) {
              res.statusCode = 500;
              finishJob();
              job.log.push({kind: 'error', text: String((e as Error).message)});
            }
            send();
          });
        });

        // Choose a presentation: list, switch via list entry, path or folder dialog
        server.middlewares.use('/api/presentation', (req, res) => {
          const lang = langOf(req);
          const send = (error?: string) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({...presentationInfo(), error}));
          };
          if (req.method !== 'POST') return send();
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              if (job.running && job.kind === 'rebuild') throw new Error(MSG[lang].switchLocked);
              const b = JSON.parse(body || '{}');
              if (b.remove !== undefined) removePresentation(String(b.remove), lang);
              else if (b.pick) {
                const picked = await pickFolder(MSG[lang].pickPresentation, lang);
                if (picked) choosePresentation({abs: picked}, lang);
              } else if (b.path) choosePresentation({abs: b.path}, lang);
              else choosePresentation({dir: String(b.dir ?? '.')}, lang);
              send();
            } catch (e) {
              res.statusCode = 400;
              send(String((e as Error).message));
            }
          });
        });

        // Create a new presentation: template for the prompt (prompt.txt / prompt.en.txt), folder dialog, start of the job
        server.middlewares.use('/api/create', (req, res) => {
          const lang = langOf(req);
          const t = MSG[lang];
          const send = (obj: object) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(obj));
          };
          if (req.method !== 'POST') {
            const en = path.join(root, 'prompt.en.txt');
            const p = lang === 'en' && fs.existsSync(en) ? en : path.join(root, 'prompt.txt');
            return send({template: fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '', parent: path.dirname(root)});
          }
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', async () => {
            try {
              const b = JSON.parse(body || '{}');
              if (b.pick) return send({picked: await pickFolder(t.pickNewFolder, lang)});
              if (job.running) throw new Error(t.jobRunning);
              const prompt = String(b.prompt ?? '').trim().slice(0, 20000);
              if (!prompt) throw new Error(t.promptEmpty);
              startCreate(String(b.path ?? ''), prompt, lang);
              send(jobStatus());
            } catch (e) {
              res.statusCode = 400;
              send({error: String((e as Error).message)});
            }
          });
        });

        server.middlewares.use('/api/sources', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readSources(langOf(req)).map(({text, ...q}) => q)));
        });

        // ? key: question about the current slide to an LLM (access from .env, stays on the server).
        server.middlewares.use('/api/ask', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            return res.end();
          }
          const lang = langOf(req);
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            ask(JSON.parse(body), res, lang).catch((e) => {
              if (!res.headersSent) res.statusCode = 500;
              res.end(String(e?.message ?? e));
            });
          });
        });
      },
    },
  ],
});
