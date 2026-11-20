// Preview for Claude Code when rebuilding and creating slides: checks content.json and the types and renders
// the scenes at every stop (plus the final frame) as images that Claude can look at.
// Usage: node <ShowPoint>/scripts/vorschau.mjs <presentation folder> [scene ID …]
//   without scene IDs: all scenes. Images go to <presentation folder>/.vorschau/.
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
if (!dirArg) fail('Usage: node scripts/vorschau.mjs <presentation folder> [scene ID …]');
const dir = fs.realpathSync(path.resolve(dirArg));
const entry = path.join(dir, 'src', 'index.ts');
if (!fs.existsSync(entry)) fail(`${entry} is missing – is ${dir} a presentation folder?`);

// 1. content.json
let content;
try {
  content = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8'));
  if (!Array.isArray(content.order) || !content.scenes) throw new Error('order or scenes missing');
  for (const id of content.order) {
    const sc = content.scenes[id];
    if (!sc) throw new Error(`Scene "${id}" is in order but missing from scenes`);
    if (typeof sc.dur !== 'number' || !Array.isArray(sc.stops) || !sc.t || !sc.lists) throw new Error(`Scene "${id}": dur, stops, t or lists missing`);
  }
} catch (e) {
  fail(`content.json is invalid: ${e.message}`);
}
const unknown = wanted.filter((id) => !content.order.includes(id));
if (unknown.length) fail(`Unknown scene ID: ${unknown.join(', ')}. Available: ${content.order.join(', ')}`);

// 2. Type check (the whole project; only errors in this presentation are reported)
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
if (tsc) fail(`Type check reports errors (fix them first, then call again):\n${tsc.slice(0, 6000)}`);
console.log(`Type check passed${link ? '' : ' (note: the presentation is not linked under inhalte/, only the presenter was checked)'}.`);

// 3. Images at every stop
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
if (shots.length > MAX) fail(`That would be ${shots.length} images. Please give scene IDs (at most ${MAX} images per call). Scenes: ${content.order.join(', ')}`);

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
      console.log(`Scene ${s.id}, frame ${s.local}${s.last ? ' (final frame)' : ' (stop)'}: ${file}`);
    } catch (e) {
      errors.push(`Scene ${s.id}, frame ${s.local}: ${String(e.message).split('\n')[0]}`);
    }
  }
} finally {
  await browser.close({silent: true});
}
if (errors.length) fail(`Rendering failed:\n${errors.join('\n')}`);
console.log(`\n${shots.length} images (960×540, half the size of the 1920×1080 stage). Look at them and check: nothing overlaps, nothing sticks out of the frame or into the caption box, text easy to read.`);
