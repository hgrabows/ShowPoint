import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Appear, Arrow, Box, C, Label, Scene, SceneProps, Sub, Svg} from './ui';

/* 1 ─ Title */
export const Title: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur}>
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', textAlign: 'center'}}>
      <Appear at={10}>
        <div style={{fontSize: 130, fontWeight: 800, letterSpacing: -3}}>{c.t.t01}</div>
      </Appear>
      <Appear at={30}>
        <div style={{fontSize: 48, color: C.muted, marginTop: 10}}>{c.t.t02}</div>
      </Appear>
    </AbsoluteFill>
  </Scene>
);

/* 2 ─ Example: two boxes, an arrow, a label. Shows how to use the building blocks from ui.tsx. */
export const Beispiel: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <Box x={260} y={380} w={520} h={220} at={20} color={C.doc}>
      {c.t.t01}
      <Sub>{c.t.t02}</Sub>
    </Box>
    <Svg>
      <Arrow x1={800} y1={490} x2={1120} y2={490} at={70} color={C.query} />
    </Svg>
    <Box x={1140} y={380} w={520} h={220} at={90} color={C.mem}>
      {c.t.t03}
      <Sub>{c.t.t04}</Sub>
    </Box>
    <Label x={260} y={660} w={1400} at={130} align="center" size={32}>
      {c.t.t05}
    </Label>
  </Scene>
);
