# Presentation

- `src/` – slides (`scenes*.tsx`, building blocks in `ui.tsx`), texts and sequence (`content.json`),
  notes for questions (`begleittext.md`) and for rebuilding (`umbau-regeln.md`)
- `quellen/` (sources) – material (.md, .txt, .pdf) the model consults when answering questions
- `out/` – rendered video

It is shown and edited with the presenter: run `npm run edit` there and choose this folder under "Presentation".
This folder needs no `node_modules` of its own. To render a video: run `npm run render` in the presenter folder.
