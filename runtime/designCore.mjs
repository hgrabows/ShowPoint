// The look of a presentation ("design"): colours, font, background, shapes. Plain JavaScript without React, so the
// slides (runtime/design.tsx), the PlantUML script and the server (both Node) read the same thing.
// A presentation carries its design in src/design.json; resolveDesign() fills in whatever is left out there.
// Types: designCore.d.mts.

/** Today's dark look. It applies wherever no design is given, so older presentations look as they always did. */
export const NIGHT = {
  name: 'Nacht',
  dark: true,
  surface: {
    bg: '#0B1020',
    background: 'radial-gradient(1400px 800px at 20% 0%, #172047 0%, #0B1020 60%)',
    panel: '#151C33',
    panel2: '#1B2442',
    border: '#2E3A63',
    inset: '#0F1A33',
    stage: '#000000',
  },
  text: {normal: '#E8ECF8', muted: '#9AA6C7', heading: '#E8ECF8', kicker: '#8B6CFF', onAccent: '#0B1020'},
  accent: ['#38BDF8', '#8B6CFF', '#FFB020', '#34D399', '#F87171', '#FB923C', '#A3E635', '#F472B6'],
  status: {good: '#34D399', bad: '#F87171', note: '#FFB020'},
  font: {
    family: '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif',
    weights: {normal: 500, strong: 600, kicker: 700, heading: 800},
    files: [],
  },
  shape: {radius: 20, borderWidth: 3},
  caption: {bg: 'rgba(8,12,26,0.85)', border: '#2E3A63', text: '#E8ECF8'},
  diagram: {node: '#1B2442', nodeBorder: '#38BDF8', line: '#9AA6C7', group: '#121935', noteBg: '#2A2310', noteBorder: '#FFB020', errorBg: '#3A1620'},
  model: {ground: '#334466', fill: '#9FB4FF'},
};

/* ── colours ─────────────────────────────────────────────────────────────── */

/** '#abc', '#aabbcc', '#aabbccdd', 'rgb(…)', 'rgba(…)' → [r, g, b, a] (0–255, a 0–1); null for anything else. */
export function parseColor(c) {
  const s = String(c ?? '').trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((x) => x + x).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : Number(m[4]);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  return null;
}

const hex = (rgb) => '#' + rgb.slice(0, 3).map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Mixes two colours: t = 0 gives a, t = 1 gives b. Returns '#RRGGBB' (a itself if a colour cannot be read). */
export function mix(a, b, t) {
  const p = parseColor(a);
  const q = parseColor(b);
  if (!p || !q) return a;
  return hex([0, 1, 2].map((i) => p[i] + (q[i] - p[i]) * t));
}

/** A colour with transparency laid over an opaque one. */
export function over(top, base) {
  const p = parseColor(top);
  if (!p) return base;
  return p[3] >= 1 ? hex(p) : mix(base, hex(p), p[3]);
}

