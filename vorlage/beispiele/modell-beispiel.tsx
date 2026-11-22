/*
 * Beispiel für 3D-Modelle aus einer Datei (Baustein Model3D, runtime/model3d.tsx). Nur Referenz: nicht in REG
 * eingetragen. Zum Benutzen haus.glb nach src/modelle/ kopieren, den Inhalt in src/scenes.tsx übernehmen, in
 * Video.tsx unter REG eintragen (haus: Haus) und in content.json eine Szene "haus" anlegen.
 *
 * .glb ist das binäre glTF-Format; Blender exportiert es über Datei → Exportieren → glTF 2.0 (.glb), ohne
 * Draco-Kompression. Das Modell wird zentriert, eingepasst und beleuchtet; alles Weitere folgt aus der Bildnummer.
 */
import React from 'react';
import {Model3D} from 'showpoint';
import {Scene, SceneProps} from './ui';
import haus from './modelle/haus.glb';

/** Das Haus dreht sich langsam; das Dach (Teil mit dem Namen "Dach") erscheint erst ab Bild 60. */
export const Haus: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <Model3D
      src={haus}
      x={460}
      y={200}
      w={1000}
      h={680}
      at={5}
      spin={30}
      update={(ctx, frame) => {
        const dach = ctx.objects.model.getObjectByName('Dach');
        if (dach) dach.visible = frame >= 60;
      }}
    />
  </Scene>
);
