// Creates a PDF from the presentation chosen in the presenter: one page per stop
// (exactly the frame at which the presenter pauses) plus the final frame.
// Usage: npm run pdf   → <presentation folder>/out/<title>.pdf
// Machine-readable lines for vite.config.mts: "PROGRESS <percent>" and "DONE <path>".
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {openStage} from './stills.mjs';
import {PDFDocument} from 'pdf-lib';
import {gewaehltePraesentation} from './inhalt.mjs';

const {dir, content, title, name} = gewaehltePraesentation();
if (!content?.order?.length) {
  console.error('content.json is missing or contains no scenes.');
  process.exit(1);
}

// Same calculation as in the presenter (editor/main.tsx): stops of all scenes converted to the overall timeline.
const total = content.order.reduce((a, id) => a + content.scenes[id].dur, 0);
const pages = [];
let start = 0;
for (const id of content.order) {
  for (const s of content.scenes[id].stops ?? []) pages.push(start + s);
  start += content.scenes[id].dur;
}
const frames = [...new Set([...pages.filter((f) => f > 0 && f < total), total - 1])].sort((a, b) => a - b);

const out = path.join(dir, 'out', `${name}.pdf`);
console.log(`PDF "${title}": ${frames.length} pages → ${out}`);
console.log('PROGRESS 0');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showpoint-pdf-'));
const stage = await openStage(dir);
const pdf = await PDFDocument.create();
pdf.setTitle(title);
pdf.setCreator('ShowPoint');
// 16:9 page in points (1920 × 1080 pixels → 960 × 540 pt, i.e. 2 pixels per point)
const W = 960;
const H = 540;
try {
  for (const [i, frame] of frames.entries()) {
    const file = path.join(tmp, `${i}.jpg`);
    await stage.shot(frame, file, {quality: 90});
    const img = await pdf.embedJpg(fs.readFileSync(file));
    pdf.addPage([W, H]).drawImage(img, {x: 0, y: 0, width: W, height: H});
    console.log(`PROGRESS ${Math.round(((i + 1) / frames.length) * 100)}`);
  }
} finally {
  await stage.close();
  fs.rmSync(tmp, {recursive: true, force: true});
}
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.writeFileSync(out, await pdf.save());
console.log(`DONE ${out}`);
