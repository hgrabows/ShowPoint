// Minimal MCP server (stdio, JSON-RPC) with exactly one tool "vorschau" (preview) for Claude Code.
// The presentation folder is fixed at startup (argument); Claude only chooses the scenes.
// That way Claude needs no Bash and cannot run anything else.
import {execFile} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {fileURLToPath} from 'node:url';

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
  if (msg.method === 'tools/list') return send({id: msg.id, result: {tools: [tool]}});
  if (msg.method === 'tools/call') {
    if (msg.params?.name !== 'vorschau') return send({id: msg.id, error: {code: -32602, message: 'Unknown tool'}});
    return send({id: msg.id, result: await vorschau(msg.params?.arguments?.scenes)});
  }
  if (msg.method === 'ping') return send({id: msg.id, result: {}});
  send({id: msg.id, error: {code: -32601, message: `Unknown method ${msg.method}`}});
});
