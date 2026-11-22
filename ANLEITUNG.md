# ShowPoint – Anleitung

*English version: [GUIDE.md](GUIDE.md)*

Der Präsentator ist ein kleiner Vite-Editor (`editor/`), der eine Präsentation aus animierten React-Szenen im Browser abspielt,
an Haltepunkten stoppt und per Leertaste, Pfeiltaste oder Klick weiterschaltet. Dieser Ordner enthält **nur den
Präsentator**. Jede Präsentation liegt in einem eigenen Ordner irgendwo auf der Festplatte und wird im Präsentator
unter „Präsentation“ gewählt.

Alle Pfade wie `src/…` und `quellen/…` in dieser Anleitung meinen den **Ordner der Präsentation**, nicht diesen Ordner.

## Starten

Voraussetzungen: Node.js (ab 20) und – für „Frage zur Folie“ mit Claude, „Folie umbauen“ und „Neue Präsentation“ –
die Claude-Code-CLI (`claude`), angemeldet mit deinem Abo. Für das LLM aus `.env` `.env.example` nach `.env` kopieren
und ausfüllen.

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

Der Präsenter öffnet sich dann selbst im Standardbrowser unter <http://localhost:5173> (ohne Browser:
`BROWSER=none npm run edit`). Der Port ist fest; läuft dort schon ein anderer Editor, bricht der Start ab –
den anderen zuerst beenden. Ist noch keine Präsentation gewählt, zeigt die Seite nur die Auswahl.

Tasten: Leertaste / → / Enter / Klick = weiter · ← = zurück · `S` = Haltepunkt ein/aus · `F` = Vollbild · `?` = Frage ans LLM.

**Folien umsortieren:** Rechts oben unter „Folien“ stehen alle Folien in ihrer Reihenfolge. Eine Zeile ziehen
verschiebt die Folie (ein gelber Strich zeigt, wo sie landet), ein Klick springt zu ihr. Gespeichert wird sofort in
`content.json` (`order`); die Folien selbst bleiben unverändert.

**Folien entfernen:** 🗑 rechts in der Zeile (erscheint beim Darüberfahren). Die Folie verschwindet aus der
Präsentation, Texte und Code bleiben aber erhalten: Unter der Liste steht „Entfernte Folien (n)“, dort fügt
„↩ wieder einfügen“ sie an ihrer alten Stelle wieder ein. Endgültig löschen (auch den Code) geht über „Folie umbauen“.
In `content.json` stehen entfernte Folien weiter unter `scenes`, aber nicht in `order`; `removed` merkt sich ihre Stelle.

## Sprache (Deutsch / Englisch)

- Die Oberfläche lässt sich oben in der Leiste zwischen **DE** und **EN** umschalten. Voreinstellung ist die Sprache
  des Browsers; die Wahl merkt sich der Browser.
- Claude antwortet (Fragen, Umbau, Erzeugen) in der gewählten Sprache.
- Eine neue Präsentation, die aus der englischen Oberfläche erzeugt wird, startet mit der englischen Vorlage
  (`vorlage/` mit den englischen Dateien aus `vorlage/en/` darüber) und dem Prompt aus `prompt.en.txt`.
- Die Texte auf den Folien richten sich nach der Sprache des Auftrags (z. B. „Sprache: Deutsch“ im Prompt).

## Präsentator und Inhalt sind getrennt

**Inhalt** ist ein eigener Ordner mit `src/` (Folien und Texte) und `quellen/` (Nachschlagematerial für Fragen).
**Präsentator** ist dieser Ordner: `editor/`, `vite.config.mts`, `scripts/`, `.env`, `node_modules`. Hier steht nichts Themenspezifisches.

Der Inhalt muss nur diese Schnittstelle erfüllen (Typen dazu in `editor/types.ts`):

| Datei im Inhaltsordner | Pflicht | Aufgabe |
|---|---|---|
| `src/Video.tsx` | ja | exportiert `Video`, eine React-Komponente mit der Eigenschaft `{content}` |
| `src/content.json` | ja | `title` (Name der Präsentation), `order`, `scenes` – je Szene `name` (Kurzname für die Leiste), `dur`, `stops`, `t`, `lists`, optional `kicker`, `title`, `captions` |
| `src/begleittext.md` | nein | Thema, Zielgruppe, Ton für die `?`-Taste |
| `src/umbau-regeln.md` | nein | Besonderheiten dieser Folien für „Folie umbauen“ |
| `vorgaben/*.md, *.txt` | nein | Vorgaben, wie etwas gezeichnet wird (z. B. ER-Diagramme) – gelten bei jedem Umbau |
| `quellen/*.md, *.txt, *.pdf` | nein | gehen bei Fragen als Text an das Modell |

