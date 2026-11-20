// Vorschau für Claude Code beim Umbauen und Erzeugen von Folien: prüft content.json und die Typen und rendert
// die Szenen an jedem Haltepunkt (plus Schlussbild) als Bilder, die Claude ansehen kann.
// Aufruf: node <ShowPoint>/scripts/vorschau.mjs <Ordner der Präsentation> [Szenen-ID …]
//   ohne Szenen-ID: alle Szenen. Bilder landen in <Ordner der Präsentation>/.vorschau/.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dirArg, ...wanted] = process.argv.slice(2);
const fail = (msg) => {
  console.log(msg);
  process.exit(1);
};
if (!dirArg) fail('Aufruf: node scripts/vorschau.mjs <Ordner der Präsentation> [Szenen-ID …]');
const dir = fs.realpathSync(path.resolve(dirArg));
const entry = path.join(dir, 'src', 'index.ts');
if (!fs.existsSync(entry)) fail(`${entry} fehlt – ist ${dir} der Ordner einer Präsentation?`);

// 1. content.json
let content;
try {
  content = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8'));
  if (!Array.isArray(content.order) || !content.scenes) throw new Error('order oder scenes fehlen');
  for (const id of content.order) {
    const sc = content.scenes[id];
    if (!sc) throw new Error(`Szene „${id}“ steht in order, fehlt aber in scenes`);
    if (typeof sc.dur !== 'number' || !Array.isArray(sc.stops) || !sc.t || !sc.lists) throw new Error(`Szene „${id}“: dur, stops, t oder lists fehlen`);
  }
} catch (e) {
  fail(`content.json ist fehlerhaft: ${e.message}`);
}
const unknown = wanted.filter((id) => !content.order.includes(id));
if (unknown.length) fail(`Unbekannte Szenen-ID: ${unknown.join(', ')}. Vorhanden: ${content.order.join(', ')}`);

// 2. Typprüfung (das ganze Projekt, gemeldet werden nur Fehler in dieser Präsentation)
const inhalte = path.join(root, 'inhalte');
const link = fs.existsSync(inhalte)
  ? fs.readdirSync(inhalte).find((n) => {
      try {
        return fs.realpathSync(path.join(inhalte, n)) === dir;
      } catch {
        return false;
      }
    })
  : undefined;
let tsc = '';
try {
  execFileSync(path.join(root, 'node_modules', '.bin', 'tsc'), ['--noEmit', '-p', '.'], {cwd: root, encoding: 'utf8', maxBuffer: 8_000_000});
} catch (e) {
  tsc = String(e.stdout ?? e.message);
}
if (link && tsc) {
  let keep = false;
  tsc = tsc
    .split('\n')
    .filter((l) => {
      if (!/^\s/.test(l)) keep = l.startsWith(`inhalte/${link}/`);
      return keep;
    })
    .join('\n')
    .replaceAll(`inhalte/${link}/`, `${dir}/`);
}
tsc = tsc.trim();
if (tsc) fail(`Typprüfung meldet Fehler (erst beheben, dann erneut aufrufen):\n${tsc.slice(0, 6000)}`);
console.log(`Typprüfung ohne Fehler${link ? '' : ' (Hinweis: Präsentation ist nicht unter inhalte/ eingehängt, geprüft wurde nur der Präsentator)'}.`);

// 3. Bilder an jedem Haltepunkt
const {bundle} = await import('@remotion/bundler');
const {openBrowser, renderStill, getCompositions} = await import('@remotion/renderer');
const shots = [];
let start = 0;
for (const id of content.order) {
  const sc = content.scenes[id];
  if (!wanted.length || wanted.includes(id)) {
    const local = [...new Set([...sc.stops.filter((s) => s > 0 && s < sc.dur), sc.dur - 1])].sort((a, b) => a - b);
    for (const s of local) shots.push({id, local: s, frame: start + s, last: s === sc.dur - 1});
  }
  start += sc.dur;
}
const MAX = 40;
if (shots.length > MAX) fail(`Das wären ${shots.length} Bilder. Bitte Szenen-IDs angeben (höchstens ${MAX} Bilder je Aufruf). Szenen: ${content.order.join(', ')}`);

const out = path.join(dir, '.vorschau');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const serveUrl = await bundle({
  entryPoint: entry,
  webpackOverride: (config) => ({...config, resolve: {...config.resolve, modules: [path.join(root, 'node_modules'), 'node_modules']}}),
});
const [composition] = await getCompositions(serveUrl);
const browser = await openBrowser('chrome');
const errors = [];
try {
  for (const s of shots) {
    const file = path.join(out, `${s.id}-${String(s.local).padStart(4, '0')}.jpg`);
    try {
      await renderStill({composition, serveUrl, frame: s.frame, output: file, imageFormat: 'jpeg', jpegQuality: 80, scale: 0.5, puppeteerInstance: browser});
      console.log(`Szene ${s.id}, Bild ${s.local}${s.last ? ' (Schlussbild)' : ' (Haltepunkt)'}: ${file}`);
    } catch (e) {
      errors.push(`Szene ${s.id}, Bild ${s.local}: ${String(e.message).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close({silent: true});
}
if (errors.length) fail(`Rendern fehlgeschlagen:\n${errors.join('\n')}`);
console.log(`\n${shots.length} Bilder (960×540, halbe Größe der Bühne 1920×1080). Sieh sie dir mit Read an und prüfe: nichts überlappt, nichts ragt aus dem Bild oder in den Untertitel-Kasten, Text gut lesbar.`);
