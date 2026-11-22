import React from 'react';
import {BarChart, Mermaid} from 'showpoint';
import {Arrow, Box, C, Label, SHAPE, Scene, SceneProps, Sub, Svg} from './ui';

/** Everything a design has to carry: heading, text, boxes, the accent palette, a chart, a diagram, the caption. */
export const Muster: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <Box x={90} y={215} w={520} h={170} color={C.accent[0]}>
      {c.t.t01}
      <Sub>{c.t.t02}</Sub>
    </Box>
    <Svg>
      <Arrow x1={350} y1={395} x2={350} y2={437} />
    </Svg>
    <Box x={90} y={445} w={520} h={170} fill={C.panel2} color={C.good}>
      {c.t.t03}
      <Sub>{c.t.t04}</Sub>
    </Box>
    <Label x={90} y={645} w={520} color={C.text} size={28}>
      {c.t.t05}
    </Label>
    <Label x={90} y={728} w={520}>
      {c.t.t06}
    </Label>
    {C.accent.slice(0, 8).map((color, i) => (
      <div key={i} style={{position: 'absolute', left: 90 + i * 66, top: 810, width: 54, height: 54, borderRadius: Math.min(12, SHAPE.radius), background: color}} />
    ))}
    <BarChart x={690} y={225} w={520} h={640} labels={c.lists.namen} values={c.lists.werte} colors={C.accent} unit=" %" />
    <Mermaid code={c.t.ablauf} x={1290} y={215} w={540} h={655} />
  </Scene>
);