Welche Präsentation gezeigt wird, wählt man im Präsentator rechts oben unter „Präsentation“:

- Die Liste zeigt alle eingehängten Präsentationen (Einträge unter `inhalte/`).
- „Anderen Ordner wählen …“ öffnet den Ordner-Dialog von macOS, „Pfad eintippen …“ nimmt einen Pfad. Der Ordner darf
  irgendwo liegen; er muss `src/Video.tsx` und `src/content.json` enthalten.
- Ein gewählter Ordner wird als Verknüpfung unter `inhalte/<name>` eingehängt (nichts wird kopiert), damit er die
  installierten Pakete des Projekts findet. Seine Dateien bleiben, wo sie sind. Aus der Liste entfernt man ihn
  mit dem Knopf „Aus Liste entfernen“ (löscht nur die Verknüpfung). `inhalte/` steht in `.gitignore`.
- Die Wahl steht als `INHALT` in `.env` und gilt auch nach einem Neustart. Fragen, Quellen, Speichern und
  „Folie umbauen“ beziehen sich immer auf die gewählte Präsentation.

## Wie die Teile zusammenhängen

| Datei | Aufgabe |
|---|---|
| `src/content.json` | Reihenfolge der Szenen, Dauer, Haltepunkte und alle Texte. Der Editor liest und schreibt diese Datei. |
| `src/Video.tsx` | Tabelle `REG`: ordnet jeder Szenen-ID aus `content.json` eine React-Komponente zu und reiht sie hintereinander. |
| `src/scenesA.tsx`, `scenesB.tsx`, `scenesC.tsx` | Die Szenen selbst. |
| `src/ui.tsx` | Bausteine für Szenen (`Scene`, `Appear`, `Box`, `Arrow`, Farben `C` …) und die Typen `SceneContent`, `SceneProps`. |
| `runtime/` | Laufzeit: die Bausteine, die Szenen aus `'showpoint'` importieren (siehe unten), und der Player. |
| `render/`, `scripts/stills.mjs` | Renderer: öffnet die Präsentation in einem unsichtbaren Chrome und fotografiert einzelne Bilder. |
| `scripts/render.mjs`, `scripts/pdf.mjs`, `scripts/vorschau*.mjs` | Präsentator: rendert die gewählte Präsentation als Video bzw. PDF und erzeugt die Vorschaubilder für Claude. |
| `editor/main.tsx` | Oberfläche des Präsentators. Die Anzeigenamen der Szenen kommen aus `content.json` (`name`). |
| `vite.config.mts` | Server: `/api/content` (lesen/speichern), `/api/ask` (die `?`-Taste), `/api/rebuild` (Folie umbauen), `/api/create` (neue Präsentation); Zugänge aus `.env`. |
| `prompt.txt`, `prompt.en.txt`, `vorlage/` | Vorlage für den Prompt (deutsch/englisch) und Gerüst (Bausteine, Beispiel-Szene) einer neuen Präsentation; `vorlage/en/` enthält die englischen Fassungen der Texte. |

## Weg A: neue Szenen einladen (empfohlen)

So passen neu erzeugte Szenen vollständig in den Präsentator, mit editierbaren Texten und Haltepunkten.

### 1. Szenen-Datei nach `src/` legen

Jede Szene ist eine Komponente mit dieser Signatur:

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

Regeln:

- `useCurrentFrame()` zählt in jeder Szene ab 0 (die Szenen laufen in einer `Series`).
- Texte nicht fest in die Komponente schreiben, sondern aus `c.t.<schlüssel>` bzw. `c.lists.<schlüssel>` lesen –
  nur dann erscheinen sie rechts im Editor und lassen sich ändern.
- Format ist 1920 × 1080 bei 30 Bildern pro Sekunde.
- `Scene` aus `ui.tsx` liefert Hintergrund, Überschrift und Untertitel; wer ein eigenes Layout will, kann stattdessen `AbsoluteFill` verwenden.

### 2. In `src/Video.tsx` anmelden

```tsx
import {Einstieg} from './meineSzenen';

const REG: Record<string, React.FC<SceneProps>> = {
  einstieg: Einstieg,
  // … weitere Szenen
};
```

