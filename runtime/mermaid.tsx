/**
 * Diagrams from Mermaid text (flowcharts, sequence, state and class diagrams …), drawn with Mermaid (MIT licence).
 *
 *   <Mermaid code={c.t.ablauf} x={160} y={220} w={1600} h={640} />                  // fades in at frame 0
 *   <Mermaid code={c.t.ablauf} x={160} y={220} w={1600} h={640} at={20} every={30} /> // one element after another
 *   <Mermaid code={…} x={…} y={…} w={…} h={…} reveal={interpolate(frame, [0, 120], [0, 6], CLAMP)} />
 *
 * Mermaid is loaded only when a slide uses this block. Each diagram is drawn once (asynchronously) and kept in a
 * cache; every frame after that only changes opacities, so the picture follows from the frame number alone. The
 * renderer waits for the first drawing (waitFor), so stills, PDF and video never show an empty box.
 *
 * Order of the steps for reveal / every: flowcharts, state and class diagrams – the nodes in the order of their
 * first mention in the code; an edge (with its label) appears together with the later of its two nodes, a subgraph
 * box with its first node. Sequence diagrams – first the participants, then messages and notes from top to bottom
 * (loops, activations etc. with the first message inside them). Other diagram types appear as one step.
 */
import React, {useId, useLayoutEffect, useMemo, useReducer} from 'react';
import {spring, useCurrentFrame, useVideoConfig} from './index';
import {waitFor} from './wait';
import {useDesign} from './design';
import type {Design} from './design';

/** Mermaid theme in the colours and font of the design; single values can be replaced with `themeVariables`. */
const slideTheme = (d: Design): Record<string, string | boolean> => ({
  darkMode: d.dark,
  background: d.surface.bg,
  fontFamily: d.font.family,
  primaryColor: d.diagram.node,
  primaryTextColor: d.text.normal,
  primaryBorderColor: d.diagram.nodeBorder,
  secondaryColor: d.surface.panel,
  secondaryTextColor: d.text.normal,
  secondaryBorderColor: d.accent[1 % d.accent.length],
  tertiaryColor: d.surface.panel,
  tertiaryTextColor: d.text.normal,
  tertiaryBorderColor: d.surface.border,
  mainBkg: d.diagram.node,
  nodeBorder: d.diagram.nodeBorder,
  nodeTextColor: d.text.normal,
  textColor: d.text.normal,
  titleColor: d.text.normal,
  lineColor: d.diagram.line,
  clusterBkg: d.diagram.group,
  clusterBorder: d.surface.border,
  edgeLabelBackground: d.surface.bg,
  // sequence diagrams
  actorBkg: d.diagram.node,
  actorBorder: d.diagram.nodeBorder,
  actorTextColor: d.text.normal,
  actorLineColor: d.surface.border,
  signalColor: d.diagram.line,
  signalTextColor: d.text.normal,
  labelBoxBkgColor: d.surface.panel,
  labelBoxBorderColor: d.surface.border,
  labelTextColor: d.text.normal,
  loopTextColor: d.diagram.line,
  noteBkgColor: d.diagram.noteBg,
  noteBorderColor: d.diagram.noteBorder,
  noteTextColor: d.text.normal,
  activationBkgColor: d.surface.panel,
  activationBorderColor: d.accent[1 % d.accent.length],
  sequenceNumberColor: d.surface.bg,
  // state diagrams
  specialStateColor: d.diagram.line,
  innerEndBackground: d.surface.bg,
  altBackground: d.surface.panel,
  compositeBackground: d.diagram.group,
  compositeTitleBackground: d.diagram.node,
  labelColor: d.text.normal,
  errorBkgColor: d.diagram.errorBg,
  errorTextColor: d.status.bad,
});

