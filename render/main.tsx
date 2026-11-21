// Page that the renderer (scripts/stills.mjs) opens in a headless browser: shows the chosen presentation at one
// frame and exposes window.showFrame(frame), which resolves once that frame is fully drawn (images, fonts).
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Stage} from '../runtime';
import {Video, content} from 'virtual:showpoint-presentation';

declare global {
  interface Window {
    showFrame: (frame: number) => Promise<void>;
    renderInfo: {durationInFrames: number; error: string};
  }
}

const params = new URLSearchParams(location.search);
const scale = Number(params.get('scale') || 1);
const config = {fps: 30, width: 1920, height: 1080, durationInFrames: content.order.reduce((a: number, id: string) => a + content.scenes[id].dur, 0)};
window.renderInfo = {durationInFrames: config.durationInFrames, error: ''};

class Catch extends React.Component<{children: React.ReactNode}, {error: string}> {
  state = {error: ''};
  static getDerivedStateFromError(e: Error) {
    return {error: String(e?.message ?? e)};
  }
  componentDidCatch(e: Error) {
    window.renderInfo.error = String(e?.message ?? e);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

const root = createRoot(document.getElementById('root')!);
const draw = (frame: number) =>
  root.render(
    <div style={{width: config.width, height: config.height, transform: `scale(${scale})`, transformOrigin: '0 0'}}>
      <Catch key={frame}>
        <Stage component={Video} inputProps={{content}} frame={frame} config={config} />
      </Catch>
    </div>,
  );

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

window.showFrame = async (frame) => {
  window.renderInfo.error = '';
  flushSync(() => draw(frame));
  await document.fonts.ready;
  await Promise.all(
    [...document.images].filter((img) => !img.complete).map((img) => new Promise((r) => {
      img.addEventListener('load', r, {once: true});
      img.addEventListener('error', r, {once: true});
    })),
  );
  await nextPaint();
  if (window.renderInfo.error) throw new Error(window.renderInfo.error);
};
