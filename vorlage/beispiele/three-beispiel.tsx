/*
 * Beispiel für den 3D-Baustein ThreeCanvas (runtime/three.tsx). Nur Referenz: nicht in REG eingetragen.
 * Zum Benutzen den Inhalt in src/scenes.tsx übernehmen, in Video.tsx unter REG eintragen
 * (z. B. dreid: Dreid) und in content.json eine Szene mit den Texten t01–t04 anlegen.
 *
 * Alles hängt nur von der Bildnummer ab (keine eigene Uhr), deshalb stimmen Vorspulen, PDF und Video.
 * Beschriftungen stehen als normaler Text neben der Grafik: Text in 3D wäre nicht markierbar.
 */
import React from 'react';
import {THREE, ThreeCanvas, spring} from 'showpoint';
import {C, Label, Scene, SceneProps} from './ui';

export const Dreid: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <ThreeCanvas
      x={140}
      y={190}
      w={900}
      h={700}
      setup={({scene, camera}) => {
        camera.position.set(0, 0.6, 6.5);
        camera.lookAt(0, 0, 0);
        scene.add(new THREE.AmbientLight(0xffffff, 0.5));
        const key = new THREE.DirectionalLight(0xffffff, 2.8);
        key.position.set(3, 4, 5);
        scene.add(key);
        const rim = new THREE.DirectionalLight(C.doc, 1.6);
        rim.position.set(-4, -2, -3);
        scene.add(rim);

        const group = new THREE.Group();
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(1.6, 0.42, 48, 160),
          new THREE.MeshStandardMaterial({color: C.mem, roughness: 0.35, metalness: 0.2}),
        );
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 1.1, 1.1),
          new THREE.MeshStandardMaterial({color: C.query, roughness: 0.45, metalness: 0.1}),
        );
        group.add(torus, cube);
        scene.add(group);
        return {group, torus, cube};
      }}
      update={({objects}, frame, fps) => {
        const t = frame / fps; // Sekunden seit Beginn der Szene
        const s = spring({frame: frame - 10, fps, config: {damping: 200}});
        objects.group.scale.setScalar(0.6 + 0.4 * s);
        objects.torus.rotation.set(0.5 + 0.25 * Math.sin(t * 0.8), t * 0.9, 0);
        objects.cube.rotation.set(t * 1.3, t * 0.7, 0);
      }}
    />
    <Label x={1120} y={330} w={680} at={30} size={40} color={C.text} weight={700}>
      {c.t.t01}
    </Label>
    <Label x={1120} y={420} w={680} at={50} size={30}>
      {c.t.t02}
    </Label>
    <Label x={1120} y={540} w={680} at={70} size={30} color={C.mem}>
      {c.t.t03}
    </Label>
    <Label x={1120} y={620} w={680} at={90} size={30} color={C.query}>
      {c.t.t04}
    </Label>
  </Scene>
);
