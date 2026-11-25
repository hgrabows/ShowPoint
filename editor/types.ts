/**
 * The interface between the presenter and the content.
 * A content folder provides:
 *   src/Video.tsx     – exports `Video`, a React component with the prop {content}
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
  /** Sections skipped when advancing ("jump"), given by their first frame: 0 or one of the stops. */
  skip?: number[];
  /** PowerPoint export: the part below the heading becomes an animated GIF (one per stop) instead of single objects. */
  pptxGif?: boolean;
  t: Record<string, string>;
  lists: Record<string, string[]>;
};

export type Content = {
  /** Name of the presentation, shown in the window title */
  title?: string;
  order: string[];
  /**
   * Slides removed in the slide list: their data stays in `scenes` (and their code in src/) so they can be
   * restored; `after` is the slide they followed. Scenes missing from `order` count as removed either way.
   */
  removed?: {id: string; after: string | null}[];
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