export type MermaidProps = {
  /** The diagram in Mermaid syntax, e.g. 'flowchart LR\n  A[Frage] --> B[Antwort]'. Best kept in c.t. */
  code: string;
  /** Box in stage pixels (stage = 1920×1080); the diagram is scaled to fit and centred in it. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Number of visible steps (see the file comment for the order); fractions fade the next step in. */
  reveal?: number;
  /** Like reveal, but 0..1 of all steps. */
  progress?: number;
  /** Frame at which the diagram (or with `every` its first step) fades in (default 0). */
  at?: number;
  /** Frames between two steps: the elements appear one after another, starting at `at`. */
  every?: number;
  /** Explicit start frames per step instead of `every`. */
  stepAt?: readonly number[];
  /** Font size in diagram units (default 20); together with the box size it decides how large the text appears. */
  fontSize?: number;
  /** Upper limit for scaling the diagram up to fill the box (default 2). */
  maxScale?: number;
  /** Mermaid theme variables that replace single colours of the design, e.g. {primaryBorderColor: C.good}. */
  themeVariables?: Record<string, string>;
  style?: React.CSSProperties;
};

type Drawn = {svg: string; vw: number; vh: number; steps: number; error?: undefined} | {error: string};

const cache = new Map<string, Drawn>();
const pending = new Map<string, Promise<void>>();
let queue: Promise<void> = Promise.resolve();

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};

/** Draws one diagram (serialised: mermaid.initialize is global) and stores the result in the cache. */
function draw(key: string, code: string, fontSize: number, theme: Record<string, unknown>): Promise<void> {
  let p = pending.get(key);
  if (p) return p;
  p = queue = queue.then(async () => {
    const id = `sp-mermaid-${hash(key)}`;
    const host = document.createElement('div');
    // laid out (for text measurement) but invisible and outside the stage
    host.style.cssText = 'position:fixed;left:-100000px;top:0;width:4000px;visibility:hidden;pointer-events:none';
    document.body.appendChild(host);
    try {
      const {default: mermaid} = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        deterministicIds: true,
        deterministicIDSeed: id,
        theme: 'base',
        look: 'classic',
        themeVariables: {...theme, fontSize: `${fontSize}px`},
        fontFamily: theme.fontFamily as string,
        fontSize,
        htmlLabels: false,
        flowchart: {htmlLabels: false, useMaxWidth: false, wrappingWidth: fontSize * 16},
        sequence: {useMaxWidth: false, mirrorActors: true, width: fontSize * 8, height: fontSize * 3},
        state: {useMaxWidth: false},
        class: {useMaxWidth: false},
        er: {useMaxWidth: false},
        gantt: {useMaxWidth: false},
        journey: {useMaxWidth: false},
        pie: {useMaxWidth: false},
      } as Parameters<typeof mermaid.initialize>[0]);
      const {svg} = await mermaid.render(id, code, host);
      host.innerHTML = svg;
      const el = host.querySelector('svg')!;
      const steps = markSteps(el);
      const vb = el.viewBox.baseVal;
      el.removeAttribute('style'); // max-width from Mermaid; the size comes from the component
      el.removeAttribute('width');
      el.removeAttribute('height');
      cache.set(key, {svg: el.outerHTML, vw: vb?.width || 400, vh: vb?.height || 300, steps});
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).split('\n').filter(Boolean).slice(0, 4).join('\n');
      console.error(`Mermaid: ${msg}`);
      cache.set(key, {error: msg});
    } finally {
      host.remove();
    }
  });
  pending.set(key, p);
  return p;
}

/* ── Steps for reveal ─────────────────────────────────────────────────────── */

const STEP = 'data-sp-step';
const isDecor = (el: Element) => ['defs', 'style', 'title', 'desc', 'marker'].includes(el.tagName.toLowerCase());
const trailingNumber = (id: string) => Number(/-(\d+)$/.exec(id)?.[1] ?? NaN);

/** Marks every element that takes part in the reveal with data-sp-step; returns the number of steps. */
function markSteps(svg: SVGSVGElement): number {
  if (svg.querySelector('[data-et="participant"]')) return markSequence(svg);
  const nodes = [...svg.querySelectorAll('g.node')].filter((n) => !n.querySelector('g.node'));
  if (nodes.length) return markGraph(svg, nodes);
  // other diagram types: one step
  for (const el of svg.children) if (!isDecor(el)) el.setAttribute(STEP, '0');
  return 1;
}

