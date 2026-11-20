// Erzeugt aus der im Präsentator gewählten Präsentation ein PDF: eine Seite je Haltepunkt
// (genau das Bild, bei dem der Präsentator anhält) plus das Schlussbild.
// Aufruf: npm run pdf   → <Ordner der Präsentation>/out/<titel>.pdf
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition, getCompositions} from '@remotion/renderer';
import {PDFDocument} from 'pdf-lib';
import {gewaehltePraesentation} from './inhalt.mjs';

const {root, dir, entry, content, title, name} = gewaehltePraesentation();
if (!content?.order?.length) {
  console.error('content.json fehlt oder enthält keine Szenen.');
  process.exit(1);
}

// Dieselbe Rechnung wie im Präsentator (editor/main.tsx): Haltepunkte aller Szenen auf die Gesamtzeit umgerechnet.
const total = content.order.reduce((a, id) => a + content.scenes[id].dur, 0);
const pages = [];
let start = 0;
for (const id of content.order) {
  for (const s of content.scenes[id].stops ?? []) pages.push(start + s);
  start += content.scenes[id].dur;
}
const frames = [...new Set([...pages.filter((f) => f > 0 && f < total), total - 1])].sort((a, b) => a - b);

const out = path.join(dir, 'out', `${name}.pdf`);
console.log(`PDF „${title}“: ${frames.length} Seiten → ${out}`);
console.log('PROGRESS 0');

const serveUrl = await bundle({
  entryPoint: entry,
  // wie remotion.config.ts: Folien außerhalb dieses Ordners finden die hier installierten Pakete
  webpackOverride: (config) => ({
    ...config,
    resolve: {...config.resolve, modules: [path.join(root, 'node_modules'), 'node_modules']},
  }),
});
const [first] = await getCompositions(serveUrl);
const composition = await selectComposition({serveUrl, id: first.id});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showpoint-pdf-'));
const browser = await openBrowser('chrome');
const pdf = await PDFDocument.create();
pdf.setTitle(title);
pdf.setCreator('ShowPoint');
// 16:9-Seite in Punkt (1920 × 1080 Pixel → 960 × 540 pt, also 2 Pixel je Punkt)
const W = composition.width / 2;
const H = composition.height / 2;
try {
  for (const [i, frame] of frames.entries()) {
    const file = path.join(tmp, `${i}.jpg`);
    await renderStill({composition, serveUrl, frame, output: file, imageFormat: 'jpeg', jpegQuality: 90, puppeteerInstance: browser});
    const img = await pdf.embedJpg(fs.readFileSync(file));
    pdf.addPage([W, H]).drawImage(img, {x: 0, y: 0, width: W, height: H});
    console.log(`PROGRESS ${Math.round(((i + 1) / frames.length) * 100)}`);
  }
} finally {
  await browser.close({silent: true});
  fs.rmSync(tmp, {recursive: true, force: true});
}
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, await pdf.save());
console.log(`FERTIG ${out}`);