Gezeigt wird nur, was in `content.json` unter `order` steht.
Jede ID aus `order` muss aber in `REG` stehen, sonst bleibt das Bild leer bzw. es gibt einen Fehler.

### 3. In `src/content.json` eintragen

```json
{
  "title": "Mein Thema",
  "order": ["einstieg"],
  "scenes": {
    "einstieg": {
      "name": "Einstieg",
      "dur": 300,
      "kicker": "Dachzeile",
      "title": "Überschrift der Szene",
      "captions": [{"at": 10, "text": "Untertitel ab Bild 10"}],
      "stops": [150],
      "t": {"t01": "Text im Bild"},
      "lists": {}
    }
  }
}
```

- `dur`: Länge der Szene in Bildern (30 = 1 Sekunde).
- `stops`: Haltepunkte als Bildnummern innerhalb der Szene. Kann leer sein (`[]`) und später im Editor mit `S` gesetzt werden.
- `t` und `lists` müssen vorhanden sein, notfalls leer (`{}`); `stops` muss eine Liste sein. Fehlt eines davon, stürzt der Editor ab.
- `kicker`, `title`, `captions` sind freiwillig; ebenso `name` (ohne ihn zeigt die Leiste die ID).

Der Editor überschreibt `content.json` beim Bearbeiten; eine Versionsverwaltung im Ordner der Präsentation ist deshalb sinnvoll.

### 4. Kleinigkeiten anpassen

- `?`-Taste: Thema, Zielgruppe und Ton stehen in `src/begleittext.md`, das Nachschlagematerial im Ordner `quellen/`. Beides auf das neue Thema umstellen, sonst antwortet das Modell mit falschem Hintergrund. Im Dialog wählt man zwischen „Claude Code“ (Befehl `claude`, Modell in `.env` als `CLAUDE_MODEL`, Denkaufwand als `CLAUDE_EFFORT_FRAGEN`) und „LLM aus .env“. Der Zugang steht in `.env` (Vorlage: `.env.example`).
  Mit „Claude Code“ darf das Modell bei Fragen **im Internet suchen und Webseiten lesen** (WebSearch, WebFetch) – etwa für aktuelle Fakten – und nennt dann die genutzten Seiten; im Dialog erscheint, wonach es sucht (🔎) und was es liest (🌐). Dateien lesen oder Befehle ausführen kann es dabei nicht. „LLM aus .env“ hat keinen Internetzugang.
- „Folie umbauen“: Besonderheiten der Folien (Bausteine, Maße, Fakten) in `src/umbau-regeln.md` beschreiben.

## Weg B: eine fertige fremde Animation unverändert einladen

Liegt schon eine fertige Animation vor (eine Komponente mit fester Länge, die ihre Bewegung aus `useCurrentFrame()` ableitet), kann sie als eine einzige Szene laufen:

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

`dur` ist die Länge der Animation in Bildern. Haltepunkte setzt man danach im Editor mit `S`.
Einschränkungen: Texte sind so nicht im Editor änderbar, und die Animation muss für 1920 × 1080 bei 30 Bildern pro Sekunde gebaut sein.
Für ein anderes Format müssen Breite, Höhe und `fps` an zwei Stellen gleich geändert werden: im `<Player>` in `editor/main.tsx` und in `render/main.tsx`.

## Zeitleiste

Die Zeitleiste unter dem Bild ist zweigeteilt. **Links** stehen alle Folien der Präsentation (drei Viertel der Breite; Name beim Darüberfahren). Die Breiten folgen der Foliendauer, aber jede Folie bekommt mindestens Platz für ihre Nummer – auf einem normalen Bildschirm passen so etwa 50 Folien. Erst wenn auch das nicht reicht, stehen die Nummern wie bei einem Lineal an jeder 2., 5., 10. … Folie und an der aktuellen.
**Rechts** (ein Viertel) stehen die Abschnitte der aktuellen Folie – mit Haltepunkten (gelb), Sprung-Schraffur und
Abspielkopf. Ein Klick in eine der beiden Leisten springt an diese Stelle. So bleibt auch bei vielen Folien genug Platz
für die Haltepunkte.

## Abschnitte überspringen („Sprung“)