/** Relative luminance (WCAG 2), 0 = black, 1 = white. */
export function luminance(c) {
  const p = parseColor(c) ?? [0, 0, 0, 1];
  const lin = (v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
}

/** Contrast ratio (WCAG 2) of two opaque colours, 1 … 21. */
export function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/* ── reading a design ────────────────────────────────────────────────────── */

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const num = (v, fallback, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback);

/** True if the value looks like a design file (and not like some other JSON). */
export function isDesign(v) {
  return isObj(v) && isObj(v.surface) && typeof v.surface.bg === 'string' && isObj(v.text) && typeof v.text.normal === 'string';
}

/**
 * Completes a design: everything missing is derived from what is there (a light design gets light diagram notes,
 * the caption box takes panel and border, …). Without a usable input the result is NIGHT.
 */
export function resolveDesign(input) {
  if (!isObj(input)) return NIGHT;
  const s = isObj(input.surface) ? input.surface : {};
  const t = isObj(input.text) ? input.text : {};
  const st = isObj(input.status) ? input.status : {};
  const f = isObj(input.font) ? input.font : {};
  const w = isObj(f.weights) ? f.weights : {};
  const sh = isObj(input.shape) ? input.shape : {};
  const cap = isObj(input.caption) ? input.caption : {};
  const dg = isObj(input.diagram) ? input.diagram : {};
  const md = isObj(input.model) ? input.model : {};

  const bg = str(s.bg, NIGHT.surface.bg);
  const dark = typeof input.dark === 'boolean' ? input.dark : luminance(bg) < 0.4;
  const base = dark ? NIGHT : null; // a dark design falls back on the night colours, a light one on derived ones
  const normal = str(t.normal, base ? NIGHT.text.normal : '#172033');
  const panel = str(s.panel, base ? NIGHT.surface.panel : mix(bg, '#FFFFFF', 0.6));
  const panel2 = str(s.panel2, base ? NIGHT.surface.panel2 : mix(bg, normal, 0.07));
  const border = str(s.border, base ? NIGHT.surface.border : mix(bg, normal, 0.25));
  const muted = str(t.muted, mix(normal, bg, 0.4));
  const accent = Array.isArray(input.accent) ? input.accent.filter((c) => typeof c === 'string' && parseColor(c)) : [];
  const palette = accent.length ? accent : NIGHT.accent;
  const pick = (i) => palette[i % palette.length];
  const good = str(st.good, pick(3));
  const bad = str(st.bad, pick(4));
  const note = str(st.note, pick(2));
  const files = (Array.isArray(f.files) ? f.files : [])
    .filter((x) => isObj(x) && typeof x.file === 'string' && /^[\w.\- ]+\.(woff2?|ttf|otf)$/i.test(x.file) && typeof x.family === 'string' && x.family.trim())
    .map((x) => ({family: x.family.trim(), file: x.file, weight: typeof x.weight === 'number' || typeof x.weight === 'string' ? x.weight : 400, style: x.style === 'italic' ? 'italic' : 'normal'}));

  return {
    name: str(input.name, ''),
    dark,
    surface: {bg, background: str(s.background, bg), panel, panel2, border, inset: str(s.inset, mix(bg, panel, 0.5)), stage: str(s.stage, dark ? '#000000' : bg)},
    text: {normal, muted, heading: str(t.heading, normal), kicker: str(t.kicker, pick(1)), onAccent: str(t.onAccent, dark ? bg : '#FFFFFF')},
    accent: palette,
    status: {good, bad, note},
    font: {
      family: str(f.family, NIGHT.font.family),
      weights: {normal: num(w.normal, 500, 100, 900), strong: num(w.strong, 600, 100, 900), kicker: num(w.kicker, 700, 100, 900), heading: num(w.heading, 800, 100, 900)},
      files,
    },
    shape: {radius: num(sh.radius, 20, 0, 80), borderWidth: num(sh.borderWidth, 3, 0, 12)},
    caption: {bg: str(cap.bg, dark ? NIGHT.caption.bg : panel), border: str(cap.border, border), text: str(cap.text, normal)},
    diagram: {
      node: str(dg.node, panel2),
      nodeBorder: str(dg.nodeBorder, pick(0)),
      line: str(dg.line, muted),
      group: str(dg.group, mix(bg, panel2, 0.5)),
      noteBg: str(dg.noteBg, mix(bg, note, 0.14)),
      noteBorder: str(dg.noteBorder, note),
      errorBg: str(dg.errorBg, mix(bg, bad, 0.16)),
    },
    model: {ground: str(md.ground, dark ? NIGHT.model.ground : mix(bg, '#000000', 0.3)), fill: str(md.fill, dark ? NIGHT.model.fill : '#FFFFFF')},
  };
}

/* ── checking a design ───────────────────────────────────────────────────── */

/**
 * Contrast of a design (WCAG 2): every text colour against the background and the boxes, the caption text against
 * its box, the accent colours against the background. `min` is what the pair needs: 4.5 for text, 3 for large
 * text and for lines and areas that carry meaning.
 */
export function contrastReport(designIn) {
  const d = resolveDesign(designIn);
  // a gradient counts with every colour it names
  const grounds = [d.surface.bg, ...(String(d.surface.background).match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) ?? [])].filter((c, i, a) => parseColor(c) && a.indexOf(c) === i);
  const rows = [];
  const add = (what, fg, on, bgColor, min) => rows.push({what, on, fg, bg: bgColor, ratio: contrast(fg, bgColor), min, ok: contrast(fg, bgColor) >= min});
  for (const g of grounds) {
    const label = g === d.surface.bg ? 'background' : `background ${g}`;
    add('text', d.text.normal, label, over(g, d.surface.bg), 4.5);
    add('muted text', d.text.muted, label, over(g, d.surface.bg), 4.5);
    add('heading', d.text.heading, label, over(g, d.surface.bg), 4.5);
    add('kicker', d.text.kicker, label, over(g, d.surface.bg), 3);
  }
  for (const [name, p] of [['box', d.surface.panel], ['second box', d.surface.panel2], ['diagram node', d.diagram.node], ['diagram note', d.diagram.noteBg]]) {
    add('text', d.text.normal, name, over(p, d.surface.bg), 4.5);
    if (name !== 'diagram note') add('muted text', d.text.muted, name, over(p, d.surface.bg), 4.5);
  }
  add('caption text', d.caption.text, 'caption box', over(d.caption.bg, d.surface.bg), 4.5);
  add('box border', d.surface.border, 'background', d.surface.bg, 1.3);
  add('diagram line', d.diagram.line, 'background', d.surface.bg, 3);
  d.accent.forEach((c, i) => add(`accent ${i + 1}`, c, 'background', d.surface.bg, 3));
  d.accent.forEach((c, i) => add(`text on accent ${i + 1}`, d.text.onAccent, `accent ${c}`, c, 3));
  for (const [name, c] of Object.entries(d.status)) add(name, c, 'background', d.surface.bg, 3);
  return rows;
}

