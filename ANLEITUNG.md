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

Dann <http://localhost:5173> öffnen. Der Port ist fest; läuft dort schon ein anderer Editor, bricht der Start ab –
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

- `?`-Taste: Thema, Zielgruppe und Ton stehen in `src/begleittext.md`, das Nachschlagematerial im Ordner `quellen/`. Beides auf das neue Thema umstellen, sonst antwortet das Modell mit falschem Hintergrund. Im Dialog wählt man zwischen „Claude Code“ (Befehl `claude`, Modell in `.env` als `CLAUDE_MODEL`) und „LLM aus .env“. Der Zugang steht in `.env` (Vorlage: `.env.example`).
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
Ordner, hängt ihn unter `inhalte/` ein und startet Claude Code (Modell aus `.env`, `CLAUDE_MODEL`), das die Folien,
`content.json`, `begleittext.md`, `umbau-regeln.md` und `quellen/00-notizen.md` schreibt. Danach prüft der Server
`content.json` und die Typen; bei Typfehlern bessert Claude bis zu zweimal nach. Der Auftrag läuft im Hintergrund
(oft 10 bis 20 Minuten), die gezeigte Präsentation bleibt benutzbar; „Präsentation öffnen“ wechselt zur neuen.

- Der Prompt darf auf Papers verweisen: Dateipfade (`.pdf`, `.md`, `.txt`; mit Leerzeichen in Anführungszeichen) und Links.
  Claude darf genau diese Dateien lesen und nur die Adressen (Domains) der genannten Links abrufen; schreiben darf es nur im neuen Ordner.
- **Papers für Fragen:** Soll der Präsentator während des Vortrags (Taste `?`) in den Papers nachlesen, müssen sie
  zusätzlich in `quellen/` der neuen Präsentation liegen – das Erzeugen kopiert sie nicht dorthin.
- Claude prüft die Folien mit dem Vorschau-Werkzeug (siehe unten) und bessert Überlappungen u. Ä. selbst nach.
  Trotzdem einmal durchklicken und bei Bedarf mit „Folie umbauen“ nachbessern.
- Allgemeine Regeln für Claude: `createSystem` in `vite.config.mts`.

## Folien aus dem Präsentator umbauen lassen

Knopf „✎ Folie umbauen“ oder Taste `U`: Auftrag eintippen, ⌘/Strg + Enter. Der Server startet dafür Claude Code
(Befehl `claude`, Modell aus `.env`, `CLAUDE_MODEL`) im Projektordner. Es darf lesen und nur Dateien im `src/` des Inhaltsordners ändern,
aber nichts ausführen – außer dem Vorschau-Werkzeug. Vorher wird `src/` nach `.umbau/<Zeitstempel>/` gesichert (die letzten 10 bleiben); „Rückgängig“
stellt den Stand vor dem letzten Umbau wieder her. Danach prüft der Server `content.json` und die Typen
(`tsc --noEmit`) und zeigt das Ergebnis im Dialog. Während ein Umbau läuft, ist das Speichern im Editor gesperrt.
Die allgemeinen Regeln für Claude stehen in `vite.config.mts` (`rebuildSystem`), die Besonderheiten des Inhalts in `src/umbau-regeln.md`.

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

## Vorschau-Werkzeug für Claude

Beim Umbauen und beim Erzeugen bekommt Claude ein einziges zusätzliches Werkzeug, `vorschau`: Es prüft `content.json`
und die Typen und gibt die gewünschten Szenen an jedem Haltepunkt als Bild zurück (halbe Größe). Claude sieht sich die
Bilder an, bessert Überlappungen, abgeschnittene oder zu kleine Texte nach und prüft erneut. Das kostet je Durchgang
einige Sekunden pro Szene.

- Technisch ist es ein kleiner MCP-Server (`scripts/vorschau-mcp.mjs`), der `scripts/vorschau.mjs` aufruft. Den Ordner
  legt der Server fest, Claude wählt nur die Szenen. Claude bekommt **kein** Bash – mit Bash dürfte Claude Code
  „harmlose“ Lesebefehle wie `ls` oder `cat` von sich aus ausführen und so z. B. die Sperre für `.env` umgehen.
- Die Bilder liegen danach in `.vorschau/` im Ordner der Präsentation (steht in dessen `.gitignore`).
- Von Hand: `node scripts/vorschau.mjs <Ordner der Präsentation> [Szenen-ID …]`.
