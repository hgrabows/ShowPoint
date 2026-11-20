// Rendert die im Präsentator gewählte Präsentation (INHALT in .env) als Video.
// Aufruf: npm run render            → <Ordner der Präsentation>/out/<titel>.mp4
//         npm run render -- --frames=0-90   (weitere Remotion-Optionen werden durchgereicht)
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {gewaehltePraesentation} from './inhalt.mjs';

const {dir, entry, title, name} = gewaehltePraesentation();
const out = path.join(dir, 'out', `${name}.mp4`);
console.log(`Rendere „${title}“ → ${out}`);
const r = spawnSync('npx', ['remotion', 'render', entry, `--output=${out}`, ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
