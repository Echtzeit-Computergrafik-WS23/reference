# Material zur Vorlesung am 05. Dezember '23 - "Normal (& Parallax) Mapping"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- X10-start.js:           Eine Wand mit einer Diffuse/Specular Textur, ohne Normal mapping.
- X20-simple.js:          Selbe Wand, diesmal mit Normal mapping (in global space).
- X31-rotated.js:         Selbe Wand, diesmal rotiert so dass sie flach auf dem boden liegt mit Normal mapping (in tangent space).
- X41-steep-parallax.js:  Ein Beispiel von steep parallax rendering.
- X91-monkey-flat.js:     Ein Affenkopf mit Diffuse/Specular Textur, ohne Normal mapping.
- X92-monkey-normal.js:   Selber Affenkopf, diesmal mit Normal mapping (in global space).
- X93-monkey-parallax.js: Selber Affenkopf, diesmal mit (steep) Parallax mapping.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
