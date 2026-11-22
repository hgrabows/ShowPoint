/**
 * The design of a presentation – colours, font, background, shapes – for the building blocks of the runtime.
 * A presentation keeps it in src/design.json and hands it over once, in src/Video.tsx:
 *
 *   import design from './design.json';
 *   <DesignProvider design={design}> … </DesignProvider>
 *
 * Charts, Mermaid diagrams and 3D models then take their colours from it (useDesign()). Without a provider the
 * dark look of older presentations applies (NIGHT), so those stay exactly as they were.
 */
import React, {createContext, useContext, useMemo} from 'react';
import {NIGHT, resolveDesign} from './designCore.mjs';
import type {Design} from './designCore.mjs';

export {NIGHT, resolveDesign, mix} from './designCore.mjs';
export type {Design, DesignInput} from './designCore.mjs';

const DesignCtx = createContext<Design>(NIGHT);

/** Makes a design (the content of src/design.json, complete or partial) available to everything inside. */
export const DesignProvider: React.FC<{design?: unknown; children?: React.ReactNode}> = ({design, children}) => {
  const value = useMemo(() => resolveDesign(design), [design]);
  return <DesignCtx.Provider value={value}>{children}</DesignCtx.Provider>;
};

/** The design in force here: the one of the nearest DesignProvider, otherwise the dark standard look. */
export const useDesign = (): Design => useContext(DesignCtx);
