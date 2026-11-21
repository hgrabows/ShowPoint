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
  if (!fs.existsSync(path.join(dir, 'src', 'Video.tsx'))) {
    console.error(`${dir} is not a presentation folder: src/Video.tsx is missing.`);
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
  return {root, dir, content, title, name};
}
