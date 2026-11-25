// Creates a PowerPoint file (.pptx) from the presentation chosen in the presenter. Not pictures of whole slides:
// every slide is rebuilt from single objects, read from the rendered page at that frame –
//   texts → text boxes (size, colour, bold), boxes → shapes (fill, frame, round corners), SVG lines and arrows →
//   lines with arrow heads, SVG areas and curves → freeform shapes, Mermaid/formulas/pictures/3D → one picture each
//   (transparent), the background → slide background, the caption → notes of the slide.
// Usage: npm run pptx               one slide per stop (as the PDF) → <presentation folder>/out/<title>.pptx
//        npm run pptx -- --szenen   one slide per scene (its last stop)
//        npm run pptx -- --out <file>   somewhere else
//        npm run pptx -- --gif <id,id>  these scenes animated (besides those marked in the presenter: "pptxGif")
// Animated scenes: the drawing below the heading becomes an animated GIF that plays the animation from the stop before
// to this stop once and then keeps the last picture – as a click in the presenter does. Title, kicker and cards (boxes
// with text, see markCards) stay editable objects.
// Machine-readable lines for vite.config.mts: "PROGRESS <percent>" and "DONE <path>".
import fs from 'node:fs';
import path from 'node:path';
import PptxGenJS from 'pptxgenjs';
import {PNG} from 'pngjs';
import gifenc from 'gifenc';
import JSZip from 'jszip';
import {openStage, hideTexts} from './stills.mjs';
import {gewaehltePraesentation} from './inhalt.mjs';

const {dir, content, title, name} = gewaehltePraesentation();
if (!content?.order?.length) {
  console.error('content.json is missing or contains no scenes.');
  process.exit(1);
}
const perScene = process.argv.includes('--szenen') || process.argv.includes('--scenes');
const gifArg = process.argv.indexOf('--gif');
const gifScenes = new Set([
  ...content.order.filter((id) => content.scenes[id].pptxGif),
  ...(gifArg > 0 ? String(process.argv[gifArg + 1] ?? '').split(',').map((x) => x.trim()).filter(Boolean) : []),
]);

// Which frames become slides: the stops of every scene (as in the presenter and the PDF), or only the last one.
const slides = [];
let start = 0;
for (const id of content.order) {
  const sc = content.scenes[id];
  const stops = [...new Set((sc.stops ?? []).filter((s) => s > 0 && s < sc.dur))].sort((a, b) => a - b);
  // a scene fades out at its very end: its last stop, or shortly before the end, shows it complete
  const frames = stops.length ? stops : [Math.max(0, sc.dur - 15)];
  const chosen = perScene ? frames.slice(-1) : frames;
  for (const f of chosen) {
    const caption = [...(sc.captions ?? [])].filter((c) => c.at <= f).pop()?.text ?? '';
    // an animated slide plays from the stop before (or from the start of the scene, after its fade-in) to this stop
    const k = frames.indexOf(f);
    const from = perScene || k === 0 ? 12 : frames[k - 1];
    slides.push({
      id, frame: start + f, caption, sceneTitle: sc.title || sc.name || id,
      gif: gifScenes.has(id) ? {from: start + Math.min(from, f), to: start + f, captions: (sc.captions ?? []).map((c) => c.text)} : null,
    });
  }
  start += sc.dur;
}

const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? path.resolve(process.argv[outArg + 1]) : path.join(dir, 'out', `${name}.pptx`);
console.log(`PowerPoint "${title}": ${slides.length} slides → ${out}`);
console.log('PROGRESS 0');

