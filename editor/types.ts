/**
 * Die Schnittstelle zwischen Präsentator und Inhalt.
 * Ein Inhaltsordner liefert:
 *   src/Video.tsx     – exportiert `Video`, eine Remotion-Komponente mit der Eigenschaft {content}
 *   src/content.json  – Daten in der Form `Content`
 *   src/begleittext.md, src/umbau-regeln.md (optional) – Hinweise für Fragen bzw. Umbau
 *   quellen/          – (optional) Dateien, in denen das Modell bei Fragen nachliest
 */
export type Caption = {at: number; text: string};

export type SceneContent = {
  /** Kurzname für die Leiste des Präsentators */
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
  /** Name der Präsentation, erscheint im Fenstertitel */
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
