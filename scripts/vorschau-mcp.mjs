// Minimal MCP server (stdio, JSON-RPC) with three tools for Claude Code: "vorschau" (preview), "paket"
// (install an npm package into the presentation) and "plantuml" (render a PlantUML diagram of the presentation). The presentation folder is fixed at startup (argument);
// Claude only chooses scenes, a package name or a diagram name. That way Claude needs no Bash and cannot run anything else.
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';
import {installPackage} from './paket.mjs';
import {renderDiagram} from './plantuml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = process.argv[2];
const send = (msg) => process.stdout.write(JSON.stringify({jsonrpc: '2.0', ...msg}) + '\n');

const tool = {
  name: 'vorschau',
  description:
    'Checks content.json and the types of the presentation and renders the given scenes at every stop (plus the final frame) as images (960×540, half the size of the 1920×1080 stage). Returns messages and the images. Takes a few seconds per scene; at most 40 images per call.',
  inputSchema: {
    type: 'object',
    properties: {scenes: {type: 'array', items: {type: 'string'}, description: 'Scene IDs from content.json (order). Empty = all scenes.'}},
    required: ['scenes'],
  },
};

const paketTool = {
  name: 'paket',
  description:
    "Installs an npm package (e.g. 'd3-geo' or 'd3-geo@3.1.1') into this presentation's own node_modules, so slides can import it. Only for things the building blocks from 'showpoint' cannot do (maps, network graphs, special charts …). Prefer freely licensed packages (MIT, ISC, BSD, Apache-2.0); others are installed but marked. Max. 100 MB, exact version, no install scripts; react and showpoint are already there. Missing TypeScript types are added from @types when they exist.",
  inputSchema: {
    type: 'object',
    properties: {name: {type: 'string', description: "Package name, optionally with version: 'name' or 'name@1.2.3'."}},
    required: ['name'],
  },
};

const plantumlTool = {
  name: 'plantuml',
  description:
    "Renders a PlantUML diagram of this presentation: reads src/diagramme/<name>.puml (write it first) and writes src/diagramme/<name>.svg next to it, in the colours of the dark slides. Runs locally, no network; !include and URLs are not available. Returns the size of the picture and how to import it, or the PlantUML error with its line. Call it again after every change of the .puml file.",
  inputSchema: {
    type: 'object',
    properties: {name: {type: 'string', description: "Diagram name without folder and ending, e.g. 'schema' for src/diagramme/schema.puml."}},
    required: ['name'],
  },
};

function vorschau(scenes) {
  return new Promise((resolve) => {
    const ids = (Array.isArray(scenes) ? scenes : []).map(String).filter((s) => /^[\w-]+$/.test(s));
    execFile(process.execPath, [path.join(here, 'vorschau.mjs'), dir, ...ids], {cwd: path.join(here, '..'), maxBuffer: 8_000_000, timeout: 300_000}, (err, stdout, stderr) => {
      const text = (String(stdout) + (err && stderr ? `\n${String(stderr).slice(-2000)}` : '')).trim();
      const content = [{type: 'text', text: text || 'no output'}];
      if (!err) {
        for (const m of text.matchAll(/: (\/\S+\.jpg)$/gm)) {
          try {
            content.push({type: 'text', text: path.basename(m[1])});
            content.push({type: 'image', mimeType: 'image/jpeg', data: fs.readFileSync(m[1]).toString('base64')});
          } catch {
            // image missing – then it is mentioned in the text output
          }
        }
      }
      resolve({content, isError: !!err});
    });
  });
}

readline.createInterface({input: process.stdin}).on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  if (msg.id === undefined) return; // notification
  if (msg.method === 'initialize') {
    return send({id: msg.id, result: {protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: {tools: {}}, serverInfo: {name: 'showpoint', version: '1.0.0'}}});
  }
  if (msg.method === 'tools/list') return send({id: msg.id, result: {tools: [tool, paketTool, plantumlTool]}});
  if (msg.method === 'tools/call') {
    if (msg.params?.name === 'paket') {
      const r = await installPackage(dir, msg.params?.arguments?.name);
      return send({id: msg.id, result: {content: [{type: 'text', text: r.text}], isError: !r.ok}});
    }
    if (msg.params?.name === 'plantuml') {
      const r = await renderDiagram(dir, msg.params?.arguments?.name);
      return send({id: msg.id, result: {content: [{type: 'text', text: r.text}], isError: !r.ok}});
    }
    if (msg.params?.name !== 'vorschau') return send({id: msg.id, error: {code: -32602, message: 'Unknown tool'}});
    return send({id: msg.id, result: await vorschau(msg.params?.arguments?.scenes)});
  }
  if (msg.method === 'ping') return send({id: msg.id, result: {}});
  send({id: msg.id, error: {code: -32601, message: `Unknown method ${msg.method}`}});
});