Ein Abschnitt ist die Strecke zwischen zwei Haltepunkten einer Folie; die Anzeige unter dem Bild nennt ihn
(„Abschnitt 2/6“). Rechts unter „Ablauf“ stehen alle Abschnitte der Folie mit Bildbereich und Untertitel; ein Klick
springt an den Anfang. Mit dem Häkchen **Sprung** (oder Taste `J`) wird ein Abschnitt beim Weiterschalten nicht
abgespielt: Am Haltepunkt davor zeigt der nächste Klick sofort das Ende des Abschnitts. In der Zeitleiste ist er
schraffiert. Die Animation selbst bleibt unverändert, auch PDF und Video zeigen sie wie immer. `J` gilt für den
Abschnitt an der aktuellen Stelle – am Haltepunkt für den, der als Nächstes käme. Gespeichert wird es in
`content.json` als `skip` der Szene (Startbilder der übersprungenen Abschnitte).

## Bausteine der Laufzeit

Szenen importieren ihre Bausteine aus `'showpoint'` (Quelltext in `runtime/index.tsx`):

| Baustein | Aufgabe |
|---|---|
| `useCurrentFrame()` | aktuelles Bild, gezählt ab Beginn der Szene bzw. der umgebenden `Sequence` |
| `useVideoConfig()` | `{fps, width, height, durationInFrames}` – 30, 1920, 1080 und die Gesamtlänge |
| `interpolate(x, [a, b], [von, bis], {extrapolateLeft, extrapolateRight, easing})` | rechnet ein Bild in einen Wert um (Lage, Deckkraft …); `'clamp'` hält die Endwerte |
| `spring({frame, fps, config: {damping, stiffness, mass}})` | Federbewegung von 0 nach 1; `damping: 200` = weich ohne Überschwingen |
| `Easing.inOut(Easing.cubic)`, `Easing.bezier(…)` … | Beschleunigungskurven für `interpolate` |
| `random('schlüssel')` | Zufallszahl, die für denselben Schlüssel immer gleich ist |
| `AbsoluteFill` | `div`, das seinen Rahmen ganz ausfüllt |
| `Sequence from={…} durationInFrames={…}`, `Series` | zeigt Inhalte nur in einem Zeitfenster; darin zählt das Bild wieder ab 0 |
| `Img` | Bild; der Renderer wartet, bis es geladen ist |
| `BarChart`, `LineChart`, `PieChart` | Diagramme, die sich ab Bild `at` aufbauen (Details unten) |
| `Formula` | Formel aus LaTeX-Text (KaTeX), weich eingeblendet ab `at`: `<Formula tex={c.t.f1} x={90} y={250} at={20} fontSize={56} />`; Umformungsschritte nacheinander mit `steps={c.lists.schritte}` (Abstand `every`, Standard 45 Bilder); außerdem `w`, `align`, `color`, `display={false}` für Fließtext-Stil. In `content.json` Backslashes verdoppeln: `"\\frac{a}{b}"` |
| `ThreeCanvas x y w h setup={…} update={(ctx, frame, fps) => …}`, `THREE` | 3D-Szene mit Three.js: `setup` baut Szene, Licht und Kamera einmal, `update` setzt alles nur aus der Bildnummer. Beispiel: `vorlage/beispiele/three-beispiel.tsx`. Text in 3D ist nicht markierbar, Beschriftungen daher als normalen Text daneben setzen |
| `Model3D src={haus} x y w h at angle tilt spin zoom update={…}` | 3D-Modell aus einer `.glb`-Datei (`import haus from './modelle/haus.glb'`): wird zentriert, eingepasst und beleuchtet; `spin` = Grad pro Sekunde aus der Bildnummer, in der Datei gespeicherte Animationen laufen ab Bild `at` mit. Mit `update` einzelne Teile per Namen ein-/ausblenden oder die Ansicht steuern. Beispiel: `vorlage/beispiele/modell-beispiel.tsx` |
| `Mermaid code={…} x y w h` | Fluss-, Sequenz-, Zustands- und Klassendiagramme aus Mermaid-Text, eingepasst in den Rahmen und im Folienstil gefärbt. Einblenden: ganz ab `at`, mit `every={30}` Schritt für Schritt (Knoten in der Reihenfolge ihrer ersten Nennung, jede Kante mit dem späteren ihrer Knoten; im Sequenzdiagramm erst die Teilnehmer, dann Nachrichten und Notizen von oben nach unten) oder selbst gesteuert mit `reveal={Zahl sichtbarer Schritte}` bzw. `progress={0..1}`. Außerdem `fontSize` (Standard 20), `maxScale`, `themeVariables`. Mermaid wird erst geladen, wenn eine Folie es benutzt. Syntaxfehler erscheinen als roter Kasten. Beispiel: `vorlage/beispiele/mermaid-beispiel.tsx` |
| `waitFor('name')` | für eigene Bausteine, die asynchron zeichnen: `const done = waitFor('name')` vor dem Start, `done()` sobald das Ergebnis im DOM steht. Vorschau, PDF und Video warten darauf (höchstens 30 s, dann Fehlermeldung mit dem Namen) |