const centre = (r: DOMRect) => ({x: r.x + r.width / 2, y: r.y + r.height / 2});

function markGraph(svg: SVGSVGElement, nodes: Element[]): number {
  // order of first mention: Mermaid numbers the node ids in that order (DOM order breaks ties)
  const order = nodes
    .map((n, i) => ({n, i, k: trailingNumber(n.id)}))
    .sort((a, b) => (Number.isNaN(a.k) || Number.isNaN(b.k) ? a.i - b.i : a.k - b.k || a.i - b.i));
  const step = new Map<Element, number>();
  order.forEach(({n}, i) => {
    step.set(n, i);
    n.setAttribute(STEP, String(i));
  });
  const boxes = nodes.map((n) => ({n, r: n.getBoundingClientRect()}));
  const nearest = (p: {x: number; y: number}) => {
    let best = boxes[0];
    let bestD = Infinity;
    for (const b of boxes) {
      const dx = Math.max(b.r.left - p.x, 0, p.x - b.r.right);
      const dy = Math.max(b.r.top - p.y, 0, p.y - b.r.bottom);
      const d = Math.hypot(dx, dy) + 1e-3 * Math.hypot(p.x - centre(b.r).x, p.y - centre(b.r).y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return step.get(best.n)!;
  };
  const toScreen = (path: SVGGeometryElement, len: number) => {
    const pt = path.getPointAtLength(len);
    const m = path.getScreenCTM();
    return m ? new DOMPoint(pt.x, pt.y).matrixTransform(m) : pt;
  };
  for (const edge of svg.querySelectorAll<SVGGeometryElement>('[data-et="edge"]')) {
    let s = 0;
    try {
      const len = edge.getTotalLength();
      s = Math.max(nearest(toScreen(edge, 0)), nearest(toScreen(edge, len)));
    } catch {
      s = 0;
    }
    edge.setAttribute(STEP, String(s));
    const id = edge.getAttribute('data-id');
    if (id) {
      for (const label of svg.querySelectorAll(`.label[data-id="${CSS.escape(id)}"]`)) {
        (label.closest('.edgeLabel') ?? label).setAttribute(STEP, String(s));
      }
    }
  }
  // subgraph boxes appear with the first node inside them
  for (const cl of svg.querySelectorAll('g.cluster')) {
    const r = cl.getBoundingClientRect();
    const inside = boxes.filter((b) => {
      const c = centre(b.r);
      return c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom;
    });
    cl.setAttribute(STEP, String(inside.length ? Math.min(...inside.map((b) => step.get(b.n)!)) : 0));
  }
  return nodes.length;
}

function markSequence(svg: SVGSVGElement): number {
  const parts = [...svg.querySelectorAll('[data-et="participant"]')]
    .map((p, i) => ({p, i, k: trailingNumber(p.id)}))
    .sort((a, b) => (Number.isNaN(a.k) || Number.isNaN(b.k) ? a.i - b.i : a.k - b.k || a.i - b.i));
  const byName = new Map<string, number>();
  parts.forEach(({p}, i) => byName.set(p.getAttribute('data-id') ?? '', i));
  const P = parts.length;

  const events = [...svg.querySelectorAll('[data-et="message"], [data-et="note"]')]
    .map((e) => ({e, k: Number(/\d+/.exec(e.getAttribute('data-id') ?? '')?.[0] ?? NaN), top: e.getBoundingClientRect().top}))
    .sort((a, b) => (Number.isNaN(a.k) || Number.isNaN(b.k) ? a.top - b.top : a.k - b.k));
  const evStep = new Map<Element, number>();
  events.forEach(({e}, i) => evStep.set(e, P + i));

  const stepAtY = (top: number) => {
    // the first message or note at or below this point
    const hit = events.find((ev) => ev.top >= top - 2);
    return hit ? evStep.get(hit.e)! : P + Math.max(0, events.length - 1);
  };

  for (const child of svg.children) {
    if (isDecor(child)) continue;
    const name =
      child.querySelector('[data-et="participant"]')?.getAttribute('data-id') ??
      child.querySelector('[data-et="life-line"]')?.getAttribute('data-id') ??
      child.querySelector('.actor[name]')?.getAttribute('name');
    if (name != null && byName.has(name)) {
      child.setAttribute(STEP, String(byName.get(name)));
      continue;
    }
    const ev = evStep.has(child) ? child : child.querySelector('[data-et="message"], [data-et="note"]');
    if (ev && evStep.has(ev)) {
      child.setAttribute(STEP, String(evStep.get(ev)));
      continue;
    }
    // message texts belong to the message line that follows them
    if (child.classList.contains('messageText')) {
      let next = child.nextElementSibling;
      while (next && !evStep.has(next)) next = next.nextElementSibling;
      if (next) {
        child.setAttribute(STEP, String(evStep.get(next)));
        continue;
      }
    }
    const r = child.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // empty group
    child.setAttribute(STEP, String(stepAtY(r.top)));
  }
  return P + events.length;
}

/* ── Component ────────────────────────────────────────────────────────────── */

const fade = (v: number) => Math.max(0, Math.min(1, v));

/** A Mermaid diagram, absolutely positioned on the stage. */
export const Mermaid: React.FC<MermaidProps> = ({
  code,
  x,
  y,
  w,
  h,
  reveal,
  progress,
  at = 0,
  every,
  stepAt,
  fontSize = 20,
  maxScale = 2,
  themeVariables,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const cls = `sp-mm-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const design = useDesign();
  const theme = useMemo(() => ({...slideTheme(design), ...themeVariables}), [design, themeVariables]);
  const key = useMemo(() => JSON.stringify([code, fontSize, theme]), [code, fontSize, theme]);
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const drawn = cache.get(key);

  useLayoutEffect(() => {
    if (drawn) return;
    // the renderer waits until the diagram is in the DOM (the cleanup runs when the drawn version is committed)
    const done = waitFor('mermaid');
    let alive = true;
    draw(key, code, fontSize, theme).then(() => alive && redraw());
    return () => {
      alive = false;
      done();
    };
  }, [key, !!drawn]); // eslint-disable-line react-hooks/exhaustive-deps

  const box: React.CSSProperties = {position: 'absolute', left: x, top: y, width: w, height: h, ...style};
  if (!drawn) return <div style={box} />;
  if (drawn.error !== undefined) {
    return (
      <div style={{...box, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <pre style={{margin: 0, padding: 16, border: `2px solid ${design.status.bad}`, borderRadius: 8, color: design.status.bad, fontSize: 24, whiteSpace: 'pre-wrap', background: design.diagram.errorBg}}>
          {`Mermaid: ${drawn.error}`}
        </pre>
      </div>
    );
  }

  const scale = Math.min(w / drawn.vw, h / drawn.vh, maxScale);
  const opacity = (i: number) => {
    if (reveal !== undefined) return fade(reveal - i);
    if (progress !== undefined) return fade(progress * drawn.steps - i);
    const start = stepAt?.[i] ?? (every !== undefined ? at + i * every : at);
    return spring({frame: frame - start, fps, config: {damping: 200}});
  };
  const rules = Array.from({length: drawn.steps}, (_, i) => `.${cls} [${STEP}="${i}"]{opacity:${opacity(i).toFixed(4)}}`);
  const css = `.${cls} svg{display:block;width:${drawn.vw * scale}px;height:${drawn.vh * scale}px;max-width:none;overflow:visible}\n${rules.join('\n')}`;

  return (
    <div className={cls} style={{...box, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      <style>{css}</style>
      <SvgHost svg={drawn.svg} />
    </div>
  );
};

/** Sets the SVG markup only when it changes, not on every frame. */
const SvgHost = React.memo(({svg}: {svg: string}) => <div style={{lineHeight: 0}} dangerouslySetInnerHTML={{__html: svg}} />);
SvgHost.displayName = 'SvgHost';
