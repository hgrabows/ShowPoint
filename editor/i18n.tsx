import React from 'react';

/**
 * UI language (German/English). The choice is remembered in the browser; without one, the browser language decides.
 * Switching reloads the page. Every /api request carries the language in the X-Lang header, so the server
 * answers (errors, job logs, Claude's replies) in the same language.
 */
export type Lang = 'de' | 'en';
const KEY = 'showpoint-lang';

export const lang: Lang = (() => {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch {
    // no storage – fall back to the browser language
  }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
})();

export const setLang = (l: Lang) => {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    // not remembered – applies to this page only
  }
  location.reload();
};

document.documentElement.lang = lang;

const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('/api') || url.startsWith(`${location.origin}/api`)) {
    const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set('X-Lang', lang);
    init = {...init, headers};
  }
  return nativeFetch(input, init);
};

const de = {
  // main.tsx
  noVideoExport: 'src/Video.tsx exportiert keine Komponente „Video“.',
  loaded: 'geladen',
  saving: 'speichert …',
  saved: 'gespeichert',
  saveError: 'Fehler beim Speichern',
  exportFailed: (what: string, e: string) => `${what}-Export fehlgeschlagen:\n${e}`,
  libsSummary: (n: number, specs: number) => `Benutzte Bibliotheken (${n})${specs ? ` · Vorgaben (${specs})` : ''}`,
  libsBuiltin: 'eingebaut',
  libsInstalled: 'nachinstalliert',
  versionsSummary: (n: number) => `Frühere Stände (${n})`,
  versionsWhen: (d: Date) => d.toLocaleString('de-DE', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}),
  versionsBefore: (scene: string, task: string) => `vor: ${task || 'einem Umbau'}${scene ? ` (${scene})` : ''}`,
  versionsRestore: 'Wiederherstellen',
  versionsConfirm: (when: string) => `Den Stand vom ${when} wiederherstellen?\n\nDer jetzige Stand wird vorher gesichert und erscheint danach ebenfalls in dieser Liste.`,
  versionsFailed: 'Wiederherstellen nicht möglich (läuft gerade ein Umbau?).',
  versionsHint: 'Vor jedem Umbau wird der Stand der Folien gesichert (Ordner .umbau der Präsentation, die letzten 10).',
  libsSpecs: 'Vorgaben',
  // Design.tsx
  designSummary: (name: string) => `Design: ${name}`,
  designName: (id: string, name: string) => name,
  designUnnamed: 'ohne Namen',
  designAdapted: 'angepasst',
  designFixed: 'fest in den Folien',
  designFixedHint: 'Diese Präsentation hat ihr Aussehen noch fest in den Folien (kein src/design.json). Ein Design lässt sich hier erst wählen, wenn sie umgestellt ist.',
  designTileTitle: (name: string, own: boolean) => `${own ? 'Eigenes Design' : 'Design'} „${name}“`,
  designChoose: 'Design (Aussehen der Folien; lässt sich später jederzeit wechseln)',
  designSave: 'Als eigenes Design speichern …',
  designSavePrompt: 'Name für das eigene Design (z. B. der Name der Hochschule).\nEs steht danach für jede Präsentation zur Auswahl.',
  designOverwrite: (name: string) => `Ein eigenes Design „${name}“ gibt es schon. Überschreiben?`,
  designRemove: 'Eigenes Design löschen',
  designRemoveConfirm: (name: string) => `Das eigene Design „${name}“ löschen?\n\nPräsentationen, die es benutzen, behalten ihr Aussehen.`,
  designReplaceAdapted: (name: string) => `Das jetzige Design ist angepasst und nirgends sonst gespeichert. Zu „${name}“ wechseln?\n\nDer jetzige Stand bleibt unter „Frühere Stände“ erhalten; dauerhaft sichern geht mit „Als eigenes Design speichern …“.`,
  designHint: 'Ein Wechsel tauscht nur src/design.json; der Stand davor steht unter „Frühere Stände“. Verfeinern per Auftrag mit „Folie umbauen“, z. B. „Hintergrund etwas heller“ oder „Design in den Farben unserer Hochschule: <Link>“.',
  libsSpecsHint: 'Vorgaben liegen im Ordner vorgaben/ der Präsentation und gelten für jeden Umbau.',
  libsHint: 'Eingebaute kommen mit dem Präsentator; nachinstallierte stehen in package.json und PAKETE.md der Präsentation (Lizenz: Maus darüber).',
  builtinName: {three: '3D (Three.js)', katex: 'Formeln (KaTeX)', mermaid: 'Ablaufdiagramme (Mermaid)', plantuml: 'Diagramme (PlantUML)', charts: 'Diagramme'} as Record<string, string>,
  licenseNote: (names: string) =>
    `⚠ Lizenz beachten: Diese Präsentation nutzt Pakete ohne freie Lizenz (${names}). Für die eigene Nutzung in Ordnung – vor dem Weitergeben (auch als PDF oder Video) oder einer kommerziellen Nutzung die Lizenz prüfen. Übersicht: PAKETE.md im Ordner der Präsentation.`,
  presentation: 'Präsentation',
  pathPrompt: 'Pfad zum Ordner der Präsentation (er enthält src/ mit Video.tsx und content.json):',
  pleaseChoose: '– bitte wählen –',
  pickFolder: 'Anderen Ordner wählen …',
  typePath: 'Pfad eintippen …',
  removeTitle: 'Nimmt diese Präsentation aus der Liste. Ihre Dateien bleiben unverändert an ihrem Ort.',
  removeConfirm: (title: string, path: string) =>
    `„${title}“ aus der Liste entfernen?\n\nDie Dateien in ${path} bleiben erhalten. Danach wird wieder der Projektordner gezeigt.`,
  removeFromList: 'Aus Liste entfernen',
  createTitle: 'Lässt die gewählte KI eine komplette Präsentation in einem neuen Ordner erzeugen',
  createRunning: '＋ Präsentation entsteht …',
  createNew: '＋ Neue Präsentation erzeugen …',
  language: 'Sprache',
  badgeLogTitle: 'Klick zeigt das Protokoll',
  badgeCreating: 'Neue Präsentation entsteht',
  badgeRebuilding: 'Umbau läuft',
  badgeDoneTitle: 'Klick zeigt das Ergebnis und öffnet die Präsentation',
  badgeDone: '✓ Neue Präsentation fertig',
  badgeView: 'ansehen',
  hide: 'Ausblenden',
  startLead: 'Folien, die man fragen kann: Präsentationen mit animierten Folien, die eine KI erstellt, umbaut und während des Vortrags zu Fragen erklärt.',
  startAiHead: 'KI wählen',
  startAiText: 'Sie beantwortet Fragen zu den Folien, baut Folien um und erzeugt neue Präsentationen. Sie muss auf diesem Rechner installiert und angemeldet sein.',
  startOpenHead: 'Präsentation öffnen oder erzeugen',
  startOpenText: 'Wähle eine deiner Präsentationen oder einen Ordner mit einer Präsentation …',
  startOpenEmpty: 'Noch keine Präsentation in der Liste. Wähle den Ordner einer vorhandenen Präsentation …',
  startOr: '… oder',
  loadFailed: (e: string) => `Die Präsentation ließ sich nicht laden: ${e}`,
  loading: 'Lädt …',
  createBusy: 'Gerade entsteht eine neue Präsentation. Ein Umbau geht erst, wenn sie fertig ist.',
  askAbout: '? Dazu fragen',
  back: '◀ Zurück',
  nextTitle: 'Läuft bis zum nächsten Haltepunkt; während es läuft: direkt dorthin springen',
  jump: 'Springen ▶▶',
  next: 'Weiter ▶',
  stopTitle: 'Haltepunkt an dieser Stelle einfügen oder entfernen (S)',
  stopRemove: '− Haltepunkt',
  stopAdd: '+ Haltepunkt',
  fullscreen: 'Vollbild',
  exportSummary: 'Export',
  exportRunning: 'Export läuft …',
  pdfShort: 'eine Seite je Haltepunkt',
  pptxShort: 'eine Folie je Haltepunkt, Texte bearbeitbar',
  exportWhere: 'Gespeichert unter out/ im Ordner der Präsentation.',
  pdfTitle: 'Eine PDF-Seite je Haltepunkt, so wie der Präsentator dort anhält. Gespeichert unter out/ im Ordner der Präsentation.',
  pptxTitle: 'PowerPoint-Datei: eine Folie je Haltepunkt, aus einzelnen Objekten nachgebaut – Texte als Textfelder, Kästen als Formen, Pfeile als Linien; Mermaid, Formeln, Bilder und 3D als einzelne Grafiken; der Untertitel in den Notizen. Gespeichert unter out/ im Ordner der Präsentation.',
  askSlide: '? Frage zur Folie',
  rebuildRunning: '✎ Umbau läuft …',
  rebuildSlide: '✎ Folie umbauen',
  info: (scene: number, scenes: number, part: number, parts: number, frame: number, dur: number, saved: string) =>
    `Szene ${scene}/${scenes} · Abschnitt ${part}/${parts} · Bild ${frame}/${dur} · ${saved}`,
  keys: (
    <>
      Weiter: <kbd>Leertaste</kbd> <kbd>→</kbd> <kbd>Enter</kbd> oder Klick ins Bild · Zurück: <kbd>←</kbd> · Haltepunkt ein/aus: <kbd>S</kbd> · Abschnitt überspringen ein/aus: <kbd>J</kbd> ·
      Vollbild: <kbd>F</kbd> · Frage an die KI: <kbd>?</kbd> (Text vorher markieren = gezielt dazu fragen) · Folie umbauen lassen: <kbd>U</kbd> · Zeichnen: <kbd>P</kbd> ·
      gelbe Striche = Haltepunkte · schraffiert = wird übersprungen · Klick in die Leiste springt dorthin
    </>
  ),
  liveEdit: 'Änderungen erscheinen sofort und werden automatisch gespeichert.',
  shortName: 'Kurzname in der Leiste',
  pptxGif: 'In PowerPoint animiert (GIF)',
  pptxGifHint: 'Beim PowerPoint-Export wird die Zeichnung unter der Überschrift dieser Folie zu animierten GIFs: je Haltepunkt eines, das die Bewegung vom vorigen Haltepunkt bis hierher einmal abspielt und dann stehen bleibt – wie ein Klick im Präsentator. Karten (Kästen mit Text) und Überschrift bleiben bearbeitbar, in der Zeichnung selbst lässt sich nichts ändern. Ohne Häkchen wird die ganze Folie aus einzelnen, bearbeitbaren Objekten aufgebaut.',
  heading: 'Überschrift',
  kicker: 'Dachzeile',
  title: 'Titel',
  captions: 'Untertitel (ab Bild · Text)',
  texts: 'Texte im Bild',
  listHead: (k: string) => `Liste „${k}“ (eine Zeile pro Eintrag)`,
  timing: 'Ablauf',
  durLabel: 'Dauer der Szene in Bildern (30 pro Sekunde)',
  stopsLabel: 'Haltepunkte (Bildnummern in dieser Szene, mit Komma getrennt)',
  sectionsLabel: 'Abschnitte (Klick springt hin; Sprung = beim Weiterschalten überspringen, Taste J)',
  sectionRowTitle: 'Zum Anfang dieses Abschnitts springen',
  sectionSeg: (k: number, n: number, a: number, b: number) => `Abschnitt ${k}/${n} · Bild ${a}–${b}`,
  skipLabel: 'Sprung',
  skipTitle: 'Sprung: Beim Weiterschalten wird dieser Abschnitt nicht abgespielt, sondern sofort sein Ende gezeigt (Taste J).',

  // Slides.tsx
  slides: 'Folien',
  slidesHint: 'ziehen = umsortieren · Klick = hinspringen',
  slideRowTitle: 'Ziehen, um die Folie zu verschieben · Klick springt zur Folie',
  slideRemoveTitle: 'Folie entfernen (lässt sich unten wiederherstellen)',
  slideRemoveConfirm: (name: string) =>
    `Folie „${name}“ aus der Präsentation entfernen?\n\nTexte und Code bleiben erhalten; unter „Entfernte Folien“ lässt sie sich wieder einfügen.`,
  slidesRemoved: (n: number) => `Entfernte Folien (${n})`,
  slideRestore: '↩ wieder einfügen',
  slideRestoreTitle: 'Fügt die Folie wieder an ihrer alten Stelle ein (sonst am Ende)',

  // float.tsx
  dragMove: 'Ziehen = verschieben · Doppelklick = zurücksetzen',
  dragSize: 'Ziehen = Größe ändern',

  // Ask.tsx
  quoted: (quote: string, q: string) => `(zur Stelle „${quote}“) ${q}`,
  explainQuote: 'Erkläre mir die markierte Stelle.',
  errorStatus: (s: number) => `Fehler ${s}`,
  noAnswer: 'Keine Antwort erhalten.',
  askHead: 'Frage zur Folie',
  whoAnswers: 'Wer antwortet',
  agentLabel: 'KI',
  agentTitle: 'Wer Fragen beantwortet, Folien umbaut und neue Präsentationen erzeugt. Claude Code, Codex und Gemini (Antigravity-CLI) laufen über ihr eigenes Programm und dein Konto, ohne API-Schlüssel. „Custom“ nutzt den Anbieter aus der .env (URL, Schlüssel, Modell). Modell und Effort stehen jeweils in der .env.',
  agentMissing: 'nicht installiert',
  agentCustomMissing: 'nicht eingerichtet',
  agentCustomHint: '„Custom“ braucht den Befehl codex sowie LLM_BASE_URL, LLM_API_KEY und LLM_MODEL in der .env. Der Anbieter muss die „Responses“-Schnittstelle von OpenAI anbieten.',
  agentMissingHint: (n: string) => `Der Befehl für ${n} wurde auf diesem Rechner nicht gefunden. Bitte installieren und anmelden oder die andere KI wählen.`,
  inkActive: 'Stift',
  inkKeys: '1–4 Farbe · Z zurück · C löschen · P Ende',
  modelLabel: 'Modell',
  modelDefault: (d: string) => (d ? `Standard (${d})` : 'Standard des Programms'),
  modelFromEnv: 'aus .env',
  modelsLoading: 'Modelle werden abgefragt …',
  modelsNone: 'Das Programm hat keine Modellliste geliefert – es nimmt seinen Standard.',
  modelCustom: (m: string) => `Modell: ${m || '–'} (in .env als LLM_MODEL)`,
  effortLabel: 'Denkaufwand',
  effortAsk: 'Fragen',
  effortBuild: 'Umbauen & Erzeugen',
  effortDefault: 'Standard',
  effortNames: {minimal: 'minimal', low: 'niedrig', medium: 'mittel', high: 'hoch', xhigh: 'sehr hoch', max: 'maximal'} as Record<string, string>,
  effortHint: 'Mehr Denkaufwand = gründlicher, aber langsamer und mehr Verbrauch deines Kontingents. Für Fragen reicht meist „niedrig“, für Umbauen und Erzeugen „mittel“ bis „hoch“.',
  claudeNotes: {opus: 'am fähigsten, langsamer', sonnet: 'ausgewogen', haiku: 'schnell, für einfache Aufgaben'} as Record<string, string>,
  settingFailed: (e: string) => `Nicht gespeichert: ${e}`,
  llmEnv: 'LLM aus .env',
  close: 'Schließen (Esc)',
  askIntro:
    'Stell eine Frage zu dem, was gerade zu sehen ist. Das Modell kennt die Texte dieser Folie und die Quellen im Ordner „quellen“. Du kannst Text in der Folie oder in einer Antwort markieren und dann gezielt dazu fragen. Claude Code, Codex und Gemini können auch im Internet suchen.',
  sources: 'Quellen: ',
  noSources: 'Keine Quellen im Ordner „quellen“.',
  kChars: (n: number) => `${n} Tsd. Zeichen`,
  thinking: 'denkt nach …',
  handoverTitle: 'Öffnet „Folie umbauen“ mit diesem Vorschlag als Auftrag – du kannst ihn vor dem Start noch ändern',
  handover: '→ Als Umbau-Auftrag übernehmen',
  handoverText: (question: string, answer: string) =>
    `Setze diesen Vorschlag aus „Frage zur Folie“ um.\n\nMeine Frage: ${question}\n\nVorschlag:\n${answer}`,
  dropQuote: 'Markierung verwerfen',
  askPlaceholderQuote: 'Frage zur Markierung (leer = erklären)',
  askPlaceholder: 'Frage eingeben (⇧↵ neue Zeile)',
  askInputTitle: 'Enter sendet · Shift+Enter fügt eine neue Zeile ein',
  askSend: 'Fragen',

  // Rebuild.tsx
  rebuildHead: 'Folie umbauen',
  rebuildClose: 'Schließen (Esc) – ein laufender Umbau läuft weiter',
  rebuildIntro:
    'Beschreibe, was an den Folien anders werden soll – Grafik, Aufbau oder Text. Die gewählte KI ändert die Dateien in src/, prüft das Ergebnis mit einer Vorschau, danach lädt die Präsentation neu. Vor jedem Umbau wird der Stand gesichert; „Rückgängig“ stellt ihn wieder her. Das dauert meist einige Minuten.',
  working: (s: number) => `arbeitet … ${s} s`,
  rebuildBusy: 'Umbau läuft …',
  rebuildPlaceholder: 'Auftrag eingeben, ⌘/Strg + Enter startet',
  rebuildStart: 'Umbauen',
  undo: 'Rückgängig',

  // Create.tsx
  templateFailed: 'Die Vorlage ließ sich nicht laden.',
  needFolder: 'Bitte den Ordner der neuen Präsentation angeben, z. B. …/Mein-Thema.',
  placeholdersLeft: 'Im Prompt stehen noch Platzhalter in spitzen Klammern (<…>). Trotzdem starten?',
  serverDown: 'Der Server ist nicht erreichbar.',
  createHead: 'Neue Präsentation erzeugen',
  createClose: 'Schließen (Esc) – ein laufender Auftrag läuft weiter',
  folder: (p: string) => `Ordner: ${p}`,
  createWorking: (min: number, s: number) =>
    `arbeitet … ${min} min ${s} s. Eine ganze Präsentation dauert oft 10 bis 20 Minuten. Das Fenster kann zu; der Auftrag läuft weiter, und die bisherige Präsentation bleibt benutzbar.`,
  doneWithNotes: 'Fertig, aber mit Meldungen (siehe oben). ',
  done: 'Fertig. ',
  doneCheck: 'Die KI hat die Folien mit der Vorschau geprüft – bitte trotzdem einmal durchklicken; Korrekturen gehen mit „Folie umbauen“.',
  copyPapers: 'Soll der Präsentator bei Fragen (Taste ?) in den Papers nachlesen, kopiere sie nach',
  running: 'läuft …',
  createAnother: 'Weitere erzeugen …',
  openPresentation: 'Präsentation öffnen',
  folderLabel: 'Ordner der neuen Präsentation (neu oder leer; darf irgendwo liegen)',
  folderPlaceholder: '/Pfad/zu/Mein-Thema',
  chooseFolder: 'Ordner wählen …',
  promptLabel: 'Prompt (Vorlage aus prompt.txt im Präsentator-Ordner)',
  papersNote1: 'Papers aus dem Prompt liest die KI nur beim Erzeugen.',
  papersNote3a: 'Soll der Präsentator auch',
  papersNote3b: 'während des Vortrags',
  papersNote3c: 'bei Fragen (Taste ?) darin nachlesen, kopiere die Papers zusätzlich nach',
  papersFolderFallback: '<Ordner der Präsentation>/quellen',
  papersNote4: 'Der Ordner wird beim Erzeugen angelegt; die KI legt dort nur eigene Notizen ab.',
  specsNote1: 'Eine Zeile',
  specsExample: 'Vorgabe: ~/specs/plantuml_er.md',
  specsNote2: 'übernimmt eine Darstellungsregel (z. B. die eigene Schreibweise für ER-Diagramme) dauerhaft nach',
  specsFolderFallback: '<Ordner der Präsentation>/vorgaben',
  createHint: '⌘/Strg + Enter startet · dauert oft 10 bis 20 Minuten',
  reloadTemplateTitle: 'Setzt den Prompt auf den Inhalt von prompt.txt zurück',
  reloadTemplate: 'Vorlage neu laden',
  jobRunning: 'Es läuft schon ein Auftrag',
  create: 'Erzeugen',
};

