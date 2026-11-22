// PlantUML for slides: turns a diagram text (src/diagramme/<name>.puml in a presentation) into an SVG next to it,
// which the slide imports like any image. Runs locally – nothing is sent to a server.
//   node scripts/plantuml.mjs --setup                       download PlantUML once (npm run plantuml)
//   node scripts/plantuml.mjs <presentation folder> <file>  render src/diagramme/<file>.puml → .svg
// Used by Claude through the MCP tool "plantuml" (scripts/vorschau-mcp.mjs).
// Only needed to create or change diagrams: the finished SVG lives in the presentation, so presenting, PDF and video
// work without PlantUML.
import {execFile, spawn} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// PlantUML, pinned to one version (same pictures on every machine); every download is checked against its SHA-256.
// Where PlantUML offers a native program it is used – no Java needed. Elsewhere: the jar (MIT build), run with Java.
const VERSION = '1.2026.10';
const BASE = `https://github.com/plantuml/plantuml/releases/download/v${VERSION}/`;
const NATIVE = {
  'darwin-arm64': {file: `native-plantuml-macos-arm64-${VERSION}.zip`, sha: '2048ee3fcaa99e43db4ff5e242b06ee9c0346c047f4649eec61fcf6f68b72372', exe: 'plantuml'},
  'linux-x64': {file: `native-plantuml-linux-amd64-${VERSION}.zip`, sha: 'ff48ceb0e2c01d80fa96f09d44c84c00f9b8625f711ccc64cd34de57742ba801', exe: 'plantuml'},
  'linux-arm64': {file: `native-plantuml-linux-arm64-${VERSION}.zip`, sha: 'ea47dd16801b249cf27a641acae507eae9398fcaa1794d94095f2da2c7ffc48a', exe: 'plantuml'},
  'win32-x64': {file: `native-plantuml-windows-amd64-${VERSION}.zip`, sha: '15cbbed35cbc7a35a22090168b0b346ee3babd290dc23b6e51b291cc9554d709', exe: 'plantuml.exe'},
}[`${process.platform}-${process.arch}`];
const JAR = {file: `plantuml-mit-${VERSION}.jar`, sha: '30a66b81a16127fd3ec560992f31964fe9ae3f1233c614ef4558a4558a21489e'};
const toolDir = path.join(root, '.werkzeuge', `plantuml-${VERSION}`);
const nativePath = NATIVE ? path.join(toolDir, NATIVE.exe) : '';
const jarPath = path.join(toolDir, JAR.file);

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const run = (cmd, args, opts = {}) =>
  new Promise((resolve) => {
    execFile(cmd, args, {timeout: 120_000, ...opts}, (err, stdout, stderr) => resolve({ok: !err, out: String(stdout), err: String(stderr || err?.message || '')}));
  });
const hasJava = async () => (await run('java', ['-version'], {timeout: 20_000})).ok;

/** How PlantUML is started here: the native program, else java -jar; null when nothing is installed yet. */
async function command() {
  if (nativePath && fs.existsSync(nativePath)) return {cmd: nativePath, args: []};
  if (fs.existsSync(jarPath) && (await hasJava())) return {cmd: 'java', args: ['-Djava.awt.headless=true', '-jar', jarPath]};
  return null;
}

/** What is missing to draw PlantUML diagrams; empty string = ready. */
export async function missing() {
  if (await command()) return '';
  if (fs.existsSync(jarPath)) return 'Java is not installed (this system has no native PlantUML program, so the jar needs Java; e.g. https://adoptium.net).';
  return `PlantUML is not installed yet: run "npm run plantuml" once in ${root} (downloads PlantUML ${VERSION}${NATIVE ? ', no Java needed' : '; Java is needed on this system'}).`;
}

async function download(item, dest) {
  const res = await fetch(BASE + item.file, {redirect: 'follow'});
  if (!res.ok) return `Download failed (${res.status}): ${BASE + item.file}`;
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  const sum = sha256(dest);
  if (sum === item.sha) return '';
  fs.rmSync(dest, {force: true});
  return `The downloaded ${item.file} does not match the expected checksum (got ${sum}). Nothing was installed.`;
}