**Diagramme.** Zahlen und Beschriftungen stehen am besten in `content.json` unter `lists` (Werte als Text, z. B. `"3,5"`
oder `"40 %"`), dann sind sie im Präsentator änderbar:

```tsx
<BarChart x={90} y={200} w={900} h={650} labels={c.lists.labels} values={c.lists.werte} unit=" ms" at={20} />
<BarChart … horizontal highlight={2} />          {/* Balken quer, dritter hervorgehoben */}
<LineChart x={…} y={…} w={…} h={…} labels={c.lists.jahre}
  series={[{name: c.t.t01, values: c.lists.a}, {name: c.t.t02, values: c.lists.b}]} at={20} />
<PieChart x={…} y={…} w={…} h={…} labels={c.lists.labels} values={c.lists.werte} center="128 GB" decimalComma />
```

Weitere Eigenschaften: `color`/`colors`, `max`, `stagger` (Säulen), `area`, `showValues`, `dur` (Linie, Kreis),
`donut={false}` (Kreis), `decimals`, `fontSize`. Ein Dezimalkomma in den Daten schaltet die Anzeige auf Komma um;
sonst erzwingt `decimalComma` es.

## Weitere Pakete (Karten, Graphen …)

Reichen die Bausteine nicht, darf Claude beim Umbauen und Erstellen selbst ein npm-Paket installieren (Werkzeug
„paket“, im Protokoll als „Paket installieren“). Man kann ein Paket im Auftrag nennen („nimm d3-geo“) oder Claude
wählen lassen („zeige eine Karte Europas“). Von Hand geht es auch:

```bash
node scripts/paket.mjs <Ordner der Präsentation> d3-geo
```

- Das Paket landet in der Präsentation selbst (`package.json`, `node_modules/` – steht in deren `.gitignore`),
  nicht im Präsentator. Nach dem Kopieren auf einen anderen Rechner dort im Ordner der Präsentation `npm install`.
- Feste Version, keine Installationsskripte, höchstens 100 MB; fehlende TypeScript-Typen kommen von `@types`.
  React bringt der Präsentator mit.
- **Lizenzen:** Pakete ohne freie Open-Source-Lizenz werden installiert, aber markiert: gelber Hinweis im
  Präsentator und im Protokoll, Übersicht in `PAKETE.md` im Ordner der Präsentation. Für die eigene Nutzung in
  Ordnung; vor dem Weitergeben (auch als PDF oder Video) oder kommerzieller Nutzung die Lizenz prüfen. Mit
  `PAKETE_NUR_FREI=1` in `.env` werden nur freie Lizenzen (MIT, ISC, BSD, Apache-2.0 …) angenommen.
- **Zeit:** Jedes Bild muss allein aus `useCurrentFrame()` entstehen. Eigene Animationen, Timer und Übergänge der
  Bibliothek gehören abgeschaltet (z. B. `animation: false`, Simulation vorab durchrechnen), sonst stimmen Springen,
  Haltepunkte, PDF und Video nicht.
- **Karten:** am besten als SVG mit `d3-geo` und Offline-Daten (`world-atlas`, `topojson-client`) – scharf im PDF,
  ohne Internet, Beschriftung als echter Text. Kachelkarten aus dem Netz (Leaflet, OpenStreetMap) brauchen beim
  Rendern Internet und die Nutzungsbedingungen der Kachel-Server.
- „Rückgängig“ beim Umbauen setzt nur `src/` zurück; installierte Pakete bleiben (sie schaden nicht).

## Als Video ausgeben

```bash
npm run render
```

Rendert die im Präsentator gewählte Präsentation nach `out/<titel>.mp4` **in deren Ordner**
(z. B. `<Ordner der Präsentation>/out/<titel>.mp4`). Nur einen Ausschnitt: `npm run render -- --frames=0-90`.
Braucht Google Chrome und `ffmpeg` (macOS: `brew install ffmpeg`). Gerendert wird in mehreren Tabs parallel.

