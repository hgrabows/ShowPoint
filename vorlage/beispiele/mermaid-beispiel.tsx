/*
 * Beispiel für den Diagramm-Baustein Mermaid (runtime/mermaid.tsx). Nur Referenz: nicht in REG eingetragen.
 * Zum Benutzen den Inhalt in src/scenes.tsx übernehmen, in Video.tsx unter REG eintragen
 * (z. B. ablauf: Ablauf, gespraech: Gespraech) und in content.json Szenen mit den Texten anlegen, etwa:
 *
 *   "t": {
 *     "fluss": "flowchart LR\n  A[Frage] --> B{Im Speicher?}\n  B -->|ja| C[Antwort sofort]\n  B -->|nein| D[Nachschlagen]\n  D --> C",
 *     "t01": "Erst prüfen, dann nachschlagen"
 *   }
 *
 *   "t": {"seq": "sequenceDiagram\n  participant N as Nutzer\n  participant S as Server\n  N->>S: Anfrage\n  S-->>N: Antwort"}
 *
 * Der Mermaid-Text steht in content.json, damit er im Präsenter bearbeitet werden kann. Mermaid zeichnet einmal,
 * danach ändern sich pro Bild nur die Deckkräfte: Vorspulen, PDF und Video stimmen genau.
 */
import React from 'react';
import {Mermaid, interpolate, useCurrentFrame} from 'showpoint';
import {C, CLAMP, Label, Scene, SceneProps} from './ui';

/** Flussdiagramm: die Knoten erscheinen nacheinander (at + every), jede Kante mit dem späteren ihrer Knoten. */
export const Ablauf: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <Mermaid code={c.t.fluss} x={90} y={200} w={1740} h={560} at={20} every={30} fontSize={22} />
    <Label x={90} y={800} w={1740} at={170} size={32} color={C.text} align="center">
      {c.t.t01}
    </Label>
  </Scene>
);

/** Sequenzdiagramm: Einblenden selbst gesteuert, z. B. passend zu den Stopps (reveal = Zahl sichtbarer Schritte). */
export const Gespraech: React.FC<SceneProps> = ({dur, c}) => {
  const frame = useCurrentFrame();
  // 2 Teilnehmer bis Bild 40, danach die beiden Nachrichten bis Bild 140
  const reveal = interpolate(frame, [10, 40, 140], [0, 2, 4], CLAMP);
  return (
    <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
      <Mermaid code={c.t.seq} x={360} y={200} w={1200} h={680} reveal={reveal} fontSize={22} />
    </Scene>
  );
};