/* ── runs in the page: reads the elements of the frame shown ─────────────────────────────────────────────────────── */
function collect() {
  const root = document.getElementById('root');
  const origin = root.getBoundingClientRect();
  const items = [];
  let rasterId = 0;
  // any CSS colour → [r, g, b, a] (the canvas normalises named colours, color-mix, oklab …)
  const ctx = document.createElement('canvas').getContext('2d');
  const rgba = (c) => {
    if (!c || c === 'none' || c === 'transparent' || c.startsWith('url(')) return null;
    let m = c.match(/^rgba?\(([^)]+)\)$/);
    if (!m) {
      ctx.fillStyle = '#000';
      ctx.fillStyle = c;
      const n = ctx.fillStyle;
      if (n.startsWith('#')) return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16), 1];
      m = n.match(/^rgba?\(([^)]+)\)$/);
      if (!m) return null;
    }
    const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const a = v.length > 3 ? v[3] : 1;
    return a > 0.01 ? [v[0], v[1], v[2], a] : null;
  };
  const hex = (c) => c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  const opacityOf = (el) => {
    let o = 1;
    for (let e = el; e && e !== root; e = e.parentElement) o *= Number(getComputedStyle(e).opacity || 1);
    return o;
  };
  const box = (r) => ({x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height});
  const visible = (r) => r.width > 0.5 && r.height > 0.5 && r.right > origin.left && r.bottom > origin.top && r.left < origin.right && r.top < origin.bottom;
  const raster = (el) => {
    const r = el.getBoundingClientRect();
    if (!visible(r)) return;
    const id = String(++rasterId);
    el.setAttribute('data-sp-r', id);
    items.push({kind: 'raster', id, ...box(r)});
  };
  const firstFont = (f) => {
    const name = f.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).find((s) => !/^(-apple-system|BlinkMacSystemFont|system-ui|ui-sans-serif)$/i.test(s));
    return !name || /^sans-serif$/i.test(name) ? 'Helvetica Neue' : /^serif$/i.test(name) ? 'Georgia' : /^monospace$/i.test(name) ? 'Menlo' : name;
  };
  const runOf = (text, el, opacity) => {
    const s = getComputedStyle(el);
    const c = rgba(s.color) ?? [255, 255, 255, 1];
    const tt = s.textTransform;
    return {
      text: tt === 'uppercase' ? text.toUpperCase() : tt === 'lowercase' ? text.toLowerCase() : tt === 'capitalize' ? text.replace(/(^|\s)(\S)/g, (_, a, b) => a + b.toUpperCase()) : text,
      spacing: parseFloat(s.letterSpacing) || 0,
      size: parseFloat(s.fontSize) || 16,
      color: hex(c),
      alpha: c[3] * opacity,
      bold: Number(s.fontWeight) >= 600 || s.fontWeight === 'bold',
      italic: s.fontStyle === 'italic',
      font: firstFont(s.fontFamily),
      mono: /mono|menlo|courier|consolas/i.test(s.fontFamily),
    };
  };
  const RASTER_TAGS = new Set(['IMG', 'CANVAS', 'VIDEO', 'IFRAME', 'PICTURE', 'OBJECT', 'EMBED']);
  const isInline = (el) => getComputedStyle(el).display.startsWith('inline') && !getComputedStyle(el).display.includes('block');

  // ── SVG: lines, arrows, areas and texts as their own objects, or the whole SVG as a picture ──
  const svgPoint = (el, x, y) => {
    const m = el.getScreenCTM();
    const p = new DOMPoint(x, y).matrixTransform(m);
    return [p.x - origin.left, p.y - origin.top];
  };
  const scaleOf = (el) => {
    const m = el.getScreenCTM();
    return Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) || 1;
  };
  const paint = (el, opacity) => {
    const s = getComputedStyle(el);
    const k = scaleOf(el);
    const fill = rgba(s.fill);
    const stroke = rgba(s.stroke);
    const sw = parseFloat(s.strokeWidth) * k;
    return {
      fill: fill ? hex(fill) : null,
      fillAlpha: fill ? fill[3] * Number(s.fillOpacity || 1) * opacity : 0,
      line: stroke && sw > 0 ? hex(stroke) : null,
      lineAlpha: stroke ? stroke[3] * Number(s.strokeOpacity || 1) * opacity : 0,
      lineW: sw || 0,
      dash: s.strokeDasharray && s.strokeDasharray !== 'none',
    };
  };
  const svgNeedsPicture = (svg) =>
    !!svg.querySelector('foreignObject, image, use, pattern, mask, clipPath, filter, linearGradient, radialGradient, [filter], [mask], [clip-path]') ||
    [...svg.querySelectorAll('*')].some((e) => {
      const s = getComputedStyle(e);
      return s.fill.startsWith('url(') || s.stroke.startsWith('url(') || (s.filter && s.filter !== 'none');
    });
  const samplePath = (el) => {
    // subpaths are drawn one by one (a jump starts a new one); curves become many short straight pieces
    const d = el.getAttribute('d') || '';
    const parts = (d.match(/M/g) || []).length > 1 && !/m/.test(d) ? d.split(/(?=M)/).filter((p) => p.trim()) : [d];
    const subs = [];
    for (const part of parts) {
      const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tmp.setAttribute('d', part);
      el.parentNode.insertBefore(tmp, el);
      const len = tmp.getTotalLength();
      // straight pieces: dense enough to keep the corners after simplify(); curves: many short pieces
      const n = /[CcSsQqTtAa]/.test(part) ? Math.max(8, Math.min(240, Math.ceil(len / 6))) : Math.max(2, Math.min(400, Math.ceil(len / 3)));
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const p = tmp.getPointAtLength((len * i) / n);
        pts.push(svgPoint(el, p.x, p.y));
      }
      tmp.remove();
      subs.push({pts: simplify(pts), closed: /z\s*$/i.test(part.trim())});
    }
    return subs;
  };
  // drops points that lie on a straight line between their neighbours
  const simplify = (pts) => {
    if (pts.length < 3) return pts;
    const outPts = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const [ax, ay] = outPts[outPts.length - 1];
      const [bx, by] = pts[i];
      const [cx, cy] = pts[i + 1];
      const cross = Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
      const len = Math.hypot(cx - ax, cy - ay) || 1;
      if (cross / len > 0.35) outPts.push(pts[i]);
    }
    outPts.push(pts[pts.length - 1]);
    return outPts;
  };
  const isHead = (el) => el && el.tagName.toLowerCase() === 'polygon' && (el.getAttribute('points') || '').trim().split(/[\s,]+/).length === 6;
  const walkSvg = (el, skip) => {
    for (const child of el.children) {
      if (skip.has(child)) continue;
      const tag = child.tagName.toLowerCase();
      const s = getComputedStyle(child);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const opacity = opacityOf(child);
      if (opacity < 0.03) continue;
      if (['defs', 'style', 'title', 'desc', 'marker', 'symbol', 'metadata'].includes(tag)) continue;
      if (tag === 'g' || tag === 'a' || tag === 'svg') {
        walkSvg(child, skip);
        continue;
      }
      const p = paint(child, opacity);
      if (tag === 'line') {
        const a = svgPoint(child, child.x1.baseVal.value, child.y1.baseVal.value);
        const b = svgPoint(child, child.x2.baseVal.value, child.y2.baseVal.value);
        // an arrow is a line followed by a small triangle at its end
        let head = false;
        const next = child.nextElementSibling;
        if (isHead(next)) {
          const pts = next.points;
          const tip = svgPoint(next, pts.getItem(0).x, pts.getItem(0).y);
          if (Math.hypot(tip[0] - b[0], tip[1] - b[1]) < 40) {
            head = true;
            skip.add(next);
            b[0] = tip[0];
            b[1] = tip[1];
          }
        }
        if (p.line) items.push({kind: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1], color: p.line, alpha: p.lineAlpha, width: p.lineW, head, dash: p.dash});
      } else if (tag === 'polyline' || tag === 'polygon') {
        const pts = [...child.points].map((q) => svgPoint(child, q.x, q.y));
        if (pts.length > 1) items.push({kind: 'poly', subs: [{pts, closed: tag === 'polygon'}], ...p});
      } else if (tag === 'path') {
        const subs = samplePath(child).filter((q) => q.pts.length > 1);
        if (subs.length) items.push({kind: 'poly', subs, ...p});
      } else if (tag === 'rect' || tag === 'circle' || tag === 'ellipse') {
        const m = child.getScreenCTM();
        const rotated = Math.abs(m.b) > 1e-3 || Math.abs(m.c) > 1e-3;
        const r = child.getBoundingClientRect();
        if (!visible(r)) continue;
        if (rotated) {
          raster(child);
          continue;
        }
        const rx = tag === 'rect' ? (child.rx?.baseVal?.value ?? 0) * scaleOf(child) : 0;
        items.push({kind: tag === 'rect' ? 'box' : 'ellipse', ...box(r), radius: rx, fill: p.fill, fillAlpha: p.fillAlpha, line: p.line, lineAlpha: p.lineAlpha, lineW: p.lineW, dash: p.dash});
      } else if (tag === 'text') {
        const r = child.getBoundingClientRect();
        if (!visible(r) || !child.textContent.trim()) continue;
        const fill = rgba(s.fill) ?? [255, 255, 255, 1];
        const anchor = s.textAnchor;
        items.push({
          kind: 'text',
          ...box(r),
          align: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left',
          runs: [{...runOf(child.textContent.trim(), child, opacity), size: parseFloat(s.fontSize) * scaleOf(child), color: hex(fill), alpha: fill[3] * opacity}],
        });
      } else {
        raster(child);
      }
    }
  };

  // ── HTML: boxes, texts, pictures; the full-frame background separately ──
  const walk = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none') return;
    const opacity = opacityOf(el);
    if (opacity < 0.03) return;
    const r = el.getBoundingClientRect();
    const hidden = s.visibility === 'hidden';
    if (!hidden && (RASTER_TAGS.has(el.tagName) || el.classList.contains('katex') || el.classList.contains('katex-display'))) {
      raster(el);
      return;
    }
    if (el.tagName.toLowerCase() === 'svg') {
      if (hidden || !visible(r)) return;
      if (svgNeedsPicture(el)) raster(el);
      else walkSvg(el, new Set());
      return;
    }
    if (!hidden && visible(r)) {
      const bg = rgba(s.backgroundColor) ?? (s.backgroundImage.includes('gradient') ? rgba(s.backgroundImage.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8})/i)?.[0]) : null);
      const bw = parseFloat(s.borderTopWidth) || parseFloat(s.borderLeftWidth) || 0;
      const bc = bw > 0 ? rgba(s.borderTopWidth !== '0px' ? s.borderTopColor : s.borderLeftColor) : null;
      const full = r.width >= origin.width - 2 && r.height >= origin.height - 2;
      if (full && (bg || s.backgroundImage !== 'none')) el.setAttribute('data-sp-bg', '1');
      else if (s.backgroundImage.includes('url(')) raster(el);
      else if (bg || bc) {
        items.push({
          kind: 'box',
          ...box(r),
          radius: Math.min(parseFloat(s.borderTopLeftRadius) || 0, Math.min(r.width, r.height) / 2),
          fill: bg ? hex(bg) : null,
          fillAlpha: bg ? bg[3] * opacity : 0,
          line: bc ? hex(bc) : null,
          lineAlpha: bc ? bc[3] * opacity : 0,
          lineW: bc ? bw : 0,
          dash: s.borderTopStyle === 'dashed' || s.borderTopStyle === 'dotted',
        });
      }
      // text: the element's own text, together with inline children (bold words, code …)
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (own) {
        const runs = [];
        const rects = [];
        const addNode = (n) => {
          if (n.nodeType === 3) {
            const parent = n.parentElement;
            const ps = getComputedStyle(parent);
            if (ps.visibility === 'hidden') return;
            let t = n.textContent;
            t = ps.whiteSpace.startsWith('pre') ? t : t.replace(/\s+/g, ' ');
            if (!t) return;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const cr of range.getClientRects()) if (cr.width > 0) rects.push(cr);
            runs.push(runOf(t, parent, opacityOf(parent)));
          } else if (n.nodeType === 1 && n.tagName === 'BR') {
            runs.push({br: true});
          } else if (n.nodeType === 1 && isInline(n) && !n.querySelector('svg, img, canvas, .katex')) {
            for (const c of n.childNodes) addNode(c);
          }
        };
        for (const n of el.childNodes) addNode(n);
        if (runs.some((q) => q.text?.trim()) && rects.length) {
          const l = Math.min(...rects.map((q) => q.left));
          const t = Math.min(...rects.map((q) => q.top));
          const rr = Math.max(...rects.map((q) => q.right));
          const b = Math.max(...rects.map((q) => q.bottom));
          // trim the outer spaces of the whole text
          const first = runs.find((q) => q.text);
          if (first) first.text = first.text.replace(/^\s+/, '');
          const last = [...runs].reverse().find((q) => q.text);
          if (last) last.text = last.text.replace(/\s+$/, '');
          const lines = new Set(rects.map((q) => Math.round(q.top))).size;
          items.push({
            kind: 'text',
            x: l - origin.left,
            y: t - origin.top,
            w: rr - l,
            h: b - t,
            lines,
            align: s.textAlign === 'center' ? 'center' : s.textAlign === 'right' || s.textAlign === 'end' ? 'right' : 'left',
            lineHeight: parseFloat(s.lineHeight) || 0,
            runs,
          });
        }
        // inline children were taken with the text; block children follow on their own
        for (const c of el.children) if (!isInline(c) || c.querySelector('svg, img, canvas, .katex')) walk(c);
        return;
      }
    }
    for (const c of el.children) walk(c);
  };
  for (const c of root.children) walk(c);
  return {items, hasBg: !!document.querySelector('[data-sp-bg]')};
}