## Als PDF ausgeben

Knopf „⤓ PDF“ im Präsentator, oder im Terminal:

```bash
npm run pdf
```

Erzeugt `out/<titel>.pdf` im Ordner der Präsentation: **eine Seite je Haltepunkt**, genau das Bild, bei dem der
Präsentator dort anhält (mit Untertitel), dazu das Schlussbild. Gut als Handout oder zum Nachlesen; dauert etwa
eine halbe Minute.

## Stolpersteine

- Folien dürfen nur `showpoint` und `react` importieren; ein eigenes `node_modules` im Ordner der Präsentation wird nicht gebraucht.
- Ältere Präsentationen, die noch aus `'remotion'` importieren, laufen unverändert: Der Name führt ebenfalls zur Laufzeit hier. `src/Root.tsx` und `src/index.ts` werden nicht mehr gebraucht und dürfen bleiben.
- PDF, Video und Vorschau brauchen Google Chrome (oder ein per `npx playwright install chromium` geladenes Chromium).
- Die Vite-Konfiguration muss `vite.config.mts` heißen.
- `.env` enthält den LLM-Schlüssel und steht in `.gitignore`; nicht weitergeben.

## Auftrag an Claude (zum Kopieren)

> Erzeuge in einem neuen Ordner `<Pfad>` eine Präsentation zum Thema … für den Präsentator in `<Pfad zu ShowPoint>`.
> Lies zuerst dessen `ANLEITUNG.md`; als Vorlage dient dessen Ordner `vorlage/` (Bausteine in `src/ui.tsx` übernehmen). Lege die Szenen als `React.FC<SceneProps>` in einer neuen Datei unter `src/` an,
> nutze die Bausteine aus `src/ui.tsx`, lies alle Texte aus `c.t` / `c.lists`, melde die Szenen in `REG` in `src/Video.tsx` an,
> schreibe `src/content.json`
> mit `title`, je Szene einem `name` und sinnvollen Haltepunkten, und passe `src/begleittext.md` und `src/umbau-regeln.md` an.

## Neue Präsentation aus dem Präsentator erzeugen lassen

Knopf „＋ Neue Präsentation erzeugen …“ (rechts oben unter „Präsentation“): Ordner der neuen Präsentation angeben
(neu oder leer, irgendwo auf der Festplatte) und den Prompt ausfüllen. Das Fenster ist mit der Vorlage aus
`prompt.txt` (in diesem Ordner, frei änderbar; in der englischen Oberfläche `prompt.en.txt`) vorbelegt. Der Server kopiert das Gerüst aus `vorlage/` in den
Ordner, hängt ihn unter `inhalte/` ein und startet Claude Code (Modell aus `.env`, `CLAUDE_MODEL`; Denkaufwand `CLAUDE_EFFORT_UMBAU`), das die Folien,
`content.json`, `begleittext.md`, `umbau-regeln.md` und `quellen/00-notizen.md` schreibt. Danach prüft der Server
`content.json` und die Typen; bei Typfehlern bessert Claude bis zu zweimal nach. Der Auftrag läuft im Hintergrund
(oft 10 bis 20 Minuten), die gezeigte Präsentation bleibt benutzbar; „Präsentation öffnen“ wechselt zur neuen.

- Der Prompt darf auf Papers verweisen: Dateipfade (`.pdf`, `.md`, `.txt`; mit Leerzeichen in Anführungszeichen) und Links.
  Claude darf genau diese Dateien lesen und nur die Adressen (Domains) der genannten Links abrufen (bei GitHub auch die Rohdateien); schreiben darf es nur im neuen Ordner.
- **Papers für Fragen:** Soll der Präsentator während des Vortrags (Taste `?`) in den Papers nachlesen, müssen sie
  zusätzlich in `quellen/` der neuen Präsentation liegen – das Erzeugen kopiert sie nicht dorthin.
- Claude prüft die Folien mit dem Vorschau-Werkzeug (siehe unten) und bessert Überlappungen u. Ä. selbst nach.
  Trotzdem einmal durchklicken und bei Bedarf mit „Folie umbauen“ nachbessern.
- Allgemeine Regeln für Claude: `createSystem` in `vite.config.mts`.

## Folien aus dem Präsentator umbauen lassen

