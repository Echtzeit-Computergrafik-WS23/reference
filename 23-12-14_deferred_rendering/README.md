# Material zur Vorlesung am 14. Dezember '23 - "Deferred Rendering"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- X10-start.js:          One light with no attenuation.
- X12-multi-light.js:    Two lights with no attenuation.
- X15-attenuation.js:    Two lights with attenuation.
- X20-gbuffer-setup.js:  GBuffer setup (no deferred rendering yet)
- X30-gbuffer-render.js: Display of a single GBuffer texture.
- X40-deferred.js:       Deferred Rendering, same result as X20-gbuffer-setup.js.
- X45-mixed.js:          Deferred Rendering with a single forward-rendered sphere.
- X60-light-volume.js:   Test scene with lots of static lights.
- X70-party-balls.js:    Test scene with animated lights.

Beachten Sie, dass bei dem "mixed" Beispiel, der WebGL Kontext mit `antialias: false` erstellt wird, damit wir den
Depth Buffer aus dem GBuffer verwenden können.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
