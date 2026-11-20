// Rendert die im Präsentator gewählte Präsentation (INHALT in .env) als Video.
// Aufruf: npm run render            → <Ordner der Präsentation>/out/<titel>.mp4
//         npm run render -- --frames=0-90   (weitere Remotion-Optionen werden durchgereicht)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
const rel = (process.env.INHALT || (env.match(/^INHALT=(.*)$/m)?.[1] ?? '')).trim();
if (!rel) {
  console.error('Keine Präsentation gewählt. Im Präsentator unter „Präsentation“ eine wählen (oder INHALT=… setzen).');
  process.exit(1);
}
const dir = path.resolve(root, rel);
const entry = path.join(dir, 'src', 'index.ts');
if (!fs.existsSync(entry)) {
  console.error(`Zum Rendern fehlt ${entry} (registriert die Komposition mit registerRoot).`);
  process.exit(1);
}
let title = path.basename(fs.realpathSync(dir));
try {
  title = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8')).title || title;
} catch {
  // ohne Titel gilt der Ordnername
}
const name = title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'praesentation';
const out = path.join(fs.realpathSync(dir), 'out', `${name}.mp4`);
console.log(`Rendere „${title}“ → ${out}`);
const r = spawnSync('npx', ['remotion', 'render', entry, `--output=${out}`, ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
