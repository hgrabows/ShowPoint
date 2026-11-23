// Designs: preview pictures and contrast check.
//   node scripts/designs.mjs                    preview of every design: the shipped ones (vorlage/designs/) and
//                                               your own (designs/) → <name>.jpg next to each <name>.json
//   node scripts/designs.mjs <file.json> …      only these design files
//   node scripts/designs.mjs --check [files]    no pictures: contrast of text against background and boxes (WCAG 2)
//   options: --scale 0.5 (default 0.25 = 480×270)   --out <folder> (pictures go there instead)
// The picture is the sample slide vorlage/designs/muster/ (text, boxes, bar chart, Mermaid diagram), rendered with
// the building blocks of vorlage/src/ui.tsx in that design.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {contrastReport, isDesign} from '../runtime/designCore.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const shippedDir = path.join(root, 'vorlage', 'designs');
export const ownDir = path.join(root, 'designs');
const musterDir = path.join(shippedDir, 'muster');

/** All design files: shipped first (in a fixed order), then own ones by name. */
export function designFiles() {
  const order = ['nacht', 'hell', 'papier', 'kontrast', 'bunt'];
  const list = (dir) => {
    try {
      return fs.readdirSync(dir).filter((n) => /\.json$/i.test(n) && !n.startsWith('.')).sort();
    } catch {
      return [];
    }
  };
  const rank = (n) => (order.indexOf(n.replace(/\.json$/i, '')) + 1 || order.length + 1);
  return [
    ...list(shippedDir).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map((n) => path.join(shippedDir, n)),
    ...list(ownDir).map((n) => path.join(ownDir, n)),
  ];
}

/** Font files that belong to a saved design live next to it: <name>/schriften/. */
export const fontDirOf = (jsonFile) => path.join(jsonFile.replace(/\.json$/i, ''), 'schriften');

/** Renders the sample slide in one design to a JPEG. */
export async function renderPreview(jsonFile, outFile, {scale = 0.25} = {}) {
  const design = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (!isDesign(design)) throw new Error(`${jsonFile} is not a design file (surface.bg and text.normal are missing).`);
  const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'showpoint-design-')));
  const src = path.join(tmp, 'src');
  fs.mkdirSync(src);
  try {
    fs.copyFileSync(path.join(root, 'vorlage', 'src', 'ui.tsx'), path.join(src, 'ui.tsx'));
    for (const f of ['Video.tsx', 'scenes.tsx', 'content.json']) fs.copyFileSync(path.join(musterDir, f), path.join(src, f));
    fs.writeFileSync(path.join(src, 'design.json'), JSON.stringify(design));
    if (fs.existsSync(fontDirOf(jsonFile))) fs.cpSync(fontDirOf(jsonFile), path.join(src, 'schriften'), {recursive: true});
    const {openStage} = await import('./stills.mjs');
    const stage = await openStage(tmp, {scale});
    try {
      fs.mkdirSync(path.dirname(outFile), {recursive: true});
      await stage.shot(100, outFile, {quality: 88});
    } finally {
      await stage.close();
    }
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

/** Prints the contrast table of one design; returns the number of pairs below their minimum. */
function check(jsonFile) {
  const design = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  const rows = contrastReport(design);
  console.log(`\n${design.name || path.basename(jsonFile)} (${path.relative(root, jsonFile)})`);
  for (const r of rows) {
    console.log(`  ${r.ok ? 'ok  ' : 'LOW '} ${r.ratio.toFixed(2).padStart(5)} : 1  (min ${r.min})  ${r.what} ${r.fg} on ${r.on} ${r.bg}`);
  }
  return rows.filter((r) => !r.ok).length;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const take = (flag) => {
    const i = args.indexOf(flag);
    return i < 0 ? undefined : args.splice(i, 2)[1];
  };
  const scale = Number(take('--scale') ?? 0.25);
  const out = take('--out');
  const onlyCheck = args.includes('--check');
  const files = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a));
  const todo = files.length ? files : designFiles();
  if (onlyCheck) {
    const low = todo.reduce((n, f) => n + check(f), 0);
    console.log(low ? `\n${low} pair(s) below the minimum contrast.` : '\nAll pairs reach their minimum contrast.');
    process.exit(low ? 1 : 0);
  }
  let failed = 0;
  for (const f of todo) {
    const target = out ? path.join(path.resolve(out), path.basename(f).replace(/\.json$/i, '.jpg')) : f.replace(/\.json$/i, '.jpg');
    try {
      await renderPreview(f, target, {scale});
      console.log(`${path.basename(f)} → ${target}`);
    } catch (e) {
      failed++;
      console.log(`${path.basename(f)}: ${String(e.message).split('\n').slice(0, 4).join(' / ')}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
