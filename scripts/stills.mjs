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
 * Runs in the page: hides the elements that show exactly one of the given texts. A caption hides with its box (the
 * parent that has a background), a title or kicker only itself. Texts are compared without surrounding white space.
 */
export function hideTexts(texts) {
  const wanted = new Set(texts.map((t) => String(t).replace(/\s+/g, ' ').trim()).filter(Boolean));
  const norm = (el) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  for (const el of document.querySelectorAll('#root *')) {
    if (!wanted.has(norm(el))) continue;
    // the innermost element with this text: none of its children carries the same text
    if ([...el.children].some((c) => norm(c) === norm(el))) continue;
    let target = el;
    const parent = el.parentElement;
    if (parent && norm(parent) === norm(el) && getComputedStyle(parent).backgroundColor !== 'rgba(0, 0, 0, 0)') target = parent;
    target.style.visibility = 'hidden';
  }
}

/**
 * @param {string} dir  presentation folder (contains src/Video.tsx and src/content.json)
 * @param {{scale?: number, pages?: number, extra?: {pages: number, scale: number}}} [opts]  scale of the 1920×1080
 *   stage; pages = parallel browser tabs; extra = more tabs at another scale in the same browser (they come after the
 *   others, so their numbers start at `pages`) – one renderer instead of two, which get in each other's way
 */
export async function openStage(dir, {scale = 1, pages = 1, extra = null} = {}) {
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
    assetsInclude: ['**/*.glb'], // 3D models are files to load, like images
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'mermaid'],
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
  const urlAt = (sc) => `${server.resolvedUrls.local[0]}?scale=${sc}`;

  let browser;
  try {
    browser = await launchBrowser();
    const scales = [...Array(Math.max(1, pages)).fill(scale), ...Array(extra?.pages ?? 0).fill(extra?.scale ?? scale)];
    const tabs = await Promise.all(
      scales.map(async (sc) => {
        const url = urlAt(sc);
        const page = await browser.newPage({viewport: {width: Math.round(1920 * sc), height: Math.round(1080 * sc)}, deviceScaleFactor: 1});
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
      /**
       * Picture of one frame (JPEG, or PNG with type 'png'); `tab` picks one of the parallel pages. `hide`: texts
       * whose elements are made invisible before the picture (for the PowerPoint export: title and caption become
       * text of their own there).
       */
      async shot(frame, file, {quality = 90, tab, type = 'jpeg', hide = []} = {}) {
        const t = tabs[tab ?? next++ % Math.max(1, pages)];
        t.problems.length = 0;
        try {
          await t.page.evaluate((f) => window.showFrame(f), frame);
        } catch (e) {
          const msg = String(e.message).replace(/^page\.evaluate: (Error: )?/, '').split('\n')[0];
          throw new Error(msg + (t.problems.length ? `\n${t.problems.join('\n')}` : ''));
        }
        if (hide.length) await t.page.evaluate(hideTexts, hide);
        await t.page.screenshot({path: file, type, ...(type === 'jpeg' ? {quality} : {})});
      },
      /** Shows one frame and returns the page itself (for the PowerPoint export, which reads the elements). */
      async show(frame, {tab = 0} = {}) {
        const t = tabs[tab];
        t.problems.length = 0;
        try {
          await t.page.evaluate((f) => window.showFrame(f), frame);
        } catch (e) {
          const msg = String(e.message).replace(/^page\.evaluate: (Error: )?/, '').split('\n')[0];
          throw new Error(msg + (t.problems.length ? `\n${t.problems.join('\n')}` : ''));
        }
        return t.page;
      },
      pages: Math.max(1, pages),
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
