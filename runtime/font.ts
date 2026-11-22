/**
 * Own fonts for a presentation (a house font, for example): font files in src/schriften/ are registered once and
 * then used like any font family.
 *
 *   import regular from './schriften/haus-regular.woff2';
 *   import bold from './schriften/haus-bold.woff2';
 *   loadFont('Haus', regular);
 *   loadFont('Haus', bold, {weight: 700});
 *   export const FONT = '"Haus", "Helvetica Neue", Arial, sans-serif';
 *
 * Call it at the top of a file (not inside a component). The renderer waits until the font is loaded, so PDF, video
 * and the preview never show the fallback font.
 */
import {waitFor} from './wait';

const loaded = new Set<string>();

/** Registers a font file under a family name; weight e.g. 400 or 700 (or a range like "100 900"), style "normal" or "italic". Returns the family name. */
export function loadFont(family: string, src: string, opts: {weight?: number | string; style?: 'normal' | 'italic'} = {}): string {
  const weight = String(opts.weight ?? 400);
  const style = opts.style ?? 'normal';
  const key = `${family}|${weight}|${style}|${src}`;
  if (loaded.has(key) || typeof document === 'undefined' || typeof FontFace === 'undefined') return family;
  loaded.add(key);
  const done = waitFor(`font ${family}`);
  const face = new FontFace(family, `url(${JSON.stringify(src)})`, {weight, style, display: 'block'});
  document.fonts.add(face);
  face
    .load()
    .catch((e) => console.error(`Font "${family}" (${src}) could not be loaded:`, e))
    .finally(done);
  return family;
}
