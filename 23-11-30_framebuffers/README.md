# Material zur Vorlesung am 30. November '23 - "Framebuffer"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- 10-start.js:  Die Welt und eine Rakete, kein Framebuffer.
- 20-postfx.js: Render-to-Texture mit Post Effects.
- 30-cube.js:   Die Welt/Raketen-Szene gerendert auf eine Box

Ich habe die UV Koordinaten der Box so angepasst, dass die Weltkugel wieder "aufrecht" steht.
Desweiteren werden Texturen jetzt, wenn nicht anders angegeben, richtig herum geladen - also mit der Y-Achse nach unten.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
