# ShowPoint – Guide

*Deutsche Fassung: [ANLEITUNG.md](ANLEITUNG.md)*

The presenter is a small Vite editor (`editor/`) that plays a presentation of animated React scenes in the browser, pauses at
stops and advances with the space bar, an arrow key or a click. This folder contains **only the presenter**. Each
presentation lives in its own folder anywhere on disk and is chosen in the presenter under "Presentation".

All paths such as `src/…` and `quellen/…` in this guide refer to the **presentation's folder**, not to this folder.

## Getting started

Requirements: Node.js (20 or later) and – for "Ask about slide", "Rebuild slide" and "New presentation" – an AI:
the Claude Code CLI (`claude`, signed in with your subscription), the Codex CLI (`codex`, signed in with your
ChatGPT account via `codex login`) **or** Google's Antigravity CLI (`agy`), all without an API key; or your own provider with URL and key (see "Choosing
the AI"). Settings such as model and effort go into the optional file `.env` (see "The settings file `.env`" there).

```bash
git clone https://github.com/hgrabows/ShowPoint.git
```

```bash
cd ShowPoint
```

```bash
npm install
```

```bash
npm run edit
```

**Updating:** in the ShowPoint folder run `git pull` and then `npm install` again. New versions can bring new
packages (for example for the PowerPoint export); without `npm install` they are missing and the start or export fails.

The presenter then opens by itself in the default browser at <http://localhost:5173> (without browser:
`BROWSER=none npm run edit`). The port is fixed; if another editor is already running there, startup aborts –
stop the other one first. If no presentation has been chosen yet, the page only shows the selection.

Keys: space / → / Enter / click = next · ← = back · `S` = stop on/off · `F` = fullscreen · `?` = ask the AI ·
`U` = rebuild slide · `P` = draw.

**Drawing on the slide:** `P` turns the pen on. Then you draw freely on the slide with mouse, trackpad, graphics
tablet or finger, also in fullscreen; a stroke does not advance. `1`–`4` choose the colour (red, yellow, green, blue),
`Z` undoes the last stroke, `C` clears everything, `P` or `Esc` puts the pen away (in fullscreen `Esc` also leaves
fullscreen). Advancing works as usual with the pen on. The drawing is not saved: it disappears when you move to the
next slide and when you put the pen away.

**Reordering slides:** at the top right under “Slides” all slides are listed in order. Drag a row to move the slide
(a yellow line shows where it will land); click a row to jump to it. The new order is saved right away in
`content.json` (`order`); the slides themselves are not changed.

**Removing slides:** 🗑 at the right of a row (shown on hover). The slide disappears from the presentation, but its
texts and code are kept: below the list, “Removed slides (n)” offers “↩ restore”, which puts it back at its old
position. To delete a slide for good (including its code), use “Rebuild slide”.
In `content.json`, removed slides stay in `scenes` but not in `order`; `removed` remembers their position.

## Choosing the AI: Claude Code, OpenAI Codex, Gemini or Custom

Who answers questions, rebuilds slides and creates new presentations is set once: in the presenter at the top left
under **"AI"**, or in `.env` with `KI=`. The choice applies to everything until you change it.

Right below you choose the **model** and the **reasoning effort** – separately for "Ask about slide" and for "Rebuild
slide"/"New presentation". The presenter asks the program itself for the model list (`codex debug models`,
`agy models`; for Claude Code the families Opus, Sonnet, Haiku), so it matches your account and version. "Default"
lets the program decide. More effort is more thorough, but slower and uses more of your quota – for asking "low" is
usually enough, for rebuilding "medium" to "high". The choice is stored in `.env` (keys in the table) and applies from
the next question. ShowPoint does not use the settings of the Codex CLI itself (`/model`, `~/.codex/config.toml`).
With Custom the model is fixed in `.env`.

| `KI=` | What runs | Access | Model and effort in `.env` |
|---|---|---|---|
| `claude` | Claude Code CLI (`claude`) | your Claude subscription, no key | `CLAUDE_MODEL`, `CLAUDE_EFFORT_FRAGEN`, `CLAUDE_EFFORT_UMBAU` |
| `codex` | Codex CLI (`codex`) | your ChatGPT account (`codex login`), no key | `CODEX_MODEL`, `CODEX_EFFORT_FRAGEN`, `CODEX_EFFORT_UMBAU` |
| `gemini` | Google's Antigravity CLI (`agy`) | your Google account (start `agy` once and sign in; the sign-in of the Antigravity app is shared) | `GEMINI_MODEL`, `GEMINI_EFFORT_FRAGEN`, `GEMINI_EFFORT_UMBAU` |
| `custom` | Codex CLI, pointed at your own provider | `LLM_BASE_URL` and `LLM_API_KEY` | `LLM_MODEL`, `LLM_REASONING_EFFORT` |

Empty = automatic: Claude Code, or Codex if only that is installed. So you need only one of the programs.

**The settings file `.env`.** It lies in the ShowPoint folder and holds your own settings: which AI, model and effort,
the Custom provider and the chosen presentation. It is optional – without it everything runs with the defaults, and
the presenter creates it by itself as soon as you choose an AI or a presentation (then only with `KI=` and `INHALT=`).
Model and effort are easiest chosen in the presenter (see above). For Custom, copy the template once before the
first start and fill it in:

```bash
cp .env.example .env
```

If `.env` already exists, add the lines you need from `.env.example` instead – copying over it would reset your
choices. Changes apply from the next question or task, without a restart. `.env` is in `.gitignore` and stays on your computer.

- **Custom** needs the Codex CLI as the tool and a provider that offers OpenAI's "Responses"
  interface – Codex speaks no other. Questions about a slide go straight to the provider (chat interface) with Custom,
  without web search.
- **Permissions:** Claude Code only gets single tools (read, write in `src/`, preview). Codex works through a shell;
  there its sandbox sets the limits: write only in the presentation's `src/` (for "New presentation" in the new folder),
  read only ShowPoint, the presentation and the sources named in the task, `.env` blocked, no network for commands.
  The system's temporary folders stay writable. Your own Codex configuration (`~/.codex/config.toml`) is not used.
- **Gemini (`agy`)** works with its own permission rules and a terminal sandbox: write only in the presentation's
  `src/` (for "New presentation" in the new folder), read only ShowPoint, the presentation and the sources, `.env`
  blocked, web pages only from the addresses named in the task. One peculiarity: a refused access ends the whole run
  there without a result – the reason is then in the log, and you start the task again. For the run ShowPoint briefly
  creates `src/.agents/mcp_config.json` and removes it again. `agy models` shows which models your account offers.
  Installation: <https://antigravity.google/docs/getting-started?tab=cli>.
- **Links in a task:** Claude may read exactly the addresses named. With Codex the web tool cannot be limited to
  addresses; it is only on when the task contains links. Custom has no web tool.
- **PDF sources** are read directly by Claude; Codex only has the shell for them and copes less well with PDFs – text or
  Markdown files are the better source there.

## Language (German / English)

- The user interface can be switched between **DE** and **EN** in the top bar. The default is the browser's language;
  the browser remembers your choice.
- Claude answers (questions, rebuilding, creating) in the chosen language.
- A new presentation created from the English interface starts from the English template (`vorlage/` with the
  English files from `vorlage/en/` laid over it) and the prompt from `prompt.en.txt`.
- The texts on the slides follow the language of the request (e.g. "Language: English" in the prompt).

## Presenter and content are separate

**Content** is a separate folder with three parts:

- `src/` – the slides and texts.
- `quellen/` ("sources") – **what** is said: material on the topic (notes, articles, PDFs). "Ask about the slide"
  answers from it, and when creating and rebuilding the AI looks up facts and numbers there.
- `vorgaben/` ("specifications") – **how** things are drawn: rules for the look, e.g. your own ER notation for
  PlantUML. The AI follows them in every rebuild (see "Specifications for how things are drawn").

Both folders belong to the presentation and come along when you copy it or pass it on.

**Presenter** is this folder: `editor/`, `vite.config.mts`, `scripts/`, `.env`, `node_modules`. Nothing
topic-specific lives here.

The content only has to satisfy this interface (types in `editor/types.ts`):

| File in the content folder | Required | Purpose |
|---|---|---|
| `src/Video.tsx` | yes | exports `Video`, a React component with the prop `{content}` |
| `src/content.json` | yes | `title` (name of the presentation), `order`, `scenes` – per scene `name` (short name for the bar), `dur`, `stops`, `t`, `lists`, optionally `kicker`, `title`, `captions` |
| `src/design.json` | no | design: colours, font, background, shapes (see "Design"); without the file the dark standard look applies |
| `src/begleittext.md` (accompanying notes) | no | topic, audience, tone for the `?` key |
| `src/umbau-regeln.md` (rebuild rules) | no | specifics of these slides for "Rebuild slide" |
| `vorgaben/*.md, *.txt` | no | specifications for how things are drawn (e.g. ER diagrams) – apply to every rebuild |
| `quellen/*.md, *.txt, *.pdf` | no | sent to the model as text when asking questions |

Which presentation is shown is chosen in the presenter at the top right under "Presentation":

- The list shows all mounted presentations (entries under `inhalte/`, i.e. "contents").
- "Choose another folder …" opens the macOS folder dialog, "Type a path …" takes a path. The folder may be
  anywhere; it must contain `src/Video.tsx` and `src/content.json`.
- A chosen folder is mounted as a link under `inhalte/<name>` (nothing is copied) so that it finds the
  project's installed packages. Its files stay where they are. You remove it from the list with the
  "Remove from list" button (this only deletes the link). `inhalte/` is in `.gitignore`.
- The choice is stored as `INHALT` ("content") in `.env` and survives a restart. Questions, sources, saving and
  "Rebuild slide" always refer to the chosen presentation.

## How the parts fit together

