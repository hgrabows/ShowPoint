// Installs an npm package into ONE presentation (its own package.json / node_modules), for slides that need a
// library ShowPoint does not bring along (maps, graphs, special charts …). Used by Claude through the MCP tool
// "paket" (scripts/vorschau-mcp.mjs); also usable by hand:
//   node scripts/paket.mjs <presentation folder> <package>[@version]
// Rules: size limit, exact version, no install scripts; React always comes from ShowPoint. Packages without a free
// open-source licence are installed too, but marked (tool answer and PAKETE.md in the presentation) – unless
// PAKETE_NUR_FREI=1 is set in .env, then only free licences are accepted.
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ALLOWED = /^(MIT|MIT-0|ISC|0BSD|BSD-2-Clause|BSD-3-Clause|Apache-2\.0|Unlicense|CC0-1\.0|BlueOak-1\.0\.0|Python-2\.0|Zlib|WTFPL)$/i;
const BLOCKED = /^(react|react-dom|react\/.*|showpoint|remotion|@remotion\/.*|scheduler)$/;
const MAX_MB = 100;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function strictMode() {
  if (process.env.PAKETE_NUR_FREI) return /^(1|true|ja|yes)$/i.test(process.env.PAKETE_NUR_FREI);
  try {
    return /^PAKETE_NUR_FREI=(1|true|ja|yes)\s*$/im.test(fs.readFileSync(path.join(root, '.env'), 'utf8'));
  } catch {
    return false;
  }
}

/** PAKETE.md in the presentation: every installed package with its licence; ⚠ marks licences that are not free. */
function writeList(dir) {
  let deps = {};
  try {
    deps = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies ?? {};
  } catch {
    return;
  }
  const all = new Map(installedLicences(dir).map((p) => [p.name, p]));
  const rows = Object.keys(deps)
    .sort()
    .map((n) => {
      const p = all.get(n);
      const lic = p?.license ?? 'unknown';
      return `| ${n} | ${p?.version ?? deps[n]} | ${lic} | ${licenseOk(lic) ? '' : '⚠ check the terms'} |`;
    });
  const others = [...all.values()].filter((p) => !(p.name in deps) && !licenseOk(p.license));
  const text = [
    '# Packages of this presentation',
    '',
    'Installed by the presenter (tool "paket"). ⚠ = no free open-source licence: fine for your own use;',
    'before passing the presentation (or its PDF/video) on, or using it commercially, check that licence.',
    '',
    '| Package | Version | Licence | |',
    '|---|---|---|---|',
    ...rows,
    ...(others.length ? ['', `Dependencies with other licences: ${others.map((p) => `${p.name}@${p.version} (${p.license})`).join(', ')}`] : []),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'PAKETE.md'), text);
}
const NAME = /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;

const run = (cmd, args, cwd, timeout = 180_000) =>
  new Promise((resolve) => {
    execFile(cmd, args, {cwd, timeout, maxBuffer: 20_000_000, env: {...process.env, npm_config_update_notifier: 'false'}}, (err, stdout, stderr) =>
      resolve({ok: !err, out: String(stdout), err: String(stderr || err?.message || '')}),
    );
  });

const licenseOf = (l) => (typeof l === 'string' ? l : l?.type ?? (Array.isArray(l) ? l.map((x) => x.type ?? x).join(' OR ') : '')) || 'unknown';

export function licenseOk(expr) {
  const parts = String(expr).replace(/[()]/g, '').split(/\s+(OR|AND)\s+/i);
  const ids = parts.filter((_, i) => i % 2 === 0);
  const ops = parts.filter((_, i) => i % 2 === 1).map((o) => o.toUpperCase());
  return ops.includes('AND') ? ids.every((id) => ALLOWED.test(id)) : ids.some((id) => ALLOWED.test(id));
}

async function view(spec) {
  const r = await run('npm', ['view', spec, 'name', 'version', 'license', 'dist.unpackedSize', 'types', 'typings', 'deprecated', '--json'], process.cwd(), 60_000);
  if (!r.ok) return null;
  try {
    const data = JSON.parse(r.out || 'null');
    return Array.isArray(data) ? data[data.length - 1] : data;
  } catch {
    return null;
  }
}

/** Licences of everything installed in the presentation (dependencies of dependencies included). */
export function installedLicences(dir) {
  const nm = path.join(dir, 'node_modules');
  const found = [];
  if (!fs.existsSync(nm)) return found;
  const visit = (p) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(p, 'package.json'), 'utf8'));
      found.push({name: pkg.name, version: pkg.version, license: licenseOf(pkg.license ?? pkg.licenses)});
    } catch {
      // no package.json
    }
  };
  for (const n of fs.readdirSync(nm)) {
    if (n.startsWith('.')) continue;
    if (n.startsWith('@')) for (const m of fs.readdirSync(path.join(nm, n))) visit(path.join(nm, n, m));
    else visit(path.join(nm, n));
  }
  return found;
}

/** Installed packages of the presentation without a free open-source licence (for the notice in the presenter). */
export function nonFreePackages(dir) {
  if (!fs.existsSync(path.join(dir, 'package.json'))) return [];
  return installedLicences(dir)
    .filter((p) => !licenseOk(p.license))
    .map(({name, version, license}) => ({name, version, license}));
}

