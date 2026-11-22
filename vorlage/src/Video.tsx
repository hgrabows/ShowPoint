import React from 'react';
import {AbsoluteFill, DesignProvider, Series} from 'showpoint';
import design from './design.json';
import {D, SceneContent, SceneProps} from './ui';
import {Beispiel, Title} from './scenes';

export type Content = {title?: string; order: string[]; scenes: Record<string, SceneContent>};

// Every scene ID from content.json ("order") needs an entry here.
const REG: Record<string, React.FC<SceneProps>> = {
  title: Title,
  beispiel: Beispiel,
};

export const totalFrames = (c: Content) =>
  c.order.reduce((a, id) => a + c.scenes[id].dur, 0);

export const sceneStarts = (c: Content) => {
  let s = 0;
  return c.order.map((id) => {
    const start = s;
    s += c.scenes[id].dur;
    return start;
  });
};

export const Video: React.FC<{content: Content}> = ({content}) => (
  // DesignProvider hands the design (design.json) to the building blocks of the runtime: charts, diagrams, 3D models
  <DesignProvider design={design}>
  <AbsoluteFill style={{background: D.surface.stage}}>
    <Series>
      {content.order.map((id) => {
        const C = REG[id];
        const c = content.scenes[id];
        return (
          <Series.Sequence key={id} durationInFrames={c.dur}>
            <C dur={c.dur} c={c} all={content.scenes} />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
  </DesignProvider>
);