| File | Purpose |
|---|---|
| `src/content.json` | Order of the scenes, duration, stops and all texts. The editor reads and writes this file. |
| `src/Video.tsx` | Table `REG`: maps each scene ID from `content.json` to a React component and puts them in sequence. |
| `src/scenesA.tsx`, `scenesB.tsx`, `scenesC.tsx` | The scenes themselves. |
| `src/ui.tsx` | Building blocks for scenes (`Scene`, `Appear`, `Box`, `Arrow`, colors `C` …) and the types `SceneContent`, `SceneProps`. It reads colours and font from `src/design.json`. |
| `src/design.json` | The design of the presentation: colours, font, background, shapes. Chosen and switched in the presenter, refined with a task. |
| `runtime/` | Runtime: the building blocks scenes import from `'showpoint'` (see below) and the player. |
| `render/`, `scripts/stills.mjs` | Renderer: opens the presentation in a hidden Chrome and takes pictures of single frames. |
| `scripts/render.mjs`, `scripts/pdf.mjs`, `scripts/vorschau*.mjs` | Presenter: renders the chosen presentation as video or PDF and makes the preview images for Claude. |
| `editor/main.tsx` | The presenter's user interface. The display names of the scenes come from `content.json` (`name`). |
| `vite.config.mts` | Server: `/api/content` (read/save), `/api/ask` (the `?` key), `/api/rebuild` (rebuild slide), `/api/create` (new presentation); credentials from `.env`. |
| `prompt.txt`, `prompt.en.txt`, `vorlage/` | Prompt template (German/English) and skeleton (building blocks, example scene) for a new presentation; `vorlage/` means "template", `vorlage/en/` holds the English versions of its texts. |

## Route A: bring in new scenes (recommended)

This way newly generated scenes fit into the presenter completely, with editable texts and stops.

### 1. Put the scene file into `src/`

Every scene is a component with this signature:

```tsx
import React from 'react';
import {Appear, Scene, SceneProps} from './ui';

export const Einstieg: React.FC<SceneProps> = ({dur, c}) => (
  <Scene dur={dur} kicker={c.kicker} title={c.title} captions={c.captions}>
    <Appear at={20}>
      <div style={{fontSize: 60}}>{c.t.t01}</div>
    </Appear>
  </Scene>
);
```

Rules:

- `useCurrentFrame()` counts from 0 in every scene (the scenes run in a `Series`).
- Do not hard-code texts in the component; read them from `c.t.<key>` or `c.lists.<key>` –
  only then do they appear in the editor's side panel and can be changed.
- The format is 1920 × 1080 at 30 frames per second.
- `Scene` from `ui.tsx` provides the background, heading and captions; for a custom layout you can use `AbsoluteFill` instead.

### 2. Register it in `src/Video.tsx`

```tsx
import {Einstieg} from './meineSzenen';

const REG: Record<string, React.FC<SceneProps>> = {
  einstieg: Einstieg,
  // … more scenes
};
```

Only what is listed in `content.json` under `order` is shown.
But every ID in `order` must be in `REG`, otherwise the picture stays blank or there is an error.

### 3. Add it to `src/content.json`

```json
{
  "title": "My topic",
  "order": ["einstieg"],
  "scenes": {
    "einstieg": {
      "name": "Intro",
      "dur": 300,
      "kicker": "Kicker",
      "title": "Heading of the scene",
      "captions": [{"at": 10, "text": "Caption from frame 10"}],
      "stops": [150],
      "t": {"t01": "Text in the picture"},
      "lists": {}
    }
  }
}
```

- `dur`: length of the scene in frames (30 = 1 second).
- `stops`: stops as frame numbers within the scene. Can be empty (`[]`) and set later in the editor with `S`.
- `t` and `lists` must be present, empty if need be (`{}`); `stops` must be a list. If one of them is missing, the editor crashes.
- `kicker`, `title`, `captions` are optional; so is `name` (without it the bar shows the ID).

The editor overwrites `content.json` when you edit; version control in the presentation's folder is therefore a good idea.

### 4. Small adjustments

- `?` key: topic, audience and tone are in `src/begleittext.md`, the reference material in the `quellen/` folder. Switch both to the new topic, otherwise the model answers with the wrong background. The answer comes from the AI chosen in the presenter under "AI"; model and reasoning effort are in `.env` (template: `.env.example`, see "Choosing the AI").
  With "Claude Code" the model may **search the internet and read web pages** when answering (WebSearch, WebFetch) – e.g. for current facts – and then names the pages it used; the dialog shows what it searches for (🔎) and reads (🌐). It cannot read files or run commands. With Custom the answer comes straight from the provider, without internet access.
  Who answers is the AI chosen in the presenter (see "Choosing the AI"); the question window has no choice of its own. Claude Code, Codex and Gemini may search the internet for a question but get no shell and no access to files.
- "Rebuild slide": describe the specifics of the slides (building blocks, dimensions, facts) in `src/umbau-regeln.md`.

## Route B: bring in a finished third-party animation unchanged

If you already have a finished animation (a component with a fixed length that derives its motion from `useCurrentFrame()`), it can run as a single scene:

```tsx
// src/Video.tsx
import {MeinFilm} from './MeinFilm';

const REG: Record<string, React.FC<SceneProps>> = {
  film: () => <MeinFilm />,
};
```

```json
{
  "order": ["film"],
  "scenes": {"film": {"dur": 1800, "stops": [], "t": {}, "lists": {}}}
}
```

`dur` is the length of the animation in frames. Set stops afterwards in the editor with `S`.
Limitations: texts cannot be edited in the editor this way, and the animation must be built for 1920 × 1080 at 30 frames per second.
For a different format, width, height and `fps` must be changed identically in two places: in the `<Player>` in `editor/main.tsx` and in `render/main.tsx`.