Knopf „✎ Folie umbauen“ oder Taste `U`: Auftrag eintippen, ⌘/Strg + Enter. Der Server startet dafür Claude Code
(Befehl `claude`, Modell aus `.env`, `CLAUDE_MODEL`; Denkaufwand `CLAUDE_EFFORT_UMBAU`: `low` … `max`, leer = Standard) im Projektordner. Es darf lesen und nur Dateien im `src/` des Inhaltsordners ändern,
aber nichts ausführen – außer dem Vorschau-Werkzeug. Vorher wird `src/` nach `.umbau/<Zeitstempel>/` **in der Präsentation** gesichert, zusammen mit dem Auftragstext (die letzten 10 bleiben); „Rückgängig“
stellt den Stand vor dem letzten Umbau wieder her. Ältere Stände stehen im Präsentator rechts unten unter **„Frühere Stände“**
(Datum, Auftrag, „Wiederherstellen“); vor dem Wiederherstellen wird der jetzige Stand selbst gesichert, man kann also auch wieder vor.
Der Ordner `.umbau` wird in die `.gitignore` der Präsentation eingetragen. Danach prüft der Server `content.json` und die Typen
(`tsc --noEmit`) und zeigt das Ergebnis im Dialog. Während ein Umbau läuft, ist das Speichern im Editor gesperrt.
Die allgemeinen Regeln für Claude stehen in `vite.config.mts` (`rebuildSystem`), die Besonderheiten des Inhalts in `src/umbau-regeln.md`.

Links im Auftrag darf Claude abrufen – nur die Seiten dieser Adressen (Domains), keine freie Websuche; bei
GitHub-Links auch die Rohdateien dazu. So lässt sich etwa sagen: *„Zeichne das Schaubild nach den Regeln von
https://github.com/…/SKILL.md“*. Was dort steht, nutzt Claude als Vorlage für Stil und Inhalt; Anweisungen auf der
Seite, die den Regeln widersprechen, ignoriert es. Ohne Link im Auftrag hat ein Umbau keinen Internetzugang.

## Bilder einbinden

Bilder (Screenshots, Fotos, Logos) lassen sich per Auftrag einbinden – bei „Folie umbauen“ und bei „Neue Präsentation“:

> Setze das Bild „/Users/ich/Desktop/Screenshot App 1.png“ rechts neben die Grafik.