// shows only the marked element with its content (a picture), or only the backgrounds without any content; the
// #root in front makes these rules stronger than the one that hides everything else
const ONLY = (sel, withContent) =>
  `#root *{visibility:hidden!important}#root ${sel}${withContent ? `,#root ${sel} *` : ''}{visibility:visible!important}html,body{background:transparent!important}`;
async function pictureOf(page, sel, clip, {transparent = true, withContent = true, type: wanted} = {}) {
  const handle = await page.addStyleTag({content: ONLY(sel, withContent)});
  try {
    // a picture with transparency as PNG; the opaque background as JPEG (a fraction of the size)
    const type = wanted ?? (transparent ? 'png' : 'jpeg');
    const buf = await page.screenshot({type, ...(transparent ? {omitBackground: true} : type === 'jpeg' ? {quality: 88} : {}), ...(clip ? {clip} : {})});
    return `image/${type};base64,${buf.toString('base64')}`;
  } finally {
    await handle.evaluate((n) => n.remove());
  }
}

/* ── node: builds the slides ─────────────────────────────────────────────────────────────────────────────────────── */
const IN = (px) => px / 144; // 1920 px = 13.333 in (16:9 "wide")
const PT = (px) => px * 0.5; // 1 px = 0.5 pt
const tr = (a) => Math.round(Math.max(0, Math.min(100, (1 - a) * 100)));
const lineOf = (it) => (it.line && it.lineW > 0 ? {color: it.line, width: Math.max(0.25, PT(it.lineW)), transparency: tr(it.lineAlpha), ...(it.dash ? {dashType: 'dash'} : {})} : {type: 'none'});
const fillOf = (it) => (it.fill && it.fillAlpha > 0 ? {color: it.fill, transparency: tr(it.fillAlpha)} : {type: 'none'});

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = title;
pptx.company = 'ShowPoint';

