// Gemeinsam für render.mjs und pdf.mjs: findet die im Präsentator gewählte Präsentation (INHALT in .env).
import fs from 'node:fs';
import path from 'node:path';

export function gewaehltePraesentation() {
  const root = process.cwd();
  const env = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const rel = (process.env.INHALT || (env.match(/^INHALT=(.*)$/m)?.[1] ?? '')).trim();
  if (!rel) {
    console.error('Keine Präsentation gewählt. Im Präsentator unter „Präsentation“ eine wählen (oder INHALT=… setzen).');
    process.exit(1);
  }
  const dir = fs.realpathSync(path.resolve(root, rel));
  const entry = path.join(dir, 'src', 'index.ts');
  if (!fs.existsSync(entry)) {
    console.error(`Zum Rendern fehlt ${entry} (registriert die Komposition mit registerRoot).`);
    process.exit(1);
  }
  let content = null;
  let title = path.basename(dir);
  try {
    content = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'content.json'), 'utf8'));
    title = content.title || title;
  } catch {
    // ohne Titel gilt der Ordnername
  }
  const name = title.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/^-|-$/g, '') || 'praesentation';
  return {root, dir, entry, content, title, name};
}
