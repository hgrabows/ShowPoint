// Minimaler MCP-Server (stdio, JSON-RPC) mit genau einem Werkzeug „vorschau“ für Claude Code.
// Der Ordner der Präsentation wird beim Start festgelegt (Argument), Claude wählt nur die Szenen.
// So braucht Claude kein Bash und kann nichts anderes ausführen.
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
    'Prüft content.json und die Typen der Präsentation und rendert die genannten Szenen an jedem Haltepunkt (plus Schlussbild) als Bild (960×540, halbe Größe der Bühne 1920×1080). Gibt Meldungen und die Bilder zurück. Dauert einige Sekunden je Szene; höchstens 40 Bilder je Aufruf.',
  inputSchema: {
    type: 'object',
    properties: {szenen: {type: 'array', items: {type: 'string'}, description: 'Szenen-IDs aus content.json (order). Leer = alle Szenen.'}},
    required: ['szenen'],
  },
};

function vorschau(szenen) {
  return new Promise((resolve) => {
    const ids = (Array.isArray(szenen) ? szenen : []).map(String).filter((s) => /^[\w-]+$/.test(s));
    execFile(process.execPath, [path.join(here, 'vorschau.mjs'), dir, ...ids], {cwd: path.join(here, '..'), maxBuffer: 8_000_000, timeout: 300_000}, (err, stdout, stderr) => {
      const text = (String(stdout) + (err && stderr ? `\n${String(stderr).slice(-2000)}` : '')).trim();
      const content = [{type: 'text', text: text || 'keine Ausgabe'}];
      if (!err) {
        for (const m of text.matchAll(/: (\/\S+\.jpg)$/gm)) {
          try {
            content.push({type: 'text', text: path.basename(m[1])});
            content.push({type: 'image', mimeType: 'image/jpeg', data: fs.readFileSync(m[1]).toString('base64')});
          } catch {
            // Bild fehlt – steht dann in der Textausgabe
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
  if (msg.id === undefined) return; // Benachrichtigung
  if (msg.method === 'initialize') {
    return send({id: msg.id, result: {protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: {tools: {}}, serverInfo: {name: 'showpoint', version: '1.0.0'}}});
  }
  if (msg.method === 'tools/list') return send({id: msg.id, result: {tools: [tool]}});
  if (msg.method === 'tools/call') {
    if (msg.params?.name !== 'vorschau') return send({id: msg.id, error: {code: -32602, message: 'Unbekanntes Werkzeug'}});
    return send({id: msg.id, result: await vorschau(msg.params?.arguments?.szenen)});
  }
  if (msg.method === 'ping') return send({id: msg.id, result: {}});
  send({id: msg.id, error: {code: -32601, message: `Unbekannte Methode ${msg.method}`}});
});
