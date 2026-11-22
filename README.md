# ShowPoint

**Slides you can ask questions.** ShowPoint is an alternative to PowerPoint, NotebookLM-style study tools and
classic e-learning: presentations are animated React scenes that play in the browser,
pause at stops, answer questions about what is on screen – and can be rebuilt or created from scratch by Claude Code.

> Full guide: [GUIDE.md](GUIDE.md) (German version: [ANLEITUNG.md](ANLEITUNG.md)).

## What it does

- **Present** – animated slides with stops; advance with space, arrow keys or a click; fullscreen with `F`.
- **Ask about a slide** (`?`) – ask about what is currently shown, or mark text and ask about exactly that.
  Answers come from Claude Code, OpenAI Codex (both through your subscription login, no API key) or your own provider (URL and key) and draw on the slide texts and your own sources
  (`quellen/`: Markdown, text, PDF).
- **Rebuild a slide** – describe the change in plain words; Claude Code edits the slide code, the type check runs,
  the presentation reloads. Every rebuild can be undone. A suggestion from “ask” can be handed over with one click.
- **Add images** – name an image file in a rebuild or create task; it is copied into the presentation and placed by Claude.
- **Charts, formulas, diagrams, 3D** – built-in building blocks for bar, line and pie charts, KaTeX formulas, Mermaid diagrams (flowcharts, sequence, state and class diagrams), Three.js scenes and 3D models from `.glb` files (e.g. exported from Blender). PlantUML diagrams (e.g. ER models) through a local tool, and per-presentation specifications (`vorgaben/`) that tell Claude how things are to be drawn.
- **Any library when needed** – for maps, graphs and the like, Claude installs an npm package into the presentation
  itself; packages without a free licence are marked in the presenter.
- **Designs** – each presentation carries its look (colours, font, background, shapes) in `src/design.json`. Four
  designs are shipped (night, light, paper, contrast); choose one when creating, switch it in the side panel, refine it
  with a task (“background a little lighter”, “the colours of our university”) and save the result as your own design.
- **Create a presentation** – give a folder and a prompt; Claude Code writes the scenes, texts and stops from a template.
- **Reorder and remove slides** – drag slides into a new order in the slide list, click to jump to one, remove a
  slide with 🗑 and restore it later.
- **Edit texts and timing** – captions, titles, lists, durations and stops are edited live in the side panel.
- **Export to PDF** – one page per stop, exactly as the presenter pauses there (button „⤓ PDF“ or `npm run pdf`);
  handy as a handout.
- **Render to video** – `npm run render` produces an MP4 of the chosen presentation.
- **German or English** – switch the interface between DE and EN in the top bar; Claude answers in that
  language, and new presentations start from the matching template and prompt.

Presenter and content are separate: each presentation lives in its own folder and is selected in the app.

## Quick start

Requirements: Node.js 20+, Google Chrome (for PDF, video and the preview), `ffmpeg` for video, and the [Claude Code](https://claude.com/claude-code) CLI (`claude`) signed in, for
asking with Claude, rebuilding and creating. For the alternative LLM, copy `.env.example` to `.env` and fill it in.

```bash
git clone https://github.com/hgrabows/ShowPoint.git
cd ShowPoint
npm install
npm run edit
```

The presenter opens in your browser at <http://localhost:5173>; choose or create a presentation at the top right. A starting skeleton lives in
[`vorlage/`](vorlage/) (English texts in [`vorlage/en/`](vorlage/en/)). See [GUIDE.md](GUIDE.md) for details.

## License

ShowPoint is licensed under the MIT License with the [Commons Clause](https://commonsclause.com/) condition – see
[LICENSE](LICENSE). In short: you may use, change and pass on ShowPoint freely, also at work and in teaching, but you
may not sell it – that is, offer a product or service for a fee whose value comes mainly from ShowPoint itself
(including paid hosting or support). Because of this condition ShowPoint is source-available, not open source in
the strict sense. Presentations you create with ShowPoint are yours.

ShowPoint has its own small animation runtime (`runtime/`); its dependencies (React, Vite, Playwright, KaTeX, Mermaid,
Three.js, pdf-lib) are all under permissive licenses. PlantUML is not part of ShowPoint: `npm run plantuml` downloads
it separately, under its own licence.