let bgColor = '0B1020';
try {
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'src', 'design.json'), 'utf8'));
  if (/^#[0-9a-f]{6}$/i.test(d?.surface?.bg ?? '')) bgColor = d.surface.bg.slice(1);
} catch {
  // older presentation without design.json: the dark default
}

// Vertical extent of an item in pixels
const spanOf = (it) =>
  it.kind === 'line' ? [Math.min(it.y1, it.y2), Math.max(it.y1, it.y2)]
  : it.kind === 'poly' ? [Math.min(...it.subs.flatMap((q) => q.pts.map((p) => p[1]))), Math.max(...it.subs.flatMap((q) => q.pts.map((p) => p[1])))]
  : [it.y, it.y + it.h];
const HEADER = 200; // kicker and title of a scene end above this line
const BOTTOM = 1080 - 48; // keep this distance to the lower edge
// marks kicker and title (header) and returns where they end
function headerEnd(items) {
  for (const it of items) it.header = spanOf(it)[1] <= HEADER;
  const head = items.filter((it) => it.header);
  return head.length ? Math.max(...head.map((it) => spanOf(it)[1])) : 0;
}
// centre a block (top … bottom) between the heading and the lower edge; never move it up, never below the edge
const centre = (headBottom, bTop, bBottom) => Math.max(0, Math.min(Math.round((headBottom + 24 + BOTTOM - bTop - bBottom) / 2), BOTTOM - bBottom));
function bodyShift(items) {
  const head = headerEnd(items);
  const body = items.filter((it) => !it.header);
  if (!body.length) return 0;
  return centre(head, Math.min(...body.map((it) => spanOf(it)[0])), Math.max(...body.map((it) => spanOf(it)[1])));
}