## Timeline

The timeline under the picture has two parts. **Left** are all slides of the presentation (three quarters of the width; name on hover). Widths follow the slide durations, but every slide gets at least room for its number – about 50 slides fit on a normal screen. Only when even that is not enough, the numbers appear like on a ruler, at every 2nd, 5th, 10th … slide and at the current one.
**Right** (one quarter) are the sections of the current slide – with stops (yellow), jump hatching and the
playhead. A click into either bar goes to that position. This keeps room for the stops even with many slides.

## Skipping sections ("Jump")

A section is the stretch between two stops of a slide; the line under the picture names it ("Section 2/6"). Under
"Timing" on the right all sections of the slide are listed with frame range and caption; a click goes to its start.
With the **Jump** checkbox (or key `J`) a section is not played when advancing: at the stop before it, the next click
shows the end of the section at once. In the timeline it is hatched. The animation itself is unchanged; PDF and video
show it as always. `J` applies to the section at the current position – at a stop, to the one that comes next. It is
stored in `content.json` as `skip` of the scene (first frames of the skipped sections).

## Runtime building blocks

Scenes import their building blocks from `'showpoint'` (source in `runtime/index.tsx`):

| Building block | Purpose |
|---|---|
| `useCurrentFrame()` | current frame, counted from the start of the scene or the enclosing `Sequence` |
| `useVideoConfig()` | `{fps, width, height, durationInFrames}` – 30, 1920, 1080 and the total length |
| `interpolate(x, [a, b], [from, to], {extrapolateLeft, extrapolateRight, easing})` | turns a frame into a value (position, opacity …); `'clamp'` holds the end values |
| `spring({frame, fps, config: {damping, stiffness, mass}})` | spring motion from 0 to 1; `damping: 200` = smooth without overshoot |
| `Easing.inOut(Easing.cubic)`, `Easing.bezier(…)` … | easing curves for `interpolate` |
| `random('key')` | random number that is always the same for the same key |
| `AbsoluteFill` | `div` that fills its frame completely |
| `Sequence from={…} durationInFrames={…}`, `Series` | shows content only within a time window; inside, frames count from 0 again |
| `Img` | image; the renderer waits until it has loaded |
| `BarChart`, `LineChart`, `PieChart` | charts that build up from frame `at` (details below) |
| `Formula` | formula from LaTeX text (KaTeX), fading in from `at`: `<Formula tex={c.t.f1} x={90} y={250} at={20} fontSize={56} />`; steps of a calculation one after the other with `steps={c.lists.steps}` (spacing `every`, default 45 frames); also `w`, `align`, `color`, `display={false}` for inline style. In `content.json` double the backslashes: `"\\frac{a}{b}"` |
| `ThreeCanvas x y w h setup={…} update={(ctx, frame, fps) => …}`, `THREE` | 3D scene with Three.js: `setup` builds scene, lights and camera once, `update` sets everything from the frame number alone. Example: `vorlage/beispiele/three-beispiel.tsx`. Text drawn in 3D cannot be selected, so put labels next to it as normal text |
| `Model3D src={haus} x y w h at angle tilt spin zoom update={…}` | 3D model from a `.glb` file (`import haus from './modelle/haus.glb'`): centred, scaled to fit and lit; `spin` = degrees per second from the frame, animations stored in the file play from frame `at`. With `update`, show or hide single parts by name or control the view. Example: `vorlage/beispiele/modell-beispiel.tsx` |
| `loadFont('Name', file, {weight, style})` | registers a font file from `src/schriften/` (at the top of `ui.tsx`, not inside a component); then usable as `fontFamily`. With a `design.json`, `ui.tsx` does this by itself for the files under `font.files` |
| `DesignProvider`, `useDesign()`, `mix(a, b, t)` | the design of the presentation for the building blocks: `Video.tsx` wraps the slides in `<DesignProvider design={design}>`; `useDesign()` returns it, `mix` mixes two colours. Without a `DesignProvider` the dark standard look applies |
| `Mermaid code={…} x y w h` | flowcharts, sequence, state and class diagrams from Mermaid text, fitted into the box and coloured like the slides. Appearing: as a whole from `at`, step by step with `every={30}` (nodes in the order of their first mention, each edge with the later of its two nodes; in sequence diagrams the participants first, then messages and notes from top to bottom) or under your own control with `reveal={number of visible steps}` or `progress={0..1}`. Also `fontSize` (default 20), `maxScale`, `themeVariables`. Mermaid is only loaded when a slide uses it. Syntax errors show as a red box. Example: `vorlage/beispiele/mermaid-beispiel.tsx` |
| `waitFor('name')` | for your own building blocks that draw asynchronously: `const done = waitFor('name')` before starting, `done()` once the result is in the DOM. Preview, PDF and video wait for it (at most 30 s, then an error naming it) |

**Charts.** Numbers and labels are best kept in `content.json` under `lists` (values as text, e.g. `"3.5"` or
`"40 %"`), so they stay editable in the presenter:

```tsx
<BarChart x={90} y={200} w={900} h={650} labels={c.lists.labels} values={c.lists.values} unit=" ms" at={20} />
<BarChart … horizontal highlight={2} />          {/* horizontal bars, third one emphasised */}
<LineChart x={…} y={…} w={…} h={…} labels={c.lists.years}
  series={[{name: c.t.t01, values: c.lists.a}, {name: c.t.t02, values: c.lists.b}]} at={20} />
<PieChart x={…} y={…} w={…} h={…} labels={c.lists.labels} values={c.lists.values} center="128 GB" />
```

More props: `color`/`colors`, `max`, `stagger` (bars), `area`, `showValues`, `dur` (line, pie), `donut={false}` (pie),
`decimals`, `fontSize`, `decimalComma` (German-style 3,5; switched on automatically if the data uses commas).

## More packages (maps, graphs …)

If the building blocks are not enough, Claude may install an npm package itself while rebuilding or creating (tool
"paket", shown in the log as "Install package"). Name a package in the task ("use d3-geo") or let Claude choose
("show a map of Europe"). By hand:

```bash
node scripts/paket.mjs <presentation folder> d3-geo
```

- The package goes into the presentation itself (`package.json`, `node_modules/` – listed in its `.gitignore`),
  not into the presenter. After copying it to another computer, run `npm install` in the presentation folder there.
- Exact version, no install scripts, at most 100 MB; missing TypeScript types come from `@types`. React comes with
  the presenter.
- **Licences:** packages without a free open-source licence are installed but marked: a yellow notice in the
  presenter and in the log, an overview in `PAKETE.md` in the presentation folder. Fine for your own use; before
  passing it on (also as PDF or video) or using it commercially, check the licence. With `PAKETE_NUR_FREI=1` in
  `.env` only free licences (MIT, ISC, BSD, Apache-2.0 …) are accepted.
- **Time:** every frame must follow from `useCurrentFrame()` alone. Switch off the library's own animations, timers
  and transitions (e.g. `animation: false`, run a simulation to the end up front), otherwise jumping, stops, PDF and
  video will not match.
- **Maps:** best as SVG with `d3-geo` and offline data (`world-atlas`, `topojson-client`) – sharp in the PDF, no
  internet, labels as real text. Tile maps from the web (Leaflet, OpenStreetMap) need internet while rendering and
  the tile servers' terms of use.
- "Undo" after a rebuild only restores `src/`; installed packages stay (they do no harm).

## Output as video

```bash
npm run render
```

Renders the presentation chosen in the presenter to `out/<title>.mp4` **in its folder**
(e.g. `<presentation folder>/out/<title>.mp4`). Only a part: `npm run render -- --frames=0-90`.
Needs Google Chrome and `ffmpeg` (macOS: `brew install ffmpeg`). Frames are rendered in several tabs in parallel.

## Output as PDF

The "⤓ PDF" button in the presenter (side panel, bottom: fold out "Export"), or in the terminal:

```bash
npm run pdf
```

Creates `out/<title>.pdf` in the presentation's folder: **one page per stop**, exactly the picture at which the
presenter pauses there (with caption), plus the final picture. Good as a handout or for reading later; takes about
half a minute.

## Output as PowerPoint

The "⤓ PowerPoint" button in the presenter (side panel, bottom: fold out "Export"), or in the terminal:

```bash
npm run pptx
```

Creates `out/<title>.pptx` in the presentation's folder, **one slide per stop**. The slides are not screenshots but
rebuilt from single objects that can be moved and changed in PowerPoint:

| on the slide | in PowerPoint |
|---|---|
| title, labels, text in boxes | text boxes (size, colour, bold, capitals) |
| boxes | shapes with fill, frame and round corners |
| arrows and lines | lines with arrow heads |
| areas, curves, bars and lines of charts | shapes or freeform shapes |
| Mermaid diagrams, formulas, pictures, 3D | one transparent picture each |
| background (gradient) | slide background |
| caption | notes of the slide (with the scene's name) |

As the caption at the bottom is gone, everything below the heading moves to the middle of the free space; kicker and
title stay at the top. The shift is the same for all slides of a scene, so nothing jumps from slide to slide. The texts
of a card stacked one below the other (such as "Triceps / Agonist / contracts") become a single text box lying exactly
on the card; it keeps its place on every slide, even when the card holds two lines on one and three on the next.

**Animated slides (GIF).** Where the movement matters – an arm that bends, a signal that travels –, go to
that slide in the presenter, fold out **"Export"** at the bottom of the side panel and tick **"This slide animated
(GIF)"** below "⤓ PowerPoint" (stored as `pptxGif` in `content.json`). Below it all slides chosen this way are listed;
a click on a name jumps there.
Then the drawing below this slide's heading becomes animated GIFs: **one per stop**, playing the movement from the stop
before to this one once and then holding – like a click in the presenter. Kicker and title stay text boxes, the
caption is in the notes. **Cards** – boxes with text such as "Biceps / Agonist" or "Coordination", together with what
is drawn inside them – stay editable shapes and text boxes in the state of the stop; only the drawing (arm, brain,
nerve path with their labels) goes into the GIF. The GIF has no background of its own (transparent, edges smoothed against the slide
background), so it fits in without an edge. PowerPoint plays it in the slide show; in editing mode and in
a PDF only the first picture is seen. Without the tick the whole slide stays built from single objects that can be edited –
nothing inside a GIF can be changed. In the terminal it works without the tick too: `npm run pptx -- --gif agonist,nerven`
(the scene ids from `order`). A GIF takes a few hundred KB up to about 2 MB, and the export takes a little longer
(about a minute with 12 GIFs).

More options: `npm run pptx -- --scenes` makes only one slide per scene (its last stop), `npm run pptx -- --out <file>`
saves elsewhere. Takes a few seconds up to about a minute.

Limits: animations and transitions are not taken over – each slide shows the state at its stop. PowerPoint sets type
a little differently from the browser; text boxes are therefore a bit wider, a line may still break elsewhere.
Shadows and glows are missing. If the presentation's font is not on the computer, PowerPoint replaces it (the Mac's
system font is entered as "Helvetica Neue").

