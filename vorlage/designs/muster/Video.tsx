// Sample slide for the preview pictures of the designs (scripts/designs.mjs). It is put together with
// vorlage/src/ui.tsx and one design as src/design.json, then rendered. Not part of a new presentation.
import React from 'react';
import {AbsoluteFill, DesignProvider, Series} from 'showpoint';
import design from './design.json';
import {D, SceneContent} from './ui';
import {Muster} from './scenes';

export type Content = {title?: string; order: string[]; scenes: Record<string, SceneContent>};

export const Video: React.FC<{content: Content}> = ({content}) => (
  <DesignProvider design={design}>
    <AbsoluteFill style={{background: D.surface.stage}}>
      <Series>
        {content.order.map((id) => (
          <Series.Sequence key={id} durationInFrames={content.scenes[id].dur}>
            <Muster dur={content.scenes[id].dur} c={content.scenes[id]} />
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  </DesignProvider>
);
