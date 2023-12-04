# Material zur Vorlesung am 28. November '23 - "Instancing"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- 10-start.js:            Die Welt und eine Rakete, kein Instancing.
- 20-copies.js:           40 Kopien des Raketen-Drawcalls, kein Instancing.
- 30-copies-buffer.js:    Das gleiche wie zuvor, nur mit Hilfe eines Buffers für die Transformationen (Xform) jeder Rakete.
- 40-instances-manual.js: 2200 Instanzen der Rakete, größenteils ohne GLANCE library.
- 50-instances-glance.js: Das gleiche wie zuvor, aber diesmal mit GLANCE.
- 60-instances-id.js:     (Kam nicht in der Vorlesung dran) Instancing ohne Xform buffer, stattdessen werden diese im Vertex Shader berechnet.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
