// Renderer shared by pdf.mjs, render.mjs and vorschau.mjs: serves a presentation with Vite (render/index.html),
// opens it in headless Chrome and takes pictures of single frames.
//
//   const stage = await openStage(dir, {scale: 0.5, pages: 1});
//   await stage.shot(frame, file, {quality: 90});      // JPEG
//   await stage.close();
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runtimeResolve} from '../runtime/aliases.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function launchBrowser() {
  const {chromium} = await import('playwright-core');
  const errors = [];
  // installed Google Chrome first, then a Chromium that Playwright may have downloaded, then Edge
  for (const opts of [{channel: 'chrome'}, {}, {channel: 'msedge'}]) {
    try {
      // 3D slides (runtime/three.tsx) need WebGL: on machines without a usable GPU, allow Chrome's software
      // fallback (SwiftShader). With a GPU this changes nothing.
      return await chromium.launch({...opts, headless: true, args: ['--enable-unsafe-swiftshader']});
    } catch (e) {
      errors.push(String(e.message).split('\n')[0]);
    }
  }
  throw new Error(
    `No browser for rendering found. Install Google Chrome, or run: npx playwright install chromium\n${errors.join('\n')}`,
  );
}

/**
 * @param {string} dir  presentation folder (contains src/Video.tsx and src/content.json)
 * @param {{scale?: number, pages?: number}} [opts]  scale of the 1920×1080 stage; pages = parallel browser tabs
 */
export async function openStage(dir, {scale = 1, pages = 1} = {}) {
  const src = path.join(dir, 'src');
  for (const f of ['Video.tsx', 'content.json']) {
    if (!fs.existsSync(path.join(src, f))) throw new Error(`${path.join(src, f)} is missing – is ${dir} a presentation folder?`);
  }
  const {createServer} = await import('vite');
  const server = await createServer({
    configFile: false,
    root: path.join(root, 'render'),
    cacheDir: path.join(root, 'node_modules', '.vite-render'),
    logLevel: 'error',
    clearScreen: false,
    server: {host: '127.0.0.1', port: 47000 + Math.floor(Math.random() * 1000), strictPort: false, hmr: false, watch: null, fs: {allow: [root, dir]}},
    resolve: runtimeResolve,
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      // scan the slides up front, so packages of the presentation (also CommonJS ones) are prepared before the
      // first picture – without a reload in the middle of rendering
      entries: [path.join(src, '**/*.{ts,tsx,js,jsx}')],
    },
    plugins: [
      {
        name: 'showpoint-presentation',
        resolveId: (id) => (id === 'virtual:showpoint-presentation' ? '\0showpoint-presentation' : null),
        load: (id) =>
          id === '\0showpoint-presentation'
            ? `export {Video} from ${JSON.stringify(path.join(src, 'Video.tsx'))};\nexport {default as content} from ${JSON.stringify(path.join(src, 'content.json'))};`
            : null,
      },
    ],
  });
  await server.listen();
  const url = `${server.resolvedUrls.local[0]}?scale=${scale}`;

  let browser;
  try {
    browser = await launchBrowser();
    const width = Math.round(1920 * scale);
    const height = Math.round(1080 * scale);
    const tabs = await Promise.all(
      Array.from({length: Math.max(1, pages)}, async () => {
        const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
        const problems = [];
        page.on('pageerror', (e) => problems.push(String(e.message)));
        page.on('console', (m) => m.type() === 'error' && problems.push(m.text()));
        await page.goto(url, {waitUntil: 'load', timeout: 60_000});
        await page.waitForFunction(() => typeof window.showFrame === 'function', null, {timeout: 60_000}).catch(() => {
          throw new Error(`The presentation could not be loaded:\n${problems.join('\n') || 'no error message'}`);
        });
        return {page, problems};
      }),
    );
    const durationInFrames = await tabs[0].page.evaluate(() => window.renderInfo.durationInFrames);
    let next = 0;

    return {
      durationInFrames,
      /** Picture of one frame as JPEG; `tab` picks one of the parallel pages. */
      async shot(frame, file, {quality = 90, tab} = {}) {
        const t = tabs[tab ?? next++ % tabs.length];
        t.problems.length = 0;
        try {
          await t.page.evaluate((f) => window.showFrame(f), frame);
        } catch (e) {
          const msg = String(e.message).replace(/^page\.evaluate: (Error: )?/, '').split('\n')[0];
          throw new Error(msg + (t.problems.length ? `\n${t.problems.join('\n')}` : ''));
        }
        await t.page.screenshot({path: file, type: 'jpeg', quality});
      },
      pages: tabs.length,
      async close() {
        await browser.close().catch(() => {});
        await server.close();
      },
    };
  } catch (e) {
    await browser?.close().catch(() => {});
    await server.close();
    throw e;
  }
}
