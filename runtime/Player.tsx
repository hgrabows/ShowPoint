import React, {forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState} from 'react';
import {Stage} from './index';

type FrameEvent = CustomEvent<{frame: number}>;
export type PlayerEventType = 'frameupdate' | 'play' | 'pause' | 'ended';

export type PlayerRef = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seekTo: (frame: number) => void;
  getCurrentFrame: () => number;
  isPlaying: () => boolean;
  addEventListener: (type: PlayerEventType, cb: (e: FrameEvent) => void) => void;
  removeEventListener: (type: PlayerEventType, cb: (e: FrameEvent) => void) => void;
};

type Props = {
  component: React.ComponentType<any>;
  inputProps?: Record<string, unknown>;
  durationInFrames: number;
  compositionWidth: number;
  compositionHeight: number;
  fps: number;
  style?: React.CSSProperties;
  className?: string;
};

/**
 * Shows a presentation in the browser: scales the stage to fit, runs the frame clock while playing and reports
 * every frame change ('frameupdate'), 'play', 'pause' and 'ended' to listeners. It stops at the last frame.
 */
export const Player = forwardRef<PlayerRef, Props>(
  ({component, inputProps, durationInFrames, compositionWidth, compositionHeight, fps, style, className}, ref) => {
    const [frame, setFrame] = useState(0);
    const events = useRef(new EventTarget());
    const st = useRef({frame: 0, playing: false, t0: 0, f0: 0, raf: 0});
    const last = Math.max(0, durationInFrames - 1);
    const lastRef = useRef(last);
    lastRef.current = last;

    const emit = (type: PlayerEventType, f = st.current.frame) => events.current.dispatchEvent(new CustomEvent(type, {detail: {frame: f}}));

    const show = useCallback((f: number) => {
      if (f === st.current.frame) return;
      st.current.frame = f;
      setFrame(f);
      emit('frameupdate', f);
    }, []);

    const pause = useCallback(() => {
      const s = st.current;
      if (!s.playing) return;
      s.playing = false;
      cancelAnimationFrame(s.raf);
      emit('pause');
    }, []);

    const tick = useCallback(() => {
      const s = st.current;
      if (!s.playing) return;
      const f = s.f0 + Math.floor(((performance.now() - s.t0) * fps) / 1000);
      if (f >= lastRef.current) {
        show(lastRef.current);
        pause();
        emit('ended');
        return;
      }
      show(f);
      s.raf = requestAnimationFrame(tick);
    }, [fps, show, pause]);

    const play = useCallback(() => {
      const s = st.current;
      if (s.playing || s.frame >= lastRef.current) return;
      s.playing = true;
      s.t0 = performance.now();
      s.f0 = s.frame;
      emit('play');
      s.raf = requestAnimationFrame(tick);
    }, [tick]);

    const seekTo = useCallback(
      (f: number) => {
        const s = st.current;
        const clamped = Math.max(0, Math.min(lastRef.current, Math.round(f)));
        show(clamped);
        if (s.playing) {
          s.t0 = performance.now();
          s.f0 = clamped;
        }
      },
      [show],
    );

    useImperativeHandle(
      ref,
      () => ({
        play,
        pause,
        toggle: () => (st.current.playing ? pause() : play()),
        seekTo,
        getCurrentFrame: () => st.current.frame,
        isPlaying: () => st.current.playing,
        addEventListener: (type, cb) => events.current.addEventListener(type, cb as EventListener),
        removeEventListener: (type, cb) => events.current.removeEventListener(type, cb as EventListener),
      }),
      [play, pause, seekTo],
    );

    // a shorter presentation (e.g. after removing a slide): stay inside it
    useEffect(() => {
      if (st.current.frame > last) seekTo(last);
    }, [last, seekTo]);
    useEffect(() => () => cancelAnimationFrame(st.current.raf), []);

    // scale the stage to fit the box, keeping its aspect ratio
    const box = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0);
    useLayoutEffect(() => {
      const el = box.current;
      if (!el) return;
      const fit = () => setScale(Math.min(el.clientWidth / compositionWidth, el.clientHeight / compositionHeight));
      fit();
      const ro = new ResizeObserver(fit);
      ro.observe(el);
      return () => ro.disconnect();
    }, [compositionWidth, compositionHeight]);

    return (
      <div ref={box} className={className} style={{position: 'relative', overflow: 'hidden', ...style}}>
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: compositionWidth,
            height: compositionHeight,
            marginLeft: -compositionWidth / 2,
            marginTop: -compositionHeight / 2,
            transform: `scale(${scale})`,
            visibility: scale ? 'visible' : 'hidden',
          }}
        >
          <Catch reset={[component, inputProps]}>
            <Stage
              component={component}
              inputProps={inputProps}
              frame={Math.min(frame, last)}
              config={{fps, width: compositionWidth, height: compositionHeight, durationInFrames}}
            />
          </Catch>
        </div>
      </div>
    );
  },
);
Player.displayName = 'Player';

/** Shows a slide error on the stage instead of blanking the whole page. */
class Catch extends React.Component<{reset: unknown[]; children: React.ReactNode}, {error: Error | null}> {
  state = {error: null as Error | null};
  static getDerivedStateFromError(error: Error) {
    return {error};
  }
  componentDidUpdate(prev: {reset: unknown[]}) {
    // new slides or texts: try again
    if (this.state.error && prev.reset.some((v, i) => v !== this.props.reset[i])) this.setState({error: null});
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{position: 'absolute', inset: 0, background: '#1a0b0f', color: '#fca5a5', padding: 60, font: '28px ui-monospace, Menlo, monospace', whiteSpace: 'pre-wrap', overflow: 'auto'}}>
        {String(this.state.error.stack || this.state.error.message)}
      </div>
    );
  }
}