/* ── PlantUML ────────────────────────────────────────────────────────────── */

/** The first family of a CSS font stack that PlantUML (Java) can use; system keywords are skipped. */
const plainFont = (family) => {
  const names = String(family).split(',').map((x) => x.trim().replace(/^["']|["']$/g, ''));
  const real = names.filter((x) => x && !/^(-apple-system|BlinkMacSystemFont|system-ui|ui-[\w-]+|sans-serif|serif|monospace)$/i.test(x));
  return [...real.slice(0, 3).map((x) => `"${x}"`), /serif/i.test(names[names.length - 1] ?? '') && !/sans/i.test(names[names.length - 1] ?? '') ? 'serif' : 'sans-serif'].join(', ');
};

/** PlantUML style block in the colours of a design (inserted before the diagram text, so the diagram can override). */
export function plantumlTheme(designIn) {
  const d = resolveDesign(designIn);
  const c = (v) => {
    const p = parseColor(over(v, d.surface.bg));
    return p ? hex(p) : '#000000';
  };
  const round = Math.round(Math.min(d.shape.radius, 20) / 2);
  const line = Math.max(1, d.shape.borderWidth / 2);
  return `<style>
root {
  FontName ${plainFont(d.font.family)}
  FontColor ${c(d.text.normal)}
  LineColor ${c(d.diagram.line)}
  BackgroundColor transparent
}
document { BackgroundColor transparent }
element {
  BackgroundColor ${c(d.diagram.node)}
  LineColor ${c(d.diagram.line)}
  FontColor ${c(d.text.normal)}
  LineThickness ${line}
  RoundCorner ${round}
}
classDiagram {
  class {
    BackgroundColor ${c(d.diagram.node)}
    LineColor ${c(d.diagram.line)}
    FontColor ${c(d.text.normal)}
    header { FontStyle bold; FontColor ${c(d.text.heading)} }
  }
}
arrow { LineColor ${c(d.diagram.line)}; FontColor ${c(d.text.muted)}; LineThickness ${line} }
note { BackgroundColor ${c(d.diagram.noteBg)}; LineColor ${c(d.diagram.noteBorder)}; FontColor ${c(d.text.normal)} }
title { FontColor ${c(d.text.heading)} }
</style>
skinparam shadowing false
skinparam defaultFontSize 18
skinparam classAttributeIconSize 0
`;
}
