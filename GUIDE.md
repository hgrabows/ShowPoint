# ShowPoint – Guide

*Deutsche Fassung: [ANLEITUNG.md](ANLEITUNG.md)*

The presenter is a small Vite editor (`editor/`) that plays a presentation of animated React scenes in the browser, pauses at
stops and advances with the space bar, an arrow key or a click. This folder contains **only the presenter**. Each
presentation lives in its own folder anywhere on disk and is chosen in the presenter under "Presentation".

All paths such as `src/…` and `quellen/…` in this guide refer to the **presentation's folder**, not to this folder.

## Getting started

Requirements: Node.js (20 or later) and – for "Ask about slide" with Claude, "Rebuild slide" and "New presentation" –
the Claude Code CLI (`claude`), signed in with your subscription. For the LLM from `.env`, copy `.env.example` to `.env`
and fill it in.

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

Then open <http://localhost:5173>. The port is fixed; if another editor is already running there, startup aborts –
stop the other one first. If no presentation has been chosen yet, the page only shows the selection.

Keys: space / → / Enter / click = next · ← = back · `S` = stop on/off · `F` = fullscreen · `?` = ask the LLM.

**Reordering slides:** at the top right under “Slides” all slides are listed in order. Drag a row to move the slide
(a yellow line shows where it will land); click a row to jump to it. The new order is saved right away in
`content.json` (`order`); the slides themselves are not changed.

**Removing slides:** 🗑 at the right of a row (shown on hover). The slide disappears from the presentation, but its
texts and code are kept: below the list, “Removed slides (n)” offers “↩ restore”, which puts it back at its old
position. To delete a slide for good (including its code), use “Rebuild slide”.
In `content.json`, removed slides stay in `scenes` but not in `order`; `removed` remembers their position.

## Language (German / English)

- The user interface can be switched between **DE** and **EN** in the top bar. The default is the browser's language;
  the browser remembers your choice.
- Claude answers (questions, rebuilding, creating) in the chosen language.
- A new presentation created from the English interface starts from the English template (`vorlage/` with the
  English files from `vorlage/en/` laid over it) and the prompt from `prompt.en.txt`.
- The texts on the slides follow the language of the request (e.g. "Language: English" in the prompt).

## Presenter and content are separate

**Content** is a separate folder with `src/` (slides and texts) and `quellen/` (sources: reference material for
questions). **Presenter** is this folder: `editor/`, `vite.config.mts`, `scripts/`, `.env`, `node_modules`. Nothing
topic-specific lives here.

The content only has to satisfy this interface (types in `editor/types.ts`):

| File in the content folder | Required | Purpose |
|---|---|---|
| `src/Video.tsx` | yes | exports `Video`, a React component with the prop `{content}` |
| `src/content.json` | yes | `title` (name of the presentation), `order`, `scenes` – per scene `name` (short name for the bar), `dur`, `stops`, `t`, `lists`, optionally `kicker`, `title`, `captions` |
| `src/begleittext.md` (accompanying notes) | no | topic, audience, tone for the `?` key |
| `src/umbau-regeln.md` (rebuild rules) | no | specifics of these slides for "Rebuild slide" |
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
| `src/ui.tsx` | Building blocks for scenes (`Scene`, `Appear`, `Box`, `Arrow`, colors `C` …) and the types `SceneContent`, `SceneProps`. |
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

- `?` key: topic, audience and tone are in `src/begleittext.md`, the reference material in the `quellen/` folder. Switch both to the new topic, otherwise the model answers with the wrong background. In the dialog you choose between "Claude Code" (command `claude`, model in `.env` as `CLAUDE_MODEL`, reasoning effort as `CLAUDE_EFFORT_FRAGEN`) and "LLM from .env". The credentials are in `.env` (template: `.env.example`).
  With "Claude Code" the model may **search the internet and read web pages** when answering (WebSearch, WebFetch) – e.g. for current facts – and then names the pages it used; the dialog shows what it searches for (🔎) and reads (🌐). It cannot read files or run commands. "LLM from .env" has no internet access.
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

The "⤓ PDF" button in the presenter, or in the terminal:

```bash
npm run pdf
```

Creates `out/<title>.pdf` in the presentation's folder: **one page per stop**, exactly the picture at which the
presenter pauses there (with caption), plus the final picture. Good as a handout or for reading later; takes about
half a minute.

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
  Claude may read exactly these files and fetch only the addresses (domains) of the links given; it may write only in the new folder.
- **Papers for questions:** if the presenter should consult the papers during the talk (`?` key), they must
  additionally be placed in `quellen/` of the new presentation – creating does not copy them there.
- Claude checks the slides with the preview tool (see below) and fixes overlaps and the like itself.
  Still, click through once and touch up with "Rebuild slide" if needed.
- General rules for Claude: `createSystem` in `vite.config.mts`.

## Have the presenter rebuild slides

Button "✎ Rebuild slide" or key `U`: type the request, ⌘/Ctrl + Enter. For this the server starts Claude Code
(command `claude`, model from `.env`, `CLAUDE_MODEL`; reasoning effort `CLAUDE_EFFORT_UMBAU`: `low` … `max`, empty = default) in the project folder. It may read, and may change only files in the content folder's `src/`,
but may not run anything – except the preview tool. Beforehand `src/` is backed up to `.umbau/<timestamp>/` ("umbau" = rebuild; the last 10 are kept); "Undo"
restores the state before the last rebuild. Afterwards the server checks `content.json` and the types
(`tsc --noEmit`) and shows the result in the dialog. While a rebuild is running, saving in the editor is locked.
The general rules for Claude are in `vite.config.mts` (`rebuildSystem`), the specifics of the content in `src/umbau-regeln.md`.

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

## Preview tool for Claude

When rebuilding and creating, Claude gets one single additional tool, `vorschau` (preview): it checks `content.json`
and the types and returns the requested scenes at every stop as images (half size). Claude looks at the
images, fixes overlaps, cut-off or too-small texts and checks again. Each pass costs
a few seconds per scene.

- Technically it is a small MCP server (`scripts/vorschau-mcp.mjs`) that calls `scripts/vorschau.mjs`. The server
  determines the folder, Claude only chooses the scenes. Claude gets **no** Bash – with Bash, Claude Code would be allowed to
  run "harmless" read commands such as `ls` or `cat` on its own and could thereby e.g. bypass the lock on `.env`.
- Afterwards the images are in `.vorschau/` in the presentation's folder (listed in its `.gitignore`).
- By hand: `node scripts/vorschau.mjs <presentation folder> [scene ID …]`.