## Pitfalls

- Slides may only import `showpoint` and `react`; a separate `node_modules` in the presentation's folder is not needed.
- Older presentations that still import from `'remotion'` run unchanged: that name leads to the runtime here as well. `src/Root.tsx` and `src/index.ts` are no longer needed and may stay.
- PDF, video and preview need Google Chrome (or a Chromium loaded with `npx playwright install chromium`).
- The Vite configuration must be named `vite.config.mts`.
- `.env` contains the LLM key and is in `.gitignore`; do not share it.

## Request to Claude (to copy)

> In a new folder `<path>`, create a presentation on the topic … for the presenter in `<path to ShowPoint>`.
> First read its `GUIDE.md`; its folder `vorlage/` serves as the template (take over the building blocks in `src/ui.tsx`). Create the scenes as `React.FC<SceneProps>` in a new file under `src/`,
> use the building blocks from `src/ui.tsx`, read all texts from `c.t` / `c.lists`, register the scenes in `REG` in `src/Video.tsx`,
> write `src/content.json`
> with `title`, a `name` per scene and sensible stops, and adapt `src/begleittext.md` and `src/umbau-regeln.md`.

## Have the presenter create a new presentation

Button "＋ New presentation …" (top right under "Presentation"): give the folder of the new presentation
(new or empty, anywhere on disk) and fill in the prompt. The window is pre-filled with the template from
`prompt.txt` (in this folder, freely editable; `prompt.en.txt` in the English interface). The server copies the skeleton from `vorlage/` into the
folder, mounts it under `inhalte/` and starts Claude Code (model from `.env`, `CLAUDE_MODEL`; reasoning effort `CLAUDE_EFFORT_UMBAU`), which writes the slides,
`content.json`, `begleittext.md`, `umbau-regeln.md` and `quellen/00-notizen.md` (notes). The server then checks
`content.json` and the types; on type errors Claude fixes them up to two times. The job runs in the background
(often 10 to 20 minutes), the presentation currently shown stays usable; "Open presentation" switches to the new one.

- The prompt may refer to papers: file paths (`.pdf`, `.md`, `.txt`; in quotes if they contain spaces) and links.
  Claude may read exactly these files and fetch only the addresses (domains) of the links given (for GitHub also the raw files); it may write only in the new folder.
- **Papers for questions:** if the presenter should consult the papers during the talk (`?` key), they must
  additionally be placed in `quellen/` of the new presentation – creating does not copy them there.
- Claude checks the slides with the preview tool (see below) and fixes overlaps and the like itself.
  Still, click through once and touch up with "Rebuild slide" if needed.
- General rules for Claude: `createSystem` in `vite.config.mts`.

## Have the presenter rebuild slides

Button "✎ Rebuild slide" or key `U`: type the request, ⌘/Ctrl + Enter. For this the server starts Claude Code
(command `claude`, model from `.env`, `CLAUDE_MODEL`; reasoning effort `CLAUDE_EFFORT_UMBAU`: `low` … `max`, empty = default) in the project folder. It may read, and may change only files in the content folder's `src/`,
but may not run anything – except the preview tool. Beforehand `src/` is backed up to `.umbau/<timestamp>/` **inside the presentation** ("umbau" = rebuild), together with the task text (the last 10 are kept); "Undo"
restores the state before the last rebuild. Older states are listed in the presenter at the bottom right under **"Earlier states"**
(date, task, "Restore"); before restoring, the current state is saved itself, so you can go forward again.
The folder `.umbau` is added to the presentation's `.gitignore`. Afterwards the server checks `content.json` and the types
(`tsc --noEmit`) and shows the result in the dialog. While a rebuild is running, saving in the editor is locked.
The general rules for Claude are in `vite.config.mts` (`rebuildSystem`), the specifics of the content in `src/umbau-regeln.md`.

Claude may fetch links in the task – only pages of those addresses (domains), no free web search; for GitHub links
also the raw files. So you can say, for example: *"Draw the diagram following the rules at
https://github.com/…/SKILL.md"*. Claude uses what it reads there as a template for style and content; instructions on
the page that contradict the rules are ignored. Without a link in the task, a rebuild has no internet access.

## Adding images

Images (screenshots, photos, logos) can be added through a task – in “Rebuild slide” and in “New presentation”:

> Put the image "/Users/me/Desktop/Screenshot App 1.png" to the right of the diagram.