export async function setup() {
  if (await command()) return {ok: true, text: `PlantUML ${VERSION} is ready: ${nativePath && fs.existsSync(nativePath) ? nativePath : jarPath}`};
  fs.mkdirSync(toolDir, {recursive: true});
  if (NATIVE) {
    const zip = path.join(toolDir, NATIVE.file);
    const problem = await download(NATIVE, zip);
    if (problem) return {ok: false, text: problem};
    // unzip is on macOS and Linux; Windows brings tar, which reads zip files
    const r = process.platform === 'win32' ? await run('tar', ['-xf', zip, '-C', toolDir]) : await run('unzip', ['-oq', zip, '-d', toolDir]);
    fs.rmSync(zip, {force: true});
    if (!r.ok || !fs.existsSync(nativePath)) return {ok: false, text: `Unpacking ${NATIVE.file} failed: ${r.err.slice(-500)}`};
    if (process.platform !== 'win32') fs.chmodSync(nativePath, 0o755);
    return {ok: true, text: `PlantUML ${VERSION} installed (native program, no Java needed): ${nativePath}`};
  }
  const problem = await download(JAR, jarPath);
  if (problem) return {ok: false, text: problem};
  const java = await hasJava();
  return {ok: true, text: `PlantUML ${VERSION} (jar) installed: ${jarPath}${java ? '' : '\nNote: Java was not found – install it (e.g. https://adoptium.net) to draw diagrams.'}`};
}

// Look of the slides (dark stage). Comes first, so a diagram – or a spec in vorgaben/ – can override single values.
const THEME = `<style>
root {
  FontName "Helvetica Neue", Helvetica, Arial, sans-serif
  FontColor #E8ECF8
  LineColor #7F8DB8
  BackgroundColor transparent
}
document { BackgroundColor transparent }
element {
  BackgroundColor #1B2444
  LineColor #7F8DB8
  FontColor #E8ECF8
  LineThickness 1.5
  RoundCorner 10
}
classDiagram {
  class {
    BackgroundColor #1B2444
    LineColor #7F8DB8
    FontColor #E8ECF8
    header { FontStyle bold; FontColor #FFFFFF }
  }
}
arrow { LineColor #A9B4D6; FontColor #C9D1EC; LineThickness 1.5 }
note { BackgroundColor #2A2440; LineColor #7C5CFF; FontColor #E8ECF8 }
title { FontColor #FFFFFF }
</style>
skinparam shadowing false
skinparam defaultFontSize 18
skinparam classAttributeIconSize 0
`;

function prepare(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let i = lines.findIndex((l) => /^\s*@start\w+/.test(l));
  if (i < 0) {
    lines.unshift('@startuml');
    lines.push('@enduml');
    i = 0;
  }
  // own layout engine of PlantUML (no Graphviz needed, same result on every machine) – unless the diagram chooses
  const layout = /!pragma\s+layout\b/i.test(source) ? '' : '!pragma layout smetana\n';
  lines.splice(i + 1, 0, layout + THEME);
  return lines.join('\n');
}

const runPlantuml = (c, input) =>
  new Promise((resolve) => {
    // SANDBOX: the diagram text cannot read files or fetch URLs (!include and the like are refused)
    const p = spawn(c.cmd, [...c.args, '-DPLANTUML_SECURITY_PROFILE=SANDBOX', '-DPLANTUML_LIMIT_SIZE=8192', '-tsvg', '-pipe', '-charset', 'UTF-8', '-stdrpt:1', '-nometadata'], {cwd: toolDir});
    const out = [];
    const err = [];
    const timer = setTimeout(() => p.kill('SIGKILL'), 90_000);
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => {
      clearTimeout(timer);
      resolve({code: -1, out: '', err: String(e.message)});
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      resolve({code, out: Buffer.concat(out).toString('utf8'), err: Buffer.concat(err).toString('utf8')});
    });
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });

/**
 * Renders <dir>/src/diagramme/<name>.puml to <name>.svg in the same folder.
 * @returns {Promise<{ok: boolean, text: string}>}
 */
