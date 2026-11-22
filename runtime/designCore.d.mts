/** A complete design, as the building blocks use it (see resolveDesign). */
export type Design = {
  /** Name shown in the presenter ("Design: …"). */
  name: string;
  /** Dark stage with light text? Decides a few derived colours and the Mermaid theme. */
  dark: boolean;
  surface: {
    /** Background as one plain colour: what charts and diagrams treat as "the ground". */
    bg: string;
    /** CSS background of the slide; may be a gradient. Default: bg. */
    background: string;
    /** Box. */
    panel: string;
    /** Second box, a little more prominent (also diagram nodes). */
    panel2: string;
    /** Frame of boxes, grid lines of charts. */
    border: string;
    /** Small recessed area (e.g. a document symbol). */
    inset: string;
  };
  text: {
    normal: string;
    muted: string;
    heading: string;
    /** Line above the heading. */
    kicker: string;
    /** Text on top of an accent colour (e.g. percentages in a pie chart). */
    onAccent: string;
  };
  /** Accent palette, about six colours; series of charts take them in this order. */
  accent: string[];
  status: {good: string; bad: string; note: string};
  font: {
    /** CSS font stack. */
    family: string;
    weights: {normal: number; strong: number; kicker: number; heading: number};
    /** Own font files in src/schriften/, registered by src/ui.tsx. */
    files: {family: string; file: string; weight: number | string; style: 'normal' | 'italic'}[];
  };
  shape: {radius: number; borderWidth: number};
  /** Box of the spoken text at the bottom. */
  caption: {bg: string; border: string; text: string};
  /** Diagrams (Mermaid, PlantUML). */
  diagram: {node: string; nodeBorder: string; line: string; group: string; noteBg: string; noteBorder: string; errorBg: string};
  /** Light for 3D models: colour from below and of the fill light. */
  model: {ground: string; fill: string};
};

type Partial2<T> = {[K in keyof T]?: T[K] extends (infer U)[] ? U[] : T[K] extends object ? Partial<T[K]> : T[K]};
/** What src/design.json may contain: any part of a design; the rest is derived. */
export type DesignInput = Partial2<Omit<Design, 'font'>> & {font?: {family?: string; weights?: Partial<Design['font']['weights']>; files?: {family: string; file: string; weight?: number | string; style?: string}[]}};

export const NIGHT: Design;
export function resolveDesign(input: unknown): Design;
export function isDesign(v: unknown): boolean;
export function parseColor(c: unknown): [number, number, number, number] | null;
export function mix(a: string, b: string, t: number): string;
export function over(top: string, base: string): string;
export function luminance(c: string): number;
export function contrast(a: string, b: string): number;
export function contrastReport(design: unknown): {what: string; on: string; fg: string; bg: string; ratio: number; min: number; ok: boolean}[];
export function plantumlTheme(design: unknown): string;
