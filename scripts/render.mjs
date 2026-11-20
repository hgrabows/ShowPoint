// Renders the presentation chosen in the presenter (INHALT in .env) as a video.
// Usage: npm run render            → <presentation folder>/out/<title>.mp4
//        npm run render -- --frames=0-90   (further Remotion options are passed through)
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {gewaehltePraesentation} from './inhalt.mjs';

const {dir, entry, title, name} = gewaehltePraesentation();
const out = path.join(dir, 'out', `${name}.mp4`);
console.log(`Rendering "${title}" → ${out}`);
const r = spawnSync('npx', ['remotion', 'render', entry, `--output=${out}`, ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status ?? 1);
