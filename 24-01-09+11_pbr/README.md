# Material zur Vorlesung am 9. & 11. Januar '24 - "Physically Based Rendering (PBR)"

## Showcases

Sie sollten die Datei `index.html` direkt im Browser öffnen können, ohne einen Webserver zu starten.

Die Showcases sind "Snapshots" des Codes den ich in der Vorlesung gezeigt habe:

- X10-rendering_equation.js:    Blinn-Phong Shading, allerdings eingebettet als BRDF in die Rendering Equation
- X20-pbr.js:                   Gleiche Render Equation, anderer BRDF - diesmal physically based (Metallic / Roughness)
- X30-chari.js:                 Beispiel Asset (Barbershop Stuhl), gerendert mit dem PBR Setup aus Schritt 2.

## GLANCE Code

Die GLANCE library liegt sowohl als Typescript im `ts` Ordner, als auch als Javascript im `js`.
Das Javascript wird letztendlich ausgeführt, aber ich würde Ihnen empfehlen, sich den Typescript Code anzuschauen.
Der ist zwar länger, aber durch die zusätzliche Typisierung auch besser zu verstehen.
