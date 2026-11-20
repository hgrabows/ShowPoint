// Shared by render.mjs and pdf.mjs: finds the presentation chosen in the presenter (INHALT in .env).
import fs from 'node:fs';
import path from 'node:path';

export function gewaehltePraesentation() {
  const root = process.cwd();
  const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const rel = (process.env.INHALT || (env.match(/^INHALT=(.*)$/m)?.[1] ?? '')).trim();
  if (!rel) {
    console.error('No presentation selected. Choose one in the presenter under "Presentation" (or set INHALT=…).');
    process.exit(1);
  }
  const dir = fs.realpathSync(path.resolve(root, rel));
  const entry = path.join(dir, 'src', 'index.ts');
  if (!fs.existsSync(entry)) {
    console.error(`Rendering needs ${entry} (registers the composition with registerRoot).`);
    process.exit(1);
  }
  let content = null;
  let title = path.basename(dir);
  try {
    content = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8'));
    title = content.title || title;
  } catch {
    // without a title the folder name is used
  }
  const name = title.toLowerCase().replace(/[^a-z0-9\u00e4\u00f6\u00fc\u00df]+/g, '-').replace(/^-|-$/g, '') || 'praesentation';
  return {root, dir, entry, content, title, name};
}