/* ── animated slides ─────────────────────────────────────────────────────────────────────────────────────────────── */
// runs in the page: the box around everything painted below minY (texts, boxes, SVG shapes, pictures)
function paintedBox(minY) {
  const root = document.getElementById('root');
  const o = root.getBoundingClientRect();
  const shown = (el) => {
    for (let e = el; e && e !== root; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) < 0.03) return false;
    }
    return true;
  };
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const SHAPES = ['path', 'line', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'text', 'image', 'foreignobject'];
  for (const el of root.querySelectorAll('*')) {
    const tag = el.tagName.toLowerCase();
    const s = getComputedStyle(el);
    const paints = el instanceof SVGElement
      ? SHAPES.includes(tag)
      : ['IMG', 'CANVAS', 'VIDEO'].includes(el.tagName) || s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none' ||
        parseFloat(s.borderTopWidth) > 0 || [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!paints) continue;
    const q = el.getBoundingClientRect();
    if (q.width < 1 || q.height < 1 || (q.width >= o.width - 2 && q.height >= o.height - 2) || q.bottom - o.top <= minY) continue;
    if (!shown(el)) continue;
    l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom);
  }
  return l === Infinity ? null : {x: l - o.left, y: t - o.top, w: r - l, h: b - t};
}

// runs in the page: marks the elements that fill the whole frame with a background (as collect() does), and – once –
// adds the rule that makes those backgrounds transparent (unless <html> has the class sp-keepbg)
function markBackgrounds() {
  const root = document.getElementById('root');
  // the frame: the (scaled) stage inside #root – #root itself keeps the unscaled height
  const o = (root.firstElementChild ?? root).getBoundingClientRect();
  for (const el of root.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < o.width - 2 || r.height < o.height - 2) continue;
    const s = getComputedStyle(el);
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage !== 'none') el.setAttribute('data-sp-bg', '1');
  }
  if (!document.getElementById('sp-nobg')) {
    const st = document.createElement('style');
    st.id = 'sp-nobg';
    st.textContent = 'html:not(.sp-keepbg),html:not(.sp-keepbg) body{background:transparent!important}html:not(.sp-keepbg) #root [data-sp-bg]{background:transparent!important}';
    document.head.appendChild(st);
  }
}

// runs in the page: marks the cards below minY – boxes (background or border) with text in them, like "Bizeps /
// Agonist" – and the SVG shapes lying inside one of them (bars drawn over a card). An animated slide keeps the cards
// as editable boxes and texts; only the rest (the drawing) becomes the GIF. Returns the cards in slide pixels.
// While <html> has the class sp-nocards the marked elements are hidden.
function markCards(minY) {
  const root = document.getElementById('root');
  const o = (root.firstElementChild ?? root).getBoundingClientRect();
  const k = o.width / 1920 || 1;
  for (const el of root.querySelectorAll('[data-sp-card]')) el.removeAttribute('data-sp-card');
  const cards = [];
  for (const el of root.querySelectorAll('*')) {
    if (el instanceof SVGElement || el.parentElement?.closest('[data-sp-card]')) continue;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;
    const painted = s.backgroundColor !== 'rgba(0, 0, 0, 0)' || s.backgroundImage.includes('gradient') ||
      parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderLeftWidth) > 0;
    if (!painted || !el.textContent.trim()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || (r.width >= o.width - 2 && r.height >= o.height - 2) || (r.top - o.top) / k < minY) continue;
    // a box holding a larger drawing or picture is a frame around the drawing, not a card (small icons are fine)
    if ([...el.querySelectorAll('svg, img, canvas, video')].some((g) => {
      const q = g.getBoundingClientRect();
      return q.width / k > 120 && q.height / k > 120;
    })) continue;
    el.setAttribute('data-sp-card', '1');
    cards.push(r);
  }
  const inside = (q) => cards.some((r) => q.left >= r.left - 2 && q.top >= r.top - 2 && q.right <= r.right + 2 && q.bottom <= r.bottom + 2);
  for (const el of root.querySelectorAll('svg path, svg line, svg rect, svg circle, svg ellipse, svg polygon, svg polyline, svg text, svg image')) {
    if (el.closest('[data-sp-card]')) continue;
    const q = el.getBoundingClientRect();
    if ((q.width || q.height) && inside(q)) el.setAttribute('data-sp-card', '1');
  }
  if (!document.getElementById('sp-cards')) {
    const st = document.createElement('style');
    st.id = 'sp-cards';
    st.textContent = 'html.sp-nocards #root [data-sp-card],html.sp-nocards #root [data-sp-card] *{visibility:hidden!important}';
    document.head.appendChild(st);
  }
  return cards.map((r) => ({x: (r.left - o.left) / k, y: (r.top - o.top) / k, r: (r.right - o.left) / k, b: (r.bottom - o.top) / k}));
}
const noCards = (on) => document.documentElement.classList.toggle('sp-nocards', on);
// horizontal extent of an item in pixels (the vertical one: spanOf)
const xspanOf = (it) =>
  it.kind === 'line' ? [Math.min(it.x1, it.x2), Math.max(it.x1, it.x2)]
  : it.kind === 'poly' ? [Math.min(...it.subs.flatMap((q) => q.pts.map((p) => p[0]))), Math.max(...it.subs.flatMap((q) => q.pts.map((p) => p[0])))]
  : [it.x, it.x + it.w];