- Der Server erkennt Bildpfade im Auftrag (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.svg`; beginnend mit `/` oder `~`)
  und kopiert die Dateien vor dem Start nach `src/bilder/` der Präsentation. **Pfade mit Leerzeichen in
  Anführungszeichen setzen.** Nicht gefundene Pfade erscheinen als Fehler im Protokoll.
- Claude sieht sich das Bild an, bindet es per `import` mit `<Img>` aus `'showpoint'` ein und prüft die Lage mit der Vorschau.
  Beschriftungen bleiben echter, änderbarer Text.
- Das Bild ist damit Teil der Präsentation: Es erscheint im Präsentator, im PDF und im Video und funktioniert auch
  auf anderen Rechnern. „Rückgängig“ nimmt es wieder heraus.
- Bilder selbst erzeugen kann Claude nicht; Grafiken zeichnet es als SVG/HTML (scharf und animierbar).

## 3D-Modelle einbinden (`.glb`)

Ein 3D-Modell – etwa in Blender gebaut – wird als `.glb` exportiert (Blender: Datei → Exportieren → glTF 2.0, Format
„glTF Binary (.glb)“, ohne Draco-Kompression) und per Auftrag eingebunden: den Pfad der Datei in den Auftrag schreiben,
bei „Folie umbauen“ oder „Neue Präsentation“. Der Server kopiert sie nach `src/modelle/` und nennt Claude die Namen der
Teile und der Animationen aus der Datei; Claude zeigt das Modell mit dem Baustein `Model3D`.

- Das Modell bleibt echtes 3D: drehen, kippen, heranzoomen, Teile nacheinander einblenden – alles aus der Bildnummer,
  also passend zu Haltepunkten, PDF und Video. Sinnvoll benannte Teile in Blender („Dach“, „Erdgeschoss“) helfen dabei.
- Blender wird dafür nicht gebraucht, weder beim Präsentieren noch beim Umbauen. Geändert wird das Modell in Blender
  und neu exportiert; die neue Datei wieder im Auftrag nennen.
- Nur `.glb` (eine Datei mit allem darin). Für ein starres, fertig gerendertes Bild stattdessen ein PNG mit
  transparentem Hintergrund als Bild einbinden.

## Vorgaben für die Darstellung (`vorgaben/`)

Soll etwas in einer Präsentation immer auf eine bestimmte Art gezeichnet werden – etwa ER-Diagramme in einer festen
PlantUML-Schreibweise –, legt man dafür eine Beschreibung als Markdown- oder Textdatei in den Ordner `vorgaben/` der
Präsentation (neben `src/`). Claude bekommt bei „Neue Präsentation“ und bei jedem „Folie umbauen“ die Liste dieser
Dateien (Dateiname, Überschrift, erster Absatz) und liest die passende, bevor es so etwas baut oder ändert. Die
Vorgaben sind verbindlich für die Darstellung; die technischen Regeln (nur `src/` ändern, alles aus dem Bild berechnet)
gelten weiter.

- **Von Hand:** Datei in `vorgaben/` kopieren – sie gilt ab dem nächsten Umbau. Löschen oder bearbeiten genauso.
- **Per Auftrag:** eine Zeile mit „Vorgabe“ (auch „Vorlage“, „Spezifikation“, „spec“, „template“) und dem Pfad einer
  `.md`- oder `.txt`-Datei, z. B. `Vorgabe für ER-Diagramme: /Users/ich/specs/plantuml_er.md`. Der Server kopiert die
  Datei nach `vorgaben/` (gleicher Name ersetzt die alte Kopie); im Protokoll steht „Vorgabe übernommen“.
- Die Vorgaben gehören zur Präsentation und werden mit ihr weitergegeben. „Rückgängig“ entfernt sie nicht.
- Welche gelten, steht im Präsentator rechts unten bei „Benutzte Bibliotheken · Vorgaben“.

## PlantUML-Diagramme

Für Diagramme, die Mermaid oder die Bausteine nicht richtig können (z. B. ER-Diagramme), kann Claude PlantUML benutzen:
Es schreibt den Diagrammtext nach `src/diagramme/<name>.puml` und ruft das Werkzeug „plantuml“ auf; das erzeugt
`<name>.svg` daneben, schon in den Farben der dunklen Folien, und die Folie bindet das SVG wie ein Bild ein.

- Einmal einrichten: `npm run plantuml` lädt PlantUML (feste Version, per Prüfsumme geprüft) nach `.werkzeuge/`.
  Auf macOS (Apple Silicon), Linux und Windows ist das ein eigenständiges Programm – **Java ist nicht nötig**. Nur auf
  anderen Systemen (z. B. Intel-Macs) wird die `.jar` geladen, die Java braucht.
- Gezeichnet wird lokal, nichts geht ins Internet; `!include` und URLs im Diagrammtext sind gesperrt. PlantUML benutzt
  sein eingebautes Layout (kein Graphviz nötig, gleiches Ergebnis auf jedem Rechner).
- Das fertige SVG liegt in der Präsentation: **Präsentieren, PDF und Video gehen ohne PlantUML**. Gebraucht wird es
  nur, um ein Diagramm zu ändern oder neu zu zeichnen; fehlt es dann, sagt Claude das im Ergebnis.
- Von Hand: `node scripts/plantuml.mjs <Präsentationsordner> <name>`.
- Der Text im Diagramm steht in der `.puml`-Datei, nicht in `content.json` – ändern per „Folie umbauen“.

## Vorschau-Werkzeug für Claude

Beim Umbauen und beim Erzeugen bekommt Claude neben „paket“ und „plantuml“ das Werkzeug `vorschau`: Es prüft `content.json`
und die Typen und gibt die gewünschten Szenen an jedem Haltepunkt als Bild zurück (halbe Größe). Claude sieht sich die
Bilder an, bessert Überlappungen, abgeschnittene oder zu kleine Texte nach und prüft erneut. Das kostet je Durchgang
einige Sekunden pro Szene.

- Technisch ist es ein kleiner MCP-Server (`scripts/vorschau-mcp.mjs`), der `scripts/vorschau.mjs` aufruft. Den Ordner
  legt der Server fest, Claude wählt nur die Szenen. Claude bekommt **kein** Bash – mit Bash dürfte Claude Code
  „harmlose“ Lesebefehle wie `ls` oder `cat` von sich aus ausführen und so z. B. die Sperre für `.env` umgehen.
- Die Bilder liegen danach in `.vorschau/` im Ordner der Präsentation (steht in dessen `.gitignore`).
- Von Hand: `node scripts/vorschau.mjs <Ordner der Präsentation> [Szenen-ID …]`.