/**
 * @returns {Promise<{ok: boolean, text: string}>}
 */
export async function installPackage(dir, specIn) {
  const spec = String(specIn ?? '').trim();
  const at = spec.lastIndexOf('@');
  const name = at > 0 ? spec.slice(0, at) : spec;
  const range = at > 0 ? spec.slice(at + 1) : 'latest';
  if (!NAME.test(name) || !/^[\w.^~<>=*| -]+$/.test(range)) return {ok: false, text: `"${spec}" is not a valid npm package name.`};
  if (BLOCKED.test(name)) return {ok: false, text: `${name} is provided by ShowPoint itself and must not be installed into the presentation. Import react and 'showpoint' directly.`};
  if (!fs.existsSync(path.join(dir, 'src', 'content.json'))) return {ok: false, text: `${dir} is not a presentation folder.`};

  const info = await view(`${name}@${range}`);
  if (!info?.version) return {ok: false, text: `Package ${name}@${range} not found on npm (or npm is not reachable).`};
  const license = licenseOf(info.license);
  const free = licenseOk(license);
  if (!free && strictMode()) return {ok: false, text: `${name}@${info.version} has the licence "${license}". This presenter only accepts free licences (PAKETE_NUR_FREI in .env): MIT, ISC, BSD, Apache-2.0 … Choose another package or draw it with SVG and the building blocks from 'showpoint'.`};
  const mb = (info['dist.unpackedSize'] ?? 0) / 1e6;
  if (mb > MAX_MB) return {ok: false, text: `${name}@${info.version} is ${mb.toFixed(0)} MB – more than ${MAX_MB} MB allowed. Choose a smaller package.`};

  // the presentation's own package.json
  const pj = path.join(dir, 'package.json');
  if (!fs.existsSync(pj)) {
    fs.writeFileSync(pj, JSON.stringify({private: true, description: 'Packages for this ShowPoint presentation (installed with the presenter tool "paket").', dependencies: {}}, null, 2) + '\n');
  }
  const gi = path.join(dir, '.gitignore');
  const giText = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  if (!/^\/?node_modules\/?$/m.test(giText)) fs.writeFileSync(gi, giText + (giText && !giText.endsWith('\n') ? '\n' : '') + 'node_modules\n');

  const flags = ['--save-exact', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps', '--loglevel=error'];
  const r = await run('npm', ['install', ...flags, `${name}@${info.version}`], dir);
  if (!r.ok) return {ok: false, text: `npm install failed:\n${r.err.slice(-1500)}`};

  // types: bundled, or from @types
  const pkgDir = path.join(dir, 'node_modules', name);
  let typesNote = '';
  let hasTypes = !!(info.types || info.typings) || fs.existsSync(path.join(pkgDir, 'index.d.ts'));
  try {
    const own = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
    if (own.types || own.typings || own.exports?.['.']?.types) hasTypes = true;
  } catch {
    // ignore
  }
  if (!hasTypes) {
    const tname = `@types/${name.startsWith('@') ? name.slice(1).replace('/', '__') : name}`;
    const t = await view(tname);
    if (t?.version && licenseOk(licenseOf(t.license))) {
      const rt = await run('npm', ['install', ...flags, `${tname}@${t.version}`], dir);
      typesNote = rt.ok ? ` Types: ${tname}@${t.version}.` : ` Types: installing ${tname} failed.`;
    } else {
      typesNote = ` No TypeScript types available: declare the module yourself in src/types.d.ts (declare module '${name}';) or type what you use.`;
    }
  }

  const others = installedLicences(dir).filter((p) => p.name !== name && !licenseOk(p.license));
  const warn = others.length ? `\nNote – dependencies with other licences: ${others.map((p) => `${p.name}@${p.version} (${p.license})`).join(', ')}.` : '';
  writeList(dir);
  const licNote = free
    ? ''
    : `\n⚠ Licence "${license}" is not a free open-source licence. Fine for the user's own use; tell the user in your final answer that ${name} must be checked before the presentation is passed on or used commercially (noted in PAKETE.md). Prefer a freely licensed alternative if one does the job equally well.`;
  const deprecated = info.deprecated ? `\nNote: this version is marked deprecated: ${info.deprecated}` : '';
  return {
    ok: true,
    text:
      `Installed ${name}@${info.version} (${license}, ${mb.toFixed(1)} MB) into ${path.join(dir, 'node_modules')}.${typesNote}${licNote}${warn}${deprecated}\n` +
      `Import it in the slides as usual (import … from '${name}'). Remember: every frame must follow from useCurrentFrame() alone – switch off the library's own animations and timers. Check with the tool "vorschau".`,
  };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [dirArg, ...specs] = process.argv.slice(2);
  if (!dirArg || !specs.length) {
    console.log('Usage: node scripts/paket.mjs <presentation folder> <package>[@version] …');
    process.exit(1);
  }
  const dir = fs.realpathSync(path.resolve(dirArg));
  let ok = true;
  for (const s of specs) {
    const r = await installPackage(dir, s);
    console.log(r.text);
    ok &&= r.ok;
  }
  process.exit(ok ? 0 : 1);
}
