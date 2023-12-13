# Material zur Vorlesung am 07. Dezember '23 - "Shadow Mapping"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- X10-start.js:               Szene: Boden mit einem Torus Knoten und einer "Sonne".
- X20-shadow-pass.js:         Definition des shadow pass (ohne Schattenwurf).
- X25-shadow-map.js:          Visualisierung des Depth buffers.
- X30-shadows.js:             Erste Version von shadow mapping (mit shadow acne).
- X40-shadow-improvements.js: Gleiches setup, diesmal mit besserem shadow mapping.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
