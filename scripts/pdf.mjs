// Creates a PDF from the presentation chosen in the presenter: one page per stop
// (exactly the frame at which the presenter pauses) plus the final frame – or, with --scenes, one page per scene
// (its last stop, where the scene is complete).
// Usage: npm run pdf [-- --scenes]   → <presentation folder>/out/<title>.pdf
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

const perScene = process.argv.includes('--szenen') || process.argv.includes('--scenes');
// Same calculation as in the presenter (editor/main.tsx): stops of all scenes converted to the overall timeline.
const total = content.order.reduce((a, id) => a + content.scenes[id].dur, 0);
const pages = [];
let start = 0;
for (const id of content.order) {
  const sc = content.scenes[id];
  if (perScene) {
    // as in the PowerPoint export: the last stop, or shortly before the end (a scene fades out at its very end)
    const stops = (sc.stops ?? []).filter((s) => s > 0 && s < sc.dur);
    pages.push(start + (stops.length ? Math.max(...stops) : Math.max(0, sc.dur - 15)));
  } else for (const s of sc.stops ?? []) pages.push(start + s);
  start += sc.dur;
}
const frames = perScene
  ? [...new Set(pages)].sort((a, b) => a - b)
  : [...new Set([...pages.filter((f) => f > 0 && f < total), total - 1])].sort((a, b) => a - b);

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
