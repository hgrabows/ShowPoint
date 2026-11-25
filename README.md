# ShowPoint

**Slides you can ask questions.** ShowPoint is an alternative to PowerPoint, NotebookLM-style study tools and
classic e-learning: presentations are animated React scenes that play in the browser,
pause at stops, answer questions about what is on screen – and can be rebuilt or created from scratch by an AI agent (Claude Code, OpenAI Codex or Gemini).

> Full guide: [GUIDE.md](GUIDE.md) (German version: [ANLEITUNG.md](ANLEITUNG.md)).

## What it does

- **Present** – animated slides with stops; advance with space, arrow keys or a click; fullscreen with `F`; draw on the slide with `P`.
- **Ask about a slide** (`?`) – ask about what is currently shown, or mark text and ask about exactly that.
  Answers come from Claude Code, OpenAI Codex, Gemini via Google's Antigravity CLI (all through your account login, no API key) or your own provider (URL and key) and draw on the slide texts and your own sources
  (`quellen/`: Markdown, text, PDF).
- **Rebuild a slide** – describe the change in plain words; the AI edits the slide code, the type check runs,
  the presentation reloads. Every rebuild can be undone. A suggestion from “ask” can be handed over with one click.
- **Add images** – name an image file in a rebuild or create task; it is copied into the presentation and placed by the AI.
- **Charts, formulas, diagrams, 3D** – built-in building blocks for bar, line and pie charts, KaTeX formulas, Mermaid diagrams (flowcharts, sequence, state and class diagrams), Three.js scenes and 3D models from `.glb` files (e.g. exported from Blender). PlantUML diagrams (e.g. ER models) through a local tool, and per-presentation specifications (`vorgaben/`) that tell the AI how things are to be drawn.
- **Any library when needed** – for maps, graphs and the like, the AI installs an npm package into the presentation
  itself; packages without a free licence are marked in the presenter.
- **Designs** – each presentation carries its look (colours, font, background, shapes) in `src/design.json`. Four
  designs are shipped (night, light, paper, contrast); choose one when creating, switch it in the side panel, refine it
  with a task (“background a little lighter”, “the colours of our university”) and save the result as your own design.
- **Create a presentation** – give a folder and a prompt; the AI writes the scenes, texts and stops from a template.
- **Reorder and remove slides** – drag slides into a new order in the slide list, click to jump to one, remove a
  slide with 🗑 and restore it later.
- **Edit texts and timing** – captions, titles, lists, durations and stops are edited live in the side panel.
- **Export to PDF** – one page per stop, exactly as the presenter pauses there (button „⤓ PDF“ or `npm run pdf`);
  handy as a handout.
- **Render to video** – `npm run render` produces an MP4 of the chosen presentation.
- **German or English** – switch the interface between DE and EN in the top bar; the AI answers in that
  language, and new presentations start from the matching template and prompt.

Presenter and content are separate: each presentation lives in its own folder and is selected in the app.

## Quick start

Install these **before** the quick start – ShowPoint does not install them for you:

1. **Node.js 20+ with npm**, available in every new terminal: `node -v` and `npm -v` must both answer. With
   [nvm](https://github.com/nvm-sh/nvm) also run `nvm alias default 24` once, otherwise new terminals have no Node.
2. **At least one AI agent**, installed and signed in (no API key needed) – needed for asking, rebuilding and creating:

   | AI | install | sign in |
   |---|---|---|
   | [Claude Code](https://claude.com/claude-code) (`claude`) | `npm install -g @anthropic-ai/claude-code` | start `claude` once (Claude subscription) |
   | [OpenAI Codex](https://github.com/openai/codex) (`codex`) | `npm install -g @openai/codex` | `codex login` (ChatGPT account) |
   | Gemini via Google's Antigravity CLI (`agy`) | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | start `agy` once (Google account) |

   Check with `claude --version`, `codex --version` or `agy --version` in a **new** terminal. Alternatively use your own
   provider with URL and key (runs through the Codex CLI, so `codex` must be installed too).
3. **Google Chrome** (PDF, video and the preview) and **`ffmpeg`** (video only).

Choose the AI in the presenter under "AI", and right below it the model and the reasoning effort. Optional: for your own provider, run
`cp .env.example .env` in the ShowPoint folder before the first start and fill in `.env` – see
[GUIDE.md](GUIDE.md#choosing-the-ai-claude-code-openai-codex-gemini-or-custom). Without `.env` everything runs with the
defaults.

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