const inCard = (it, cards) => {
  const [t, b] = spanOf(it);
  const [l, r] = xspanOf(it);
  return cards.some((c) => l >= c.x - 3 && r <= c.r + 3 && t >= c.y - 3 && b <= c.b + 3);
};

const GIF_SCALE = 0.6; // the GIF is drawn at 60 % of the slide's pixels: sharp enough, a fraction of the size
const GIF_STEP = 2; // every second frame: 15 pictures per second
const GIF_TABS = 4; // pictures drawn side by side in this many extra browser tabs (tab 1 … 4, at GIF_SCALE)
/** The animation of slide s below the heading (which ends at headBottom) as an animated GIF that plays once. */
async function animation(s, headBottom) {
  const {from, to, captions} = s.gif;
  // the area: everything painted below the heading at several moments of the animation
  let box = null;
  for (let k = 0; k <= 6; k++) {
    const pg = await stage.show(Math.round(from + ((to - from) * k) / 6));
    await pg.evaluate(hideTexts, captions);
    await pg.evaluate(markCards, headBottom + 4);
    await pg.evaluate(noCards, true);
    const q = await pg.evaluate(paintedBox, headBottom + 4);
    await pg.evaluate(noCards, false);
    if (!q) continue;
    box = box ? {x: Math.min(box.x, q.x), y: Math.min(box.y, q.y), r: Math.max(box.r, q.x + q.w), b: Math.max(box.b, q.y + q.h)} : {x: q.x, y: q.y, r: q.x + q.w, b: q.y + q.h};
  }
  if (!box) return null;
  const pad = 16;
  const x = Math.max(0, Math.floor(box.x - pad));
  const y = Math.max(headBottom + 4, Math.floor(box.y - pad));
  const r = Math.min(1920, Math.ceil(box.r + pad));
  const b = Math.min(1080, Math.ceil(box.b + pad));
  if (r - x < 8 || b - y < 8) return null;
  const clip = {x: Math.round(x * GIF_SCALE), y: Math.round(y * GIF_SCALE), width: Math.round((r - x) * GIF_SCALE), height: Math.round((b - y) * GIF_SCALE)};
  // the pictures; a picture equal to the one before only lengthens that one
  // The GIF has no background of its own: where nothing is drawn it is transparent and the slide's background shows,
  // so there is no visible edge. The pictures are taken without the backgrounds (alpha), and their half-transparent
  // edges are blended with a picture of the backgrounds alone, so that nothing gets a fringe.
  const tabs = Array.from({length: GIF_TABS}, (_, k) => 1 + k);
  const ready = async (f, tab) => {
    const pg = await stage.show(f, {tab});
    await pg.evaluate(hideTexts, captions);
    await pg.evaluate(markBackgrounds);
    await pg.evaluate(markCards, headBottom + 4);
    await pg.evaluate(noCards, true);
    return pg;
  };
  const bgPage = await ready(to, tabs[0]);
  await bgPage.evaluate(() => document.documentElement.classList.add('sp-keepbg'));
  const bg = PNG.sync.read(Buffer.from((await pictureOf(bgPage, '[data-sp-bg]', clip, {transparent: false, withContent: false, type: 'png'})).split(',')[1], 'base64')).data;
  await bgPage.evaluate(() => document.documentElement.classList.remove('sp-keepbg'));
  const list = [];
  for (let f = from; f < to; f += GIF_STEP) list.push(f);
  list.push(to);
  const shots = [];
  for (let i = 0; i < list.length; i += GIF_TABS) {
    shots.push(...(await Promise.all(list.slice(i, i + GIF_TABS).map(async (f, k) => {
      const pg = await ready(f, tabs[k]);
      const px = PNG.sync.read(await pg.screenshot({type: 'png', clip, omitBackground: true})).data;
      // blend half-transparent pixels with the background; fully transparent ones stay transparent
      for (let p = 0; p < px.length; p += 4) {
        const al = px[p + 3];
        if (al === 0 || al === 255) continue;
        const k2 = al / 255;
        for (let c = 0; c < 3; c++) px[p + c] = Math.round(px[p + c] * k2 + bg[p + c] * (1 - k2));
        px[p + 3] = 255;
      }
      return px;
    }))));
  }
  const frames = [];
  for (const [i, data] of shots.entries()) {
    const ms = i < list.length - 1 ? ((list[i + 1] - list[i]) * 1000) / 30 : 0;
    const prev = frames[frames.length - 1];
    if (prev && prev.data.equals(data)) prev.ms += ms;
    else frames.push({data, ms});
  }
  const {GIFEncoder, quantize, applyPalette} = gifenc;
  const gif = GIFEncoder();
  for (const [i, fr] of frames.entries()) {
    const rgba = new Uint8Array(fr.data.buffer, fr.data.byteOffset, fr.data.length);
    // the colours from the drawn pixels only (255 of them); index 255 is "transparent"
    const solid = [];
    for (let p = 0; p < rgba.length; p += 4) if (rgba[p + 3]) solid.push(rgba[p], rgba[p + 1], rgba[p + 2], 255);
    const palette = solid.length ? quantize(new Uint8Array(solid), 255) : [[0, 0, 0]];
    while (palette.length < 255) palette.push([0, 0, 0]);
    palette.push([0, 0, 0]);
    const index = applyPalette(rgba, palette.slice(0, 255));
    for (let p = 0, q = 0; p < rgba.length; p += 4, q++) if (!rgba[p + 3]) index[q] = 255;
    // dispose 2: each picture starts on an empty (transparent) area, so moving parts leave no trail; the GIF plays
    // once and keeps the last picture
    gif.writeFrame(index, clip.width, clip.height, {
      palette, transparent: true, transparentIndex: 255, dispose: 2,
      delay: i === frames.length - 1 ? 0 : Math.max(20, Math.round(fr.ms)),
      ...(i === 0 ? {repeat: -1} : {}),
    });
  }
  gif.finish();
  return {data: `image/gif;base64,${Buffer.from(gif.bytes()).toString('base64')}`, x, y, w: r - x, h: b - y, pictures: frames.length};
}

