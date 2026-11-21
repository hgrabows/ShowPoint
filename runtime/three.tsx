/**
 * 3D scenes with Three.js (MIT licence). No clock of its own and no requestAnimationFrame loop: the picture is
 * drawn synchronously whenever useCurrentFrame() changes, and `update` sets everything from the frame number
 * alone. That keeps skipping, stops, PDF and video exact to the frame.
 *
 *   <ThreeCanvas x={160} y={220} w={900} h={700}
 *     setup={({scene}) => { const cube = new THREE.Mesh(…); scene.add(cube); return {cube}; }}
 *     update={({objects}, frame, fps) => { objects.cube.rotation.y = (frame / fps) * 0.8; }} />
 *
 * Text drawn in 3D cannot be selected or searched: put labels next to the canvas as normal text.
 */
import React, {useLayoutEffect, useRef} from 'react';
import * as THREE from 'three';
import {useCurrentFrame, useVideoConfig} from './index';

export {THREE};

export type ThreeContext<T = unknown> = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Perspective camera (fov 40, at z = 6, looking at the origin); setup may replace it. */
  camera: THREE.Camera;
  /** Size of the canvas in stage pixels. */
  width: number;
  height: number;
  /** Whatever setup returned. */
  objects: T;
};

type Props<T> = {
  /** Position and size in stage pixels (stage = 1920×1080). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Builds scene, lights and camera once. Its return value is available as ctx.objects. */
  setup: (ctx: ThreeContext<undefined>) => T;
  /** Sets everything from the frame number alone (no clock, no state carried over from earlier frames). */
  update?: (ctx: ThreeContext<T>, frame: number, fps: number) => void;
  /** Resolution of the drawing buffer relative to stage pixels; 2 = sharper on large screens, slower. Default 1. */
  pixelRatio?: number;
  style?: React.CSSProperties;
};

/** Frees geometries, materials and textures of everything in the scene. */
function disposeScene(scene: THREE.Scene) {
  const done = new Set<object>();
  const free = (o: {dispose?: () => void} | null | undefined) => {
    if (!o || done.has(o)) return;
    done.add(o);
    o.dispose?.();
  };
  scene.traverse((obj) => {
    const m = obj as THREE.Mesh;
    free(m.geometry);
    for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) free(v);
      free(mat);
    }
  });
  if (scene.background instanceof THREE.Texture) free(scene.background);
  if (scene.environment) free(scene.environment);
}

/** A Three.js canvas, absolutely positioned on the stage and drawn once per frame. */
export function ThreeCanvas<T>({x, y, w, h, setup, update, pixelRatio = 1, style}: Props<T>) {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const ctx = useRef<ThreeContext<T> | null>(null);
  const latest = useRef({update, frame, fps});
  latest.current = {update, frame, fps};

  const draw = () => {
    const c = ctx.current;
    if (!c) return;
    const {update: u, frame: f, fps: r} = latest.current;
    u?.(c, f, r);
    c.renderer.render(c.scene, c.camera);
  };

  // Create renderer and scene on mount (the canvas is made here, so a remount always gets a fresh WebGL context).
  useLayoutEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    host.current!.appendChild(canvas);
    const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
    const base: ThreeContext<undefined> = {renderer, scene, camera, width: w, height: h, objects: undefined};
    const objects = setup(base);
    ctx.current = {...base, camera: base.camera, objects};
    draw();
    return () => {
      ctx.current = null;
      disposeScene(scene);
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
    // setup runs once per mount; size changes rebuild the scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, pixelRatio]);

  // Draw synchronously whenever the frame changes.
  useLayoutEffect(draw, [frame, fps, update]);

  return <div ref={host} style={{position: 'absolute', left: x, top: y, width: w, height: h, ...style}} />;
}
