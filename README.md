# ShowPoint

**Slides you can ask questions.** ShowPoint is an alternative to PowerPoint, NotebookLM-style study tools and
classic e-learning: presentations are animated [Remotion](https://www.remotion.dev) scenes that play in the browser,
pause at stops, answer questions about what is on screen – and can be rebuilt or created from scratch by Claude Code.

> Full guide: [GUIDE.md](GUIDE.md) (German version: [ANLEITUNG.md](ANLEITUNG.md)).

## What it does

- **Present** – animated slides with stops; advance with space, arrow keys or a click; fullscreen with `F`.
- **Ask about a slide** (`?`) – ask about what is currently shown, or mark text and ask about exactly that.
  Answers come from Claude Code or any OpenAI-compatible LLM and draw on the slide texts and your own sources
  (`quellen/`: Markdown, text, PDF).
- **Rebuild a slide** – describe the change in plain words; Claude Code edits the slide code, the type check runs,
  the presentation reloads. Every rebuild can be undone. A suggestion from “ask” can be handed over with one click.
- **Create a presentation** – give a folder and a prompt; Claude Code writes the scenes, texts and stops from a template.
- **Reorder slides** – drag slides into a new order in the slide list; click to jump to one.
- **Edit texts and timing** – captions, titles, lists, durations and stops are edited live in the side panel.
- **Export to PDF** – one page per stop, exactly as the presenter pauses there (button „⤓ PDF“ or `npm run pdf`);
  handy as a handout.
- **Render to video** – `npm run render` produces an MP4 of the chosen presentation.
- **German or English** – switch the interface between DE and EN in the top bar; Claude answers in that
  language, and new presentations start from the matching template and prompt.

Presenter and content are separate: each presentation lives in its own folder and is selected in the app.

## Quick start

Requirements: Node.js 20+, and the [Claude Code](https://claude.com/claude-code) CLI (`claude`) signed in, for
asking with Claude, rebuilding and creating. For the alternative LLM, copy `.env.example` to `.env` and fill it in.

```bash
git clone https://github.com/hgrabows/ShowPoint.git
cd ShowPoint
npm install
npm run edit
```

Open <http://localhost:5173>, then choose or create a presentation at the top right. A starting skeleton lives in
[`vorlage/`](vorlage/) (English texts in [`vorlage/en/`](vorlage/en/)). See [GUIDE.md](GUIDE.md) for details.

## License

No license has been chosen yet: the code is public to read, but all rights are reserved for now. If you would like
to use or adapt ShowPoint, please open an issue.

ShowPoint builds on [Remotion](https://www.remotion.dev), which has its own license: free for individuals,
non-profits and companies with up to three employees; larger companies need a
[Remotion company license](https://www.remotion.dev/license).
