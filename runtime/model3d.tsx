/**
 * 3D models from a file (.glb, the binary glTF format – Blender and most 3D programs export it), shown with
 * Three.js. The model is centred and scaled to fit, lit, and turned from the frame number alone, so skipping,
 * stops, PDF and video stay exact. Animations stored in the file play along the frame number, too.
 *
 *   import haus from './modelle/haus.glb';
 *   <Model3D src={haus} x={560} y={200} w={800} h={640} at={10} spin={20} />
 *
 * For more control – showing single parts, moving the camera – pass `update`: it gets the loaded model
 * (ctx.objects.model, parts by name with model.getObjectByName('Dach')) and sets everything from the frame.
 */
import React, {useEffect, useState} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {interpolate, useCurrentFrame} from './index';
import {ThreeCanvas} from './three';
import type {ThreeContext} from './three';
import {waitFor} from './wait';

export type Model3DObjects = {
  /** The loaded model, centred at the origin and scaled so that its largest side is about 2 units. */
  model: THREE.Object3D;
  /** Turn this to rotate the model (the default rotation uses it). */
  pivot: THREE.Group;
  /** Plays the animations stored in the file; null when there are none. */
  mixer: THREE.AnimationMixer | null;
};

type Props = {
  /** URL of the .glb file: `import haus from './modelle/haus.glb'`. */
  src: string;
  /** Position and size in stage pixels (stage = 1920×1080). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Frame at which the model fades in. Default 0. */
  at?: number;
  /** View at the start, in degrees: angle turns around the vertical axis, tilt looks from above. Default −30 / 15. */
  angle?: number;
  tilt?: number;
  /** Rotation around the vertical axis in degrees per second (computed from the frame). Default 0 = stands still. */
  spin?: number;
  /** 1 = the model fills the canvas comfortably; larger = closer. */
  zoom?: number;
  /** Brightness of the built-in lights. Default 1. */
  light?: number;
  /** Play the animations stored in the file, starting at frame `at`. Default true. */
  animate?: boolean;
  /** Own control per frame, after the defaults: set rotation, visibility of parts, camera … from the frame alone. */
  update?: (ctx: ThreeContext<Model3DObjects>, frame: number, fps: number) => void;
  pixelRatio?: number;
  style?: React.CSSProperties;
};

// one download per file, however often it is shown; parsed anew for every canvas (a scene belongs to one renderer)
const files = new Map<string, Promise<ArrayBuffer>>();
const fetchFile = (src: string) => {
  let p = files.get(src);
  if (!p) {
    p = fetch(src).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return r.arrayBuffer();
    });
    p.catch(() => files.delete(src));
    files.set(src, p);
  }
  return p;
};

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

export const Model3D: React.FC<Props> = ({src, x, y, w, h, at = 0, angle = -30, tilt = 15, spin = 0, zoom = 1, light = 1, animate = true, update, pixelRatio, style}) => {
  const frame = useCurrentFrame();
  const [state, setState] = useState<{src: string; gltf?: GLTF; error?: string}>({src});

  useEffect(() => {
    let alive = true;
    const done = waitFor('Model3D'); // the renderer waits until the model is there (or has failed)
    setState({src});
    fetchFile(src)
      .then((data) => loader.parseAsync(data.slice(0), ''))
      .then((gltf) => alive && setState({src, gltf}))
      .catch((e) => {
        const msg = String(e?.message ?? e);
        const hint = /draco/i.test(msg) ? ' (Draco-compressed files are not supported: export without compression, or with Meshopt)' : '';
        if (alive) setState({src, error: msg + hint});
      })
      .finally(() => {
        // one more turn, so React has put the canvas into the page before the picture is taken
        requestAnimationFrame(() => done());
      });
    return () => {
      alive = false;
      done();
    };
  }, [src]);

  const box: React.CSSProperties = {position: 'absolute', left: x, top: y, width: w, height: h, ...style};
  if (state.error) {
    return (
      <div style={{...box, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #ff5a5a', borderRadius: 12, color: '#ff8a8a', fontSize: 24, padding: 24, boxSizing: 'border-box', textAlign: 'center'}}>
        3D model could not be loaded: {state.error}
      </div>
    );
  }
  const gltf = state.src === src ? state.gltf : undefined;
  if (!gltf) return <div style={box} />;

  const opacity = interpolate(frame, [at, at + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <ThreeCanvas<Model3DObjects>
      key={src}
      x={x}
      y={y}
      w={w}
      h={h}
      pixelRatio={pixelRatio}
      style={{...style, opacity}}
      setup={({scene, camera, renderer}) => {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const model = gltf.scene;
        // centre it and bring its largest side to 2 units, whatever units the file uses
        const size = new THREE.Box3().setFromObject(model);
        const centre = size.getCenter(new THREE.Vector3());
        const largest = Math.max(...size.getSize(new THREE.Vector3()).toArray()) || 1;
        const holder = new THREE.Group();
        holder.scale.setScalar(2 / largest);
        model.position.sub(centre);
        holder.add(model);
        const pivot = new THREE.Group();
        pivot.add(holder);
        scene.add(pivot);
        scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 0.9 * light));
        const key = new THREE.DirectionalLight(0xffffff, 1.7 * light);
        key.position.set(3, 5, 4);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5 * light);
        fill.position.set(-4, 1, -3);
        scene.add(fill);
        camera.position.set(0, 0, 4.3 / zoom);
        camera.lookAt(0, 0, 0);
        const mixer = gltf.animations.length ? new THREE.AnimationMixer(model) : null;
        if (mixer) for (const clip of gltf.animations) mixer.clipAction(clip).play();
        return {model, pivot, mixer};
      }}
      update={(ctx, f, fps) => {
        const {pivot, mixer} = ctx.objects;
        const t = Math.max(0, f - at) / fps;
        pivot.rotation.set(THREE.MathUtils.degToRad(tilt), THREE.MathUtils.degToRad(angle + spin * t), 0);
        if (mixer) mixer.setTime(animate ? t : 0);
        update?.(ctx, f, fps);
      }}
    />
  );
};