export async function renderDiagram(dir, fileIn) {
  const name = path.basename(String(fileIn ?? '').trim()).replace(/\.(puml|plantuml|svg)$/i, '');
  if (!/^[\w.-]+$/.test(name)) return {ok: false, text: `"${fileIn}" is not a valid diagram name. Use letters, digits, - and _ (e.g. "schema").`};
  if (!fs.existsSync(path.join(dir, 'src', 'content.json'))) return {ok: false, text: `${dir} is not a presentation folder.`};
  const folder = path.join(dir, 'src', 'diagramme');
  const puml = path.join(folder, `${name}.puml`);
  if (!fs.existsSync(puml)) return {ok: false, text: `${puml} does not exist. Write the PlantUML text there first (Write), then call this tool with "${name}".`};
  const lack = await missing();
  if (lack) return {ok: false, text: `PlantUML cannot run here: ${lack} Tell the user this in your final answer; do not replace the diagram with a hand-drawn imitation unless the task allows it.`};

  const source = fs.readFileSync(puml, 'utf8');
  const input = prepare(source);
  const r = await runPlantuml(await command(), input);
  const svgStart = r.out.indexOf('<svg');
  // a syntax error still yields a picture (of the error) – the report on stderr tells
  const report = r.err.trim();
  if (r.code !== 0 || svgStart < 0 || /^status=ERROR/m.test(report)) {
    // line numbers refer to the text with the theme inserted: map them back to the file
    const added = input.split('\n').length - source.replace(/\r\n?/g, '\n').split('\n').length;
    const n = Number(report.match(/^lineNumber=(\d+)/m)?.[1]);
    const line = Number.isFinite(n) ? Math.max(1, n - added) : 0;
    const label = report.match(/^label=(.*)$/m)?.[1] ?? report.slice(0, 600) ?? `exit code ${r.code}`;
    const shown = line ? `\n${line}: ${source.split(/\r?\n/)[line - 1] ?? ''}` : '';
    return {ok: false, text: `PlantUML reports an error${line ? ` in line ${line} of ${name}.puml` : ''}: ${label}${shown}\nFix ${puml} and call the tool again. The old ${name}.svg (if any) was left unchanged.`};
  }
  const svg = r.out.slice(svgStart);
  const svgFile = path.join(folder, `${name}.svg`);
  fs.writeFileSync(svgFile, svg);
  const w = Number(svg.match(/\bwidth="([\d.]+)px"/)?.[1] ?? svg.match(/viewBox="[\d.]+ [\d.]+ ([\d.]+)/)?.[1]);
  const h = Number(svg.match(/\bheight="([\d.]+)px"/)?.[1] ?? svg.match(/viewBox="[\d.]+ [\d.]+ [\d.]+ ([\d.]+)/)?.[1]);
  const size = w && h ? ` Natural size ${Math.round(w)} × ${Math.round(h)} px (aspect ratio ${(w / h).toFixed(2)}); scale it into the free area of the slide keeping this ratio.` : '';
  return {
    ok: true,
    text:
      `Rendered ${svgFile}.${size}\n` +
      `In the scene file: import ${name.replace(/[^\w]/g, '_')} from './diagramme/${name}.svg'; then <Img src={…} style={{position: 'absolute', left: …, top: …, width: …, height: …, objectFit: 'contain'}} /> (Img from 'showpoint'). ` +
      `The colours already match the dark slides. After every change of ${name}.puml call this tool again, then check the slide with "vorschau" (text at least about 18 px high on the 1920×1080 stage – otherwise split the diagram or enlarge it).`,
  };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [a, b] = process.argv.slice(2);
  if (a === '--setup') {
    const r = await setup();
    console.log(r.text);
    process.exit(r.ok ? 0 : 1);
  }
  if (!a || !b) {
    console.log('Usage: node scripts/plantuml.mjs --setup | <presentation folder> <diagram name>');
    process.exit(1);
  }
  const r = await renderDiagram(fs.realpathSync(path.resolve(a)), b);
  console.log(r.text);
  process.exit(r.ok ? 0 : 1);
}