- The server detects image paths in the task (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`; starting with `/` or `~`)
  and copies the files into `src/bilder/` (images) of the presentation before starting. **Put paths with spaces in
  quotes.** Paths that cannot be found show up as errors in the log.
- Claude looks at the image, embeds it via `import` with `<Img>` from `'showpoint'` and checks its position with the preview.
  Labels stay real, editable text.
- The image is then part of the presentation: it shows in the presenter, the PDF and the video, and works on other
  computers too. “Undo” takes it out again.
- Claude cannot generate images itself; it draws graphics as SVG/HTML (sharp and animatable).

## Adding 3D models (`.glb`)

A 3D model – built in Blender, for example – is exported as `.glb` (Blender: File → Export → glTF 2.0, format "glTF
Binary (.glb)", without Draco compression) and added through a task: write the path of the file into the task, in
"Rebuild slide" or "New presentation". The server copies it to `src/modelle/` ("modelle" = models) and tells Claude the
names of the parts and animations in the file; Claude shows the model with the building block `Model3D`.

- The model stays real 3D: turn, tilt, zoom, show parts one after another – all from the frame number, so it matches
  stops, PDF and video. Sensibly named parts in Blender ("Roof", "GroundFloor") help with that.
- Blender is not needed for this, neither for presenting nor for rebuilding. The model is changed in Blender and
  exported again; name the new file in a task again.
- Only `.glb` (one file with everything in it). For a fixed, fully rendered picture add a PNG with a transparent
  background as an image instead.

## Design (the look of the slides)

The look of a presentation – colours, font, background, shapes – lives in a single file: `src/design.json`. Slides,
charts, Mermaid, PlantUML and the light of 3D models read from it. "Design" means the look only, not the layout of a
slide.

**Choosing.** In "New presentation …" click one of the preview pictures. Five designs are shipped (`vorlage/designs/`):

| Design | meant for |
|---|---|
| Nacht (Night) | dark stage – the look so far |
| Hell (Light) | light background, dark text |
| Papier (Paper) | warm paper white without a gradient, muted colours – for printed PDFs |
| Kontrast (Contrast) | white and black, strong colours, thick frames – for projectors in bright rooms |
| Bunt (Colourful) | violet-to-pink gradient, eight bright accent colours, round shapes – for product talks, advertising, school classes |

**Switching.** At the bottom right of the presenter there is a folded line "Design: <name>". Opened, it shows all
designs; a click switches. Only `src/design.json` is replaced, the state before is listed under "Earlier states", and
existing PlantUML diagrams (`src/diagramme/*.puml`) are drawn again. "adapted" after the name means: the design of
this presentation differs from every saved one.

**Refining.** There are no colour pickers in the presenter – refine with a task in "Rebuild slide", for example
"background a little lighter", "boxes less rounded" or "design in the colours of our university: https://…" (Claude
reads the link). Claude then changes only `src/design.json`, not the slides. A finished design file can be supplied
too: a line with "design" and the path of a `.json` file, e.g. `Design: ~/designs/university.json`.

**Your own designs.** "Save as own design …" stores the design of the presentation shown under a name in `designs/` in
the ShowPoint folder (not in git) – this is how a university design comes about: choose a shipped one, adapt it with
tasks, save it. Own designs then appear with a preview picture in both choosers next to the shipped ones; the ✕ on a
tile deletes one. If the design names a house font (`font.files`), its files travel from `src/schriften/` to
`designs/<name>/schriften/` and, when chosen, into the next presentation.

**Structure of `design.json`.** Whatever is missing is derived from the rest.

| Group | Content |
|---|---|
| `name`, `dark` | name in the presenter; `dark: true` = dark stage with light text |
| `surface` | `bg` (background as one colour – charts and diagrams treat it as the ground), `background` (CSS background of the slide, may be a gradient), `panel` (box), `panel2` (second box), `border` (frames, grid lines), `inset`, `stage` (behind the slides, visible while fading) |
| `text` | `normal`, `muted`, `heading`, `kicker` (line above the heading), `onAccent` (text on an accent colour) |
| `accent` | accent palette, about six to eight colours; chart series take them in this order |
| `status` | `good`, `bad`, `note` |
| `font` | `family` (CSS font stack), `weights` (`normal`, `strong`, `kicker`, `heading`), `files` (own font files in `src/schriften/`: `{"family", "file", "weight", "style"}`) |
| `shape` | `radius` (corner radius), `borderWidth` (frame width) |
| `caption` | caption box: `bg`, `border`, `text` |
| `diagram`, `model` | Mermaid/PlantUML (`node`, `nodeBorder`, `line`, `group`, `noteBg`, `noteBorder`, `errorBg`) and 3D light (`ground`, `fill`) |

**In the slides.** `src/ui.tsx` reads `design.json` and hands the values on as `C` (colours: `C.bg`, `C.panel`,
`C.text`, `C.muted`, `C.accent[0]` …, `C.good`, `C.bad`, `C.note`), `FONT`, `W` (font weights) and `SHAPE`;
`src/Video.tsx` passes the design to the runtime building blocks with `<DesignProvider design={design}>`. So a slide
contains no colour values and no font names; shades come from `mix(C.bg, C.accent[0], 0.2)`. The older names `C.doc`,
`C.mem`, `C.query`, `C.fire` remain as references into the accent palette.

**Older presentations** without `src/design.json` look as before (the dark look is the runtime's default). For them the
presenter shows "Design: fixed in the slides"; a design can be chosen once their slides read their colours from
`design.json`.

**Checking.** `node scripts/designs.mjs --check` computes the contrast (WCAG) of text against background and boxes for
every design; `node scripts/designs.mjs` renders the preview pictures again (sample slide in
`vorlage/designs/muster/`).

## Adding data and fonts

Like images and 3D models, data and fonts can be supplied with a task – write the path into the task, in "Rebuild
slide" or "New presentation":

- **Data** (`.csv`, `.tsv`, `.json`) → `src/daten/` ("daten" = data). Claude reads the file, copies the values it needs
  into `content.json` (where they stay editable in the presenter) and draws them with the chart building blocks. The
  file stays in the presentation as the source. Export Excel sheets as CSV first.
- **Fonts** (`.woff2`, `.woff`, `.ttf`, `.otf`) → `src/schriften/` ("schriften" = fonts). The font belongs to the
  design: Claude enters the files in `src/design.json` under `font.files` and puts the family first in `font.family`;
  `src/ui.tsx` registers them by itself. (In older presentations without a `design.json`: `loadFont('Name', file)` in
  `src/ui.tsx` and `FONT`.) PDF, video and the preview wait until the font is loaded. The font files live in the
  presentation and are passed on with it – the font's licence must allow that.

Which file types a task can bring along is listed in `vite.config.mts` in the table `TAKEN` (file type → folder).

## Specifications for how things are drawn (`vorgaben/`)

If something in a presentation should always be drawn in a certain way – for example ER diagrams in a fixed PlantUML
notation – put a description as a Markdown or text file into the presentation's `vorgaben/` folder ("vorgaben" =
specifications; next to `src/`). With "New presentation" and every "Rebuild slide" the chosen AI gets the list of these files
(file name, heading, first paragraph) and reads the matching one before it builds or changes such a thing. The
specifications are binding for the look; the technical rules (change only `src/`, everything computed from the frame)
still apply.

- **By hand:** copy the file into `vorgaben/` – it applies from the next rebuild. Delete or edit it the same way.
- **In a task:** a line with "specification" (also "spec", "template", "guideline", "Vorgabe", "Vorlage") and the path
  of a `.md` or `.txt` file, e.g. `Specification for ER diagrams: /Users/me/specs/plantuml_er.md`. The server copies
  the file into `vorgaben/` (same name replaces the old copy); the log says "Specification added". Without one of these
  words the path is only a source on the topic with "New presentation" (read, but not kept as a specification), and
  with "Rebuild slide" it is not made readable at all.
- The specifications belong to the presentation and are passed on with it. "Undo" does not remove them.
- Own styles for several presentations (e.g. your own ER notation): either add them with each task or copy an existing
  presentation as the starting point – `vorgaben/` comes along (so does `quellen/`, which you replace for a new topic).
- Which ones apply is shown in the presenter at the bottom right under "Libraries used · specifications".

## PlantUML diagrams

For diagrams that Mermaid or the building blocks cannot draw properly (e.g. ER diagrams), the AI can use PlantUML: it
writes the diagram text to `src/diagramme/<name>.puml` and calls the tool "plantuml"; that creates `<name>.svg` next
to it, already in the colours of the design (`src/design.json`; without that file in the dark standard scheme), and the
slide shows the SVG like an image. After a change of design the presenter draws the diagrams again.

- Set up once: `npm run plantuml` downloads PlantUML (fixed version, verified by checksum) into `.werkzeuge/`. On
  macOS (Apple Silicon), Linux and Windows this is a standalone program – **no Java needed**. Only on other systems
  (e.g. Intel Macs) the `.jar` is downloaded, which needs Java.
- Drawing happens locally, nothing goes to the internet; `!include` and URLs in the diagram text are blocked. PlantUML
  uses its built-in layout (no Graphviz needed, same result on every machine).
- The finished SVG lives in the presentation: **presenting, PDF and video work without PlantUML**. It is only needed
  to change or redraw a diagram; if it is missing then, Claude says so in its result.
- By hand: `node scripts/plantuml.mjs <presentation folder> <name>` (draw all again: `--all` instead of the name).
- The text in the diagram lives in the `.puml` file, not in `content.json` – change it with "Rebuild slide".

## Preview tool for Claude

When rebuilding and creating, Claude gets – besides "paket" and "plantuml" – the tool `vorschau` (preview): it checks `content.json`
and the types and returns the requested scenes at every stop as images (half size). Claude looks at the
images, fixes overlaps, cut-off or too-small texts and checks again. Each pass costs
a few seconds per scene.

- Technically it is a small MCP server (`scripts/vorschau-mcp.mjs`) that calls `scripts/vorschau.mjs`. The server
  determines the folder, Claude only chooses the scenes. Claude gets **no** Bash – with Bash, Claude Code would be allowed to
  run "harmless" read commands such as `ls` or `cat` on its own and could thereby e.g. bypass the lock on `.env`.
- Afterwards the images are in `.vorschau/` in the presentation's folder (listed in its `.gitignore`).
- By hand: `node scripts/vorschau.mjs <presentation folder> [scene ID …]`.
