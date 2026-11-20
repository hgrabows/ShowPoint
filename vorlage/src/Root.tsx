import React from 'react';
import {Composition} from 'remotion';
import data from './content.json';
import {Content, Video, totalFrames} from './Video';

const content = data as Content;

export const Root: React.FC = () => (
  <Composition
    id="Praesentation"
    component={Video}
    defaultProps={{content}}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={totalFrames(content)}
  />
);
