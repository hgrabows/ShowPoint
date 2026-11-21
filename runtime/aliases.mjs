// Slides import their building blocks from 'showpoint' (older ones from 'remotion'); both names lead to the
// runtime in this folder. Shared by the presenter (vite.config.mts) and the renderer (scripts/stills.mjs).
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const runtimeEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), 'index.tsx');

export const runtimeResolve = {
  preserveSymlinks: true,
  alias: [{find: /^(showpoint|remotion)$/, replacement: runtimeEntry}],
  // presentations may live outside this folder: react always comes from here
  dedupe: ['react', 'react-dom'],
};
