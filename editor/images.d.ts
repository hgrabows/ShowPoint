// Image imports in slides (e.g. `import foto from './bilder/foto.png'`) resolve to the image URL,
// both in the presenter (Vite) and when rendering (scripts/stills.mjs).
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.jpeg' {
  const src: string;
  export default src;
}
declare module '*.webp' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
// 3D models (binary glTF), shown with <Model3D src={…} /> from 'showpoint'
declare module '*.glb' {
  const src: string;
  export default src;
}
// Font files, registered with loadFont('Name', file) from 'showpoint'
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.ttf' {
  const src: string;
  export default src;
}
declare module '*.otf' {
  const src: string;
  export default src;
}
// import.meta.glob (Vite): src/ui.tsx uses it to find the font files in src/schriften/ that design.json names
interface ImportMeta {
  glob<T = unknown>(pattern: string | string[], options?: {eager?: boolean; query?: string; import?: string}): Record<string, T>;
}