const stage = await openStage(dir, gifScenes.size ? {extra: {pages: GIF_TABS, scale: GIF_SCALE}} : {});
const counts = {text: 0, box: 0, line: 0, poly: 0, ellipse: 0, raster: 0};
try {
  for (const [i, s] of slides.entries()) {
    const page = await stage.show(s.frame);
    // the caption becomes the notes of the slide, not part of the picture
    if (s.caption) await page.evaluate(hideTexts, [s.caption]);
    const {items, hasBg} = await page.evaluate(collect);
    const slide = pptx.addSlide();
    slide.background = hasBg ? {data: await pictureOf(page, '[data-sp-bg]', null, {transparent: false, withContent: false})} : {color: bgColor};
    // without the caption the lower part of the slide stays empty: the body (everything below the heading) moves down
    // to the middle of the free space; kicker and title keep their place
    let dy = bodyShift(items);
    // an animated slide: kicker, title and the cards (boxes with text) as editable objects in the state of this stop,
    // the drawing below the heading as one animated GIF
    if (s.gif) {
      const head = headerEnd(items);
      const anim = await animation(s, head);
      if (anim) {
        // the page shows the frame of this slide again (animation() went through others); read it anew, so that
        // pictures find their elements, and keep the heading and what lies in the cards
        await stage.show(s.frame);
        if (s.caption) await page.evaluate(hideTexts, [s.caption]);
        const cards = await page.evaluate(markCards, head + 4);
        const again = (await page.evaluate(collect)).items;
        headerEnd(again);
        items.length = 0;
        items.push(...again.filter((it) => it.header || inCard(it, cards)));
        // GIF and cards move down together
        const body = items.filter((it) => !it.header);
        const top = Math.min(anim.y, ...body.map((it) => spanOf(it)[0]));
        const bottom = Math.max(anim.y + anim.h, ...body.map((it) => spanOf(it)[1]));
        dy = centre(head, top, bottom);
        slide.addImage({data: anim.data, x: IN(anim.x), y: IN(anim.y + dy), w: IN(anim.w), h: IN(anim.h)});
        counts.gif = (counts.gif ?? 0) + 1;
      }
    }
    for (const it of items) {
      counts[it.kind] = (counts[it.kind] ?? 0) + 1;
      if (!it.header && dy) {
        if (it.kind === 'line') {
          it.y1 += dy;
          it.y2 += dy;
        } else if (it.kind === 'poly') for (const q of it.subs) for (const p of q.pts) p[1] += dy;
        else if (it.kind !== 'raster') it.y += dy;
        else it.shift = dy;
      }
      if (it.kind === 'raster') {
        const clip = {x: Math.max(0, it.x), y: Math.max(0, it.y), width: Math.min(1920, it.x + it.w) - Math.max(0, it.x), height: Math.min(1080, it.y + it.h) - Math.max(0, it.y)};
        if (clip.width < 1 || clip.height < 1) continue;
        const data = await pictureOf(page, `[data-sp-r="${it.id}"]`, clip);
        slide.addImage({data, x: IN(clip.x), y: IN(clip.y + (it.shift ?? 0)), w: IN(clip.width), h: IN(clip.height)});
      } else if (it.kind === 'box' || it.kind === 'ellipse') {
        const round = it.kind === 'box' && it.radius > 0.5;
        slide.addShape(it.kind === 'ellipse' ? 'ellipse' : round ? 'roundRect' : 'rect', {
          x: IN(it.x), y: IN(it.y), w: IN(it.w), h: IN(it.h),
          fill: fillOf(it), line: lineOf(it),
          ...(round ? {rectRadius: IN(it.radius)} : {}),
        });
      } else if (it.kind === 'line') {
        const x = Math.min(it.x1, it.x2);
        const y = Math.min(it.y1, it.y2);
        slide.addShape('line', {
          x: IN(x), y: IN(y), w: IN(Math.abs(it.x2 - it.x1)), h: IN(Math.abs(it.y2 - it.y1)),
          flipH: it.x2 < it.x1, flipV: it.y2 < it.y1,
          line: {color: it.color, width: Math.max(0.25, PT(it.width)), transparency: tr(it.alpha), ...(it.head ? {endArrowType: 'triangle'} : {}), ...(it.dash ? {dashType: 'dash'} : {})},
        });
      } else if (it.kind === 'poly') {
        const all = it.subs.flatMap((q) => q.pts);
        const x0 = Math.min(...all.map((p) => p[0]));
        const y0 = Math.min(...all.map((p) => p[1]));
        const w = Math.max(1, Math.max(...all.map((p) => p[0])) - x0);
        const h = Math.max(1, Math.max(...all.map((p) => p[1])) - y0);
        const points = it.subs.flatMap((q) => [
          ...q.pts.map(([px, py], k) => ({x: IN(px - x0), y: IN(py - y0), ...(k === 0 ? {moveTo: true} : {})})),
          ...(q.closed ? [{close: true}] : []),
        ]);
        slide.addShape('custGeom', {x: IN(x0), y: IN(y0), w: IN(w), h: IN(h), points, fill: fillOf(it), line: lineOf(it)});
      } else if (it.kind === 'text') {
        const runs = [];
        for (const r of it.runs) {
          if (r.br) {
            if (runs.length) runs[runs.length - 1].options.breakLine = true;
            continue;
          }
          const parts = r.text.split('\n');
          parts.forEach((t, k) => {
            runs.push({
              text: t,
              options: {
                fontSize: Math.max(1, Math.round(PT(r.size) * 10) / 10),
                color: r.color,
                bold: r.bold,
                italic: r.italic,
                fontFace: r.mono ? 'Menlo' : r.font,
                transparency: tr(r.alpha),
                ...(r.spacing ? {charSpacing: Math.round(PT(r.spacing) * 10) / 10} : {}),
                ...(k < parts.length - 1 ? {breakLine: true} : {}),
              },
            });
          });
        }
        if (!runs.length) continue;
        // fonts in PowerPoint run a little wider than in the browser: give the box some room, so that it does not
        // break lines the slide did not break
        const extra = it.lines > 1 ? it.w * 0.08 : it.w * 0.12 + 8;
        const x = it.align === 'center' ? it.x - extra / 2 : it.align === 'right' ? it.x - extra : it.x;
        slide.addText(runs, {
          x: IN(x), y: IN(it.y), w: IN(it.w + extra), h: IN(it.h),
          align: it.align, valign: 'top', margin: 0, fit: 'none', wrap: true, isTextBox: true,
          ...(it.lineHeight && it.lines > 1 ? {lineSpacing: PT(it.lineHeight)} : {}),
        });
      }
    }
    slide.addNotes([s.sceneTitle, s.caption].filter(Boolean).join('\n\n'));
    console.log(`PROGRESS ${Math.round(((i + 1) / slides.length) * 100)}`);
  }
} finally {
  await stage.close();
}
fs.mkdirSync(path.dirname(out), {recursive: true});
// PptxGenJS writes an empty guide list, so View › Guides in PowerPoint shows nothing. Add a horizontal and a vertical
// guide through the centre (positions in 1/8 pt: 7.5 in = 4320, 13.333 in = 7680); they stay hidden until switched on.
const zip = await JSZip.loadAsync(await pptx.write({outputType: 'nodebuffer'}));
const view = await zip.file('ppt/viewProps.xml').async('string');
zip.file('ppt/viewProps.xml', view.replace('<p:guideLst/>', '<p:guideLst><p:guide orient="horz" pos="2160"/><p:guide pos="3840"/></p:guideLst>'));
fs.writeFileSync(out, await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'}));
console.log(`Objects: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`DONE ${out}`);
