/**
 * The interface between the presenter and the content.
 * A content folder provides:
 *   src/Video.tsx     – exports `Video`, a Remotion component with the prop {content}
 *   src/content.json  – data in the shape `Content`
 *   src/begleittext.md, src/umbau-regeln.md (optional) – notes for questions and for rebuilds
 *   quellen/          – (optional) files the model reads when answering questions
 */
export type Caption = {at: number; text: string};

export type SceneContent = {
  /** Short name for the presenter's scene bar */
  name?: string;
  dur: number;
  kicker?: string;
  title?: string;
  captions?: Caption[];
  stops: number[];
  t: Record<string, string>;
  lists: Record<string, string[]>;
};

export type Content = {
  /** Name of the presentation, shown in the window title */
  title?: string;
  order: string[];
  scenes: Record<string, SceneContent>;
};

export const totalFrames = (c: Content) => c.order.reduce((a, id) => a + c.scenes[id].dur, 0);

export const sceneStarts = (c: Content) => {
  let s = 0;
  return c.order.map((id) => {
    const start = s;
    s += c.scenes[id].dur;
    return start;
  });
};
