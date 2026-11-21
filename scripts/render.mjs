// Renders the presentation chosen in the presenter (INHALT in .env) as an MP4 video (needs ffmpeg).
// Usage: npm run render                  → <presentation folder>/out/<title>.mp4
//        npm run render -- --frames=0-90 (only these frames)
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {gewaehltePraesentation} from './inhalt.mjs';
import {openStage} from './stills.mjs';

const {dir, title, name} = gewaehltePraesentation();
if (spawnSync('ffmpeg', ['-version']).error) {
  console.error('ffmpeg is needed to write the video. Install it (macOS: brew install ffmpeg) and try again.');
  process.exit(1);
}
const out = path.join(dir, 'out', `${name}.mp4`);
const pages = Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2)));
const stage = await openStage(dir, {pages});
let [from, to] = [0, stage.durationInFrames - 1];
const arg = process.argv.find((a) => a.startsWith('--frames='));
if (arg) {
  const m = arg.slice(9).match(/^(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error('--frames expects a frame or a range such as 0-90');
  from = Number(m[1]);
  to = Math.min(to, Number(m[2] ?? m[1]));
}
const count = to - from + 1;
console.log(`Rendering "${title}": ${count} frames → ${out}`);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'showpoint-video-'));
const t0 = Date.now();
let done = 0;
try {
  // every browser tab takes every n-th frame
  await Promise.all(
    Array.from({length: stage.pages}, async (_, tab) => {
      for (let f = from + tab; f <= to; f += stage.pages) {
        await stage.shot(f, path.join(tmp, `${String(f - from).padStart(6, '0')}.jpg`), {quality: 92, tab});
        if (++done % 150 === 0 || done === count) {
          const s = (Date.now() - t0) / 1000;
          process.stdout.write(`\r${done}/${count} frames (${Math.round((done / count) * 100)} %), ${Math.round(s)} s`);
        }
      }
    }),
  );
  process.stdout.write('\n');
} finally {
  await stage.close();
}
fs.mkdirSync(path.dirname(out), {recursive: true});
const code = await new Promise((resolve) => {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', path.join(tmp, '%06d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out], {stdio: 'inherit'});
  ff.on('close', resolve);
});
fs.rmSync(tmp, {recursive: true, force: true});
if (code !== 0) process.exit(code ?? 1);
console.log(`Done: ${out}`);
