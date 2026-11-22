/**
 * Waiting for building blocks that draw asynchronously (like Remotion's delayRender / continueRender).
 *
 *   const done = waitFor('mermaid');   // e.g. in useLayoutEffect, before starting the async work
 *   …                                  // later, once the result is in the DOM:
 *   done();
 *
 * The renderer (render/main.tsx → window.showFrame) only takes a picture once every open handle is done, so PDF,
 * video and the preview never show a half-drawn frame. The presenter does not wait; it just shows the result
 * as soon as it is there. Calling done() more than once has no effect.
 */

type Handle = {label: string; since: number};

const open = new Set<Handle>();
let listeners: (() => void)[] = [];

const notify = () => {
  if (open.size) return;
  const l = listeners;
  listeners = [];
  for (const f of l) f();
};

/** Registers something the renderer has to wait for; returns the function that marks it as done. */
export function waitFor(label = 'waitFor'): () => void {
  const h: Handle = {label, since: Date.now()};
  open.add(h);
  return () => {
    if (open.delete(h)) notify();
  };
}

/** Resolves once no handle is open any more; rejects after `timeoutMs` and names what is still pending. */
export function allDone(timeoutMs = 30_000): Promise<void> {
  if (!open.size) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      listeners = listeners.filter((f) => f !== finish);
      const pending = [...open].map((h) => h.label);
      reject(
        new Error(
          `Timed out after ${Math.round(timeoutMs / 1000)} s waiting for: ${[...new Set(pending)].join(', ')} ` +
            `(${pending.length} open). A building block did not finish drawing – check the browser console for its error.`,
        ),
      );
    }, timeoutMs);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    listeners.push(finish);
  });
}