const en: typeof de = {
  noVideoExport: 'src/Video.tsx does not export a component called “Video”.',
  loaded: 'loaded',
  saving: 'saving …',
  saved: 'saved',
  saveError: 'Error while saving',
  exportFailed: (what, e) => `${what} export failed:\n${e}`,
  libsSummary: (n, specs) => `Libraries used (${n})${specs ? ` · specifications (${specs})` : ''}`,
  libsBuiltin: 'built in',
  designSummary: (name) => `Design: ${name}`,
  designName: (id, name) => ({nacht: 'Night', hell: 'Light', papier: 'Paper', kontrast: 'Contrast', bunt: 'Colourful'} as Record<string, string>)[id] ?? name,
  designUnnamed: 'unnamed',
  designAdapted: 'adapted',
  designFixed: 'fixed in the slides',
  designFixedHint: 'This presentation still has its look fixed in the slides (no src/design.json). A design can be chosen here once it has been converted.',
  designTileTitle: (name, own) => `${own ? 'Own design' : 'Design'} “${name}”`,
  designChoose: 'Design (the look of the slides; can be switched at any time later)',
  designSave: 'Save as own design …',
  designSavePrompt: 'Name for your own design (e.g. the name of your university).\nIt can then be chosen for every presentation.',
  designOverwrite: (name) => `An own design “${name}” already exists. Overwrite it?`,
  designRemove: 'Delete own design',
  designRemoveConfirm: (name) => `Delete the own design “${name}”?\n\nPresentations that use it keep their look.`,
  designReplaceAdapted: (name) => `The current design is adapted and not saved anywhere else. Switch to “${name}”?\n\nThe current state stays under “Earlier states”; to keep it for good use “Save as own design …”.`,
  designHint: 'Switching only replaces src/design.json; the state before is listed under “Earlier states”. Refine it with a task in “Rebuild slide”, e.g. “background a little lighter” or “design in the colours of our university: <link>”.',
  libsInstalled: 'installed',
  versionsSummary: (n) => `Earlier states (${n})`,
  versionsWhen: (d) => d.toLocaleString('en-GB', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}),
  versionsBefore: (scene, task) => `before: ${task || 'a rebuild'}${scene ? ` (${scene})` : ''}`,
  versionsRestore: 'Restore',
  versionsConfirm: (when) => `Restore the state of ${when}?\n\nThe current state is saved first and then appears in this list as well.`,
  versionsFailed: 'Cannot restore (is a rebuild running?).',
  versionsHint: 'Before every rebuild the state of the slides is saved (folder .umbau of the presentation, the last 10).',
  libsSpecs: 'specifications',
  libsSpecsHint: 'Specifications live in the presentation\'s vorgaben/ folder and apply to every rebuild.',
  libsHint: 'Built-in ones come with the presenter; installed ones are listed in the presentation\'s package.json and PAKETE.md (licence: hover).',
  builtinName: {three: '3D (Three.js)', katex: 'Formulas (KaTeX)', mermaid: 'Flow diagrams (Mermaid)', plantuml: 'Diagrams (PlantUML)', charts: 'Charts'},
  licenseNote: (names) =>
    `⚠ Mind the licence: this presentation uses packages without a free licence (${names}). Fine for your own use – before passing it on (also as PDF or video) or using it commercially, check the licence. Overview: PAKETE.md in the presentation folder.`,
  presentation: 'Presentation',
  pathPrompt: 'Path to the presentation folder (it contains src/ with Video.tsx and content.json):',
  pleaseChoose: '– please choose –',
  pickFolder: 'Choose another folder …',
  typePath: 'Type a path …',
  removeTitle: 'Removes this presentation from the list. Its files stay where they are, unchanged.',
  removeConfirm: (title, path) => `Remove “${title}” from the list?\n\nThe files in ${path} are kept. The project folder is shown afterwards.`,
  removeFromList: 'Remove from list',
  createTitle: 'Lets the chosen AI create a complete presentation in a new folder',
  createRunning: '＋ Presentation in progress …',
  createNew: '＋ New presentation …',
  language: 'Language',
  badgeLogTitle: 'Click to show the log',
  badgeCreating: 'Creating new presentation',
  badgeRebuilding: 'Rebuild running',
  badgeDoneTitle: 'Click to show the result and open the presentation',
  badgeDone: '✓ New presentation ready',
  badgeView: 'view',
  hide: 'Hide',
  startLead: 'Slides you can ask: presentations with animated slides that an AI creates, rebuilds and explains when asked during the talk.',
  startAiHead: 'Choose the AI',
  startAiText: 'It answers questions about the slides, rebuilds slides and creates new presentations. It must be installed and signed in on this computer.',
  startOpenHead: 'Open or create a presentation',
  startOpenText: 'Choose one of your presentations or a folder with a presentation …',
  startOpenEmpty: 'No presentation in the list yet. Choose the folder of an existing presentation …',
  startOr: '… or',
  loadFailed: (e) => `The presentation could not be loaded: ${e}`,
  loading: 'Loading …',
  createBusy: 'A new presentation is being created right now. Rebuilding is possible once it is finished.',
  askAbout: '? Ask about this',
  back: '◀ Back',
  nextTitle: 'Plays to the next stop; while playing: jump straight there',
  jump: 'Jump ▶▶',
  next: 'Next ▶',
  stopTitle: 'Add or remove a stop at this point (S)',
  stopRemove: '− Stop',
  stopAdd: '+ Stop',
  fullscreen: 'Fullscreen',
  exportSummary: 'Export',
  exportRunning: 'Export running …',
  pdfShort: 'one page per stop',
  pptxShort: 'one slide per stop, texts editable',
  exportWhere: 'Saved in out/ inside the presentation folder.',
  pdfTitle: 'One PDF page per stop, exactly as the presenter pauses there. Saved in out/ inside the presentation folder.',
  pptxTitle: 'PowerPoint file: one slide per stop, rebuilt from single objects – texts as text boxes, boxes as shapes, arrows as lines; Mermaid, formulas, pictures and 3D as single pictures; the caption in the notes. Saved in out/ inside the presentation folder.',
  askSlide: '? Ask about slide',
  rebuildRunning: '✎ Rebuilding …',
  rebuildSlide: '✎ Rebuild slide',
  info: (scene, scenes, part, parts, frame, dur, saved) => `Scene ${scene}/${scenes} · Section ${part}/${parts} · Frame ${frame}/${dur} · ${saved}`,
  keys: (
    <>
      Next: <kbd>Space</kbd> <kbd>→</kbd> <kbd>Enter</kbd> or click the slide · Back: <kbd>←</kbd> · Stop on/off: <kbd>S</kbd> · Skip section on/off: <kbd>J</kbd> · Fullscreen:{' '}
      <kbd>F</kbd> · Ask the AI: <kbd>?</kbd> (mark text first = ask about exactly that) · Rebuild slide: <kbd>U</kbd> · Draw: <kbd>P</kbd> · yellow ticks = stops · hatched = skipped ·
      click the bar to jump there
    </>
  ),
  liveEdit: 'Changes show up immediately and are saved automatically.',
  shortName: 'Short name in the bar',
  pptxGif: 'Animated in PowerPoint (GIF)',
  pptxGifHint: 'In the PowerPoint export the drawing below the heading of this slide becomes animated GIFs: one per stop, playing the movement from the stop before to this one once and then holding – like a click in the presenter. Cards (boxes with text) and the heading stay editable; nothing inside the drawing can be changed. Without the tick the whole slide is built from single objects that can be edited.',
  heading: 'Heading',
  kicker: 'Kicker',
  title: 'Title',
  captions: 'Captions (from frame · text)',
  texts: 'Texts in the slide',
  listHead: (k) => `List “${k}” (one line per item)`,
  timing: 'Timing',
  durLabel: 'Scene duration in frames (30 per second)',
  stopsLabel: 'Stops (frame numbers within this scene, comma-separated)',
  sectionsLabel: 'Sections (click jumps there; Jump = skip when advancing, key J)',
  sectionRowTitle: 'Go to the start of this section',
  sectionSeg: (k: number, n: number, a: number, b: number) => `Section ${k}/${n} · frames ${a}–${b}`,
  skipLabel: 'Jump',
  skipTitle: 'Jump: when advancing, this section is not played – its end is shown at once (key J).',

  slides: 'Slides',
  slidesHint: 'drag = reorder · click = jump',
  slideRowTitle: 'Drag to move the slide · click to jump to it',
  slideRemoveTitle: 'Remove slide (can be restored below)',
  slideRemoveConfirm: (name) => `Remove the slide “${name}” from the presentation?\n\nIts texts and code are kept; it can be put back under “Removed slides”.`,
  slidesRemoved: (n) => `Removed slides (${n})`,
  slideRestore: '↩ restore',
  slideRestoreTitle: 'Puts the slide back at its old position (otherwise at the end)',

  dragMove: 'Drag = move · double-click = reset',
  dragSize: 'Drag = resize',

  quoted: (quote, q) => `(about the passage “${quote}”) ${q}`,
  explainQuote: 'Explain the marked passage to me.',
  errorStatus: (s) => `Error ${s}`,
  noAnswer: 'No answer received.',
  askHead: 'Ask about slide',
  whoAnswers: 'Who answers',
  agentLabel: 'AI',
  agentTitle: 'Who answers questions, rebuilds slides and creates new presentations. Claude Code, Codex and Gemini (Antigravity CLI) run through their own program and your account, without an API key. “Custom” uses the provider from .env (URL, key, model). Model and effort are set in .env for each.',
  agentMissing: 'not installed',
  agentCustomMissing: 'not set up',
  agentCustomHint: '“Custom” needs the codex command plus LLM_BASE_URL, LLM_API_KEY and LLM_MODEL in .env. The provider must offer OpenAI’s “Responses” interface.',
  agentMissingHint: (n: string) => `The command for ${n} was not found on this computer. Please install it and sign in, or choose the other AI.`,
  inkActive: 'Pen',
  inkKeys: '1–4 colour · Z undo · C clear · P stop',
  modelLabel: 'Model',
  modelDefault: (d) => (d ? `Default (${d})` : 'Program default'),
  modelFromEnv: 'from .env',
  modelsLoading: 'Asking for the models …',
  modelsNone: 'The program returned no model list – it uses its default.',
  modelCustom: (m) => `Model: ${m || '–'} (in .env as LLM_MODEL)`,
  effortLabel: 'Reasoning effort',
  effortAsk: 'Asking',
  effortBuild: 'Rebuilding & creating',
  effortDefault: 'Default',
  effortNames: {minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'very high', max: 'maximum'},
  effortHint: 'More effort = more thorough, but slower and uses more of your quota. For asking “low” is usually enough, for rebuilding and creating “medium” to “high”.',
  claudeNotes: {opus: 'most capable, slower', sonnet: 'balanced', haiku: 'fast, for simple tasks'},
  settingFailed: (e) => `Not saved: ${e}`,
  llmEnv: 'LLM from .env',
  close: 'Close (Esc)',
  askIntro:
    'Ask a question about what is shown right now. The model knows the texts of this slide and the sources in the “quellen” folder. You can mark text in the slide or in an answer and then ask about exactly that. Claude Code, Codex and Gemini can also search the internet.',
  sources: 'Sources: ',
  noSources: 'No sources in the “quellen” folder.',
  kChars: (n) => `${n}k characters`,
  thinking: 'thinking …',
  handoverTitle: 'Opens “Rebuild slide” with this suggestion as the instruction – you can still edit it before starting',
  handover: '→ Use as rebuild instruction',
  handoverText: (question, answer) => `Implement this suggestion from “Ask about slide”.\n\nMy question: ${question}\n\nSuggestion:\n${answer}`,
  dropQuote: 'Discard marked text',
  askPlaceholderQuote: 'Question about the marked text (empty = explain)',
  askPlaceholder: 'Type a question (⇧↵ new line)',
  askInputTitle: 'Enter sends · Shift+Enter inserts a new line',
  askSend: 'Ask',

  rebuildHead: 'Rebuild slide',
  rebuildClose: 'Close (Esc) – a running rebuild continues',
  rebuildIntro:
    'Describe what should change in the slides – graphics, layout or text. The chosen AI edits the files in src/, checks the result with a preview, then the presentation reloads. Before every rebuild the current state is backed up; “Undo” restores it. This usually takes a few minutes.',
  working: (s) => `working … ${s} s`,
  rebuildBusy: 'Rebuild running …',
  rebuildPlaceholder: 'Type the instruction, ⌘/Ctrl + Enter starts',
  rebuildStart: 'Rebuild',
  undo: 'Undo',

  templateFailed: 'The template could not be loaded.',
  needFolder: 'Please enter the folder of the new presentation, e.g. …/My-Topic.',
  placeholdersLeft: 'The prompt still contains placeholders in angle brackets (<…>). Start anyway?',
  serverDown: 'The server cannot be reached.',
  createHead: 'Create new presentation',
  createClose: 'Close (Esc) – a running job continues',
  folder: (p) => `Folder: ${p}`,
  createWorking: (min, s) =>
    `working … ${min} min ${s} s. A whole presentation often takes 10 to 20 minutes. You can close this window; the job keeps running and the current presentation stays usable.`,
  doneWithNotes: 'Finished, with messages (see above). ',
  done: 'Finished. ',
  doneCheck: 'The AI checked the slides with the preview – still, please click through once; corrections go through “Rebuild slide”.',
  copyPapers: 'If the presenter should look things up in the papers when asked (key ?), copy them to',
  running: 'running …',
  createAnother: 'Create another …',
  openPresentation: 'Open presentation',
  folderLabel: 'Folder of the new presentation (new or empty; can be anywhere)',
  folderPlaceholder: '/path/to/My-Topic',
  chooseFolder: 'Choose folder …',
  promptLabel: 'Prompt (template from prompt.en.txt in the ShowPoint folder)',
  papersNote1: 'The AI reads papers named in the prompt only while creating.',
  papersNote3a: 'If the presenter should also look things up in them',
  papersNote3b: 'during the talk',
  papersNote3c: 'when asked (key ?), also copy the papers to',
  papersFolderFallback: '<presentation folder>/quellen',
  papersNote4: 'The folder is created when the presentation is created; the AI only puts its own notes there.',
  specsNote1: 'A line',
  specsExample: 'Specification: ~/specs/plantuml_er.md',
  specsNote2: 'adds a rule for the look (e.g. your own notation for ER diagrams) permanently to',
  specsFolderFallback: '<presentation folder>/vorgaben',
  createHint: '⌘/Ctrl + Enter starts · often takes 10 to 20 minutes',
  reloadTemplateTitle: 'Resets the prompt to the contents of prompt.en.txt',
  reloadTemplate: 'Reload template',
  jobRunning: 'A job is already running',
  create: 'Create',
};

export const T = lang === 'en' ? en : de;

/** Small DE | EN switch. */
export const LangSwitch: React.FC = () => (
  <span className="lang" title={T.language}>
    {(['de', 'en'] as const).map((l) => (
      <button key={l} className={l === lang ? 'on' : ''} onClick={() => l !== lang && setLang(l)}>
        {l.toUpperCase()}
      </button>
    ))}
  </span>
);

export const langCss = `
.lang{display:inline-flex;border:1px solid #2e3a63;border-radius:8px;overflow:hidden;vertical-align:middle}
.lang button{border:0;border-radius:0;padding:4px 9px;font-size:12px;background:#0a0d18;color:#9aa6c7}
.lang button.on{background:#8b6cff;color:#fff;font-weight:600}
.pres-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
.pres-top label{margin:0}
`;
