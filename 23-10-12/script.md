:alert:
Videoaufzeichnung der Vorlesung machen
# Agenda
> Bullets
- [ ] Die letzte Veranstaltung fast ohne Code - ab nächsten Mal geht es los
- [ ] Die Geschichte von GPUs und GPU Programmierung
- [ ] OpenGL , WebGL

# Wo fangen wir an?
> Timeline, vielleicht animiert?
> Finger
- [ ] Am Anfang zählten wir höchstwahrscheinlich an den Fingern ab
> Big numbers
- [ ] Dann kam Papier und viel größere Zahlen
> Calculator
- [ ] Dann ein Maschine die für einen Rechnen konnte.
      Man gibt ihr Zahlen und eine Operation und sie führt eine Rechenoperation durch. Nice
> Calculator State
- [ ] Der nächste Schritt war das Vorhalten von "State", was es erlaubte Maschinen nicht nur einzelne Rechenoperationen durchzuführen, sondern die Ergebnisse zu speichern und wieder zu verwenden.
> Self Modification
- [ ] Noch cooler: der gespeicherte State konnte beeinflussen welche Rechenoperationen als nächstes ausgeführt wurden. Damit wurden die ersten Programmierer geboren. (Bild von Steinzeit Programmierer,)
> Caveman Programmer
- [ ] Vielleicht noch kurz erwähnen, dass die ersten Programmierer Frauen waren die die Sekretärinnenarbeit übernommen haben die Berechnungen der Mathematiker in Computersprache zu übersetzen.
> First actual programmer

# State
- [ ] Kurzer Einwurf hier, weil ich im Laufe dieser Veranstaltung immer wieder darauf kommen werde: das Konzept von "State" ist super wichtig im Programmieren
> Draw: State
- [ ] State ist alles das, was den derzeitigen Zustand des Programs ausmacht. Wenn man zwei identische Computer hat, und den gesamten State von einer Maschine zur anderen überträgt, hat man zwei exakte Kopien des Programs, die theoretisch in alle Ewigkeit gleich ablaufen werden.
> State Transfer
- [ ] Es mag trivial erscheinen, sobald sie das erste Mal `int x = 1;` geschrieben haben hatten Sie State erzeugt. Aber gerade die Tatsache das State einfach so passiert, ist eine große Hürde es ernst zu nehmen.
- [ ] State bringt Komplexität. 
- [ ] Objekt-Orientiertes Programmieren ist ein Ansatz State zu verkapsulieren, andere Ansätze sind Funktionales Programmieren, bei dem sämtlicher State innerhalb der Funktion lebt.
- [ ] Ich will gar nicht zu weit abschweifen, aber hören Sie am besten jedes Mal kurz auf, wenn ich "State" sage. Höchstwahrscheinlich ist es wichtig.
- [ ] Wir kommen später noch auf "State Machines" zu sprechen.

# CPU
> Caveman Programmer
- [ ] Aber wieder zurück zu unserem ersten Programmierer 
> Hier ein Bild zeichnen von einem Förderband. Der Prozessor ist in der Mitte, links kommen Daten rein, rechts raus. Der Prozessor hat vor sich einen Stapel Boxen die er bearbeiten kann.
- [ ] Wir haben als eine Maschine mit einem Speicher (ob Arbeitsspeicher, Festplatte oder CPU Register, für die Profis unter Ihnen, ist für das Konzept egal)
- [ ] und einem Prozessor, der Rechenoperationen durchführen kann.
- [ ] Links haben wir Eingabegeräte wie Maus und Tastatur oder eine Netzwerkkarte und rechts Ausgabegeräte wie eine Bildschirm oder Lautsprecher
- [ ] Der Prozessor sitzt in der Mitte meiner Zeichnung, sehr passen für etwas das Central Processing Unit genannt wird.
- [ ] Die CPU liest eine Anweisung aus dem Speicher und führt sie dann aus. Meist schreibt sie auch wieder zurück in den Speicher, muss aber nicht. Dann liest sie die nächste Anweisung und immer so weiter.
- [ ] Man kann es auch "Linear Computing" nennen weil die Anzahl der ausgeführten Operationen linear mit der Zeit steigt.
- [ ] Mit der Zeit wurden die CPUs immer schneller, führten immer mehr Operationen pro Sekunde aus und alle waren glücklich.

# Terminal
> Zuse Z3
- [ ] Der erste Computer, & [Zuse Z3](https://de.m.wikipedia.org/wiki/Zuse_Z3) wog eine Tonne, und benutze ein Lampenfeld um Ergebnisse an den User zu melden
> Teleprinter
- [ ] Es dauerte nicht lange bis man auf die Idee kam den Computer zu kombinieren mit dem damals schon existierenden & Teleprintern. Im Grunde genommen bediente der Rechner eine automatische Schreibmaschine als Output.
- [ ] Die Art der Bilder war denkbar einfach: der Bildschirm wurde aufgeteilt in gleichmäßige Rechtecke, und jedes Rechteck stellte 0-1 Buchstaben da. (Zeichne ein Gitter)
> Punchcard
- [ ] [Angeblich](https://stackoverflow.com/questions/4651012/why-is-the-default-terminal-width-80-characters) wurde die Auflösung 640 Pixeln in der Breite gewählt, weil Lochkarten 80 Spalten breit waren. (80 characters a 8 pixel wide).
> Terminal
- [ ] Das heißt also, selbst auf einem "hochaufgelösten" Bildschirm von 640x350 (siehe [IBM EGA](https://en.wikipedia.org/wiki/Enhanced_Graphics_Adapter)) Pixeln, musste bei einer Buchstabengröße von 8x8 Pixeln (siehe [The Oldschool PC Font Resource](https://int10h.org/oldschool-pc-fonts/fontlist/font?ibm_ega_8x8)) nur `80x43=3440` bytes aufgewandt werden um den gesamten Inhalt eines Bildschirms zu speichern, etwas weniger als 3.4kib. 
> Draw Grid with characters and illustrate how the text flows
- [ ] Natürlich können ASCII Charaktere nicht direkt auf den Bildschirm gezeichnet werden, aber die Buchstaben zu rendern ist denkbar einfach: man benutzt den ASCII code direkt als Offset in einen Speicherblock, schnappt sich die nächsten 8x8 bits (8 bytes) und "blitted" (siehe [Blitter](https://en.m.wikipedia.org/wiki/Blitter)) sie direkt in den Screenbuffer.
- [ ] Der Screenbuffer ist der Teil im Speicher der vom Monitor gelesen wird um ein Signal zu erzeugen. Da das Bild Schwarz-Weiß ist, genügt ein einzelnes Bit pro Pixel, bei einer Auflösung von 640x350 also etwas weniger als 28.4kib. Schon eine Hausnummer zu der Zeit.offset der ersten Zeile angibt (eine Zeile ist genau `80*8*8/8=640`bytes lang).
- [ ] Aber zum Glück mussten nicht jedesmal die gesamten 28kib angefasst werden wenn der Inhalt vom Bildschirm geupdated wird. Weil schon geschriebene Zeilen nicht mehr änderbar waren und Zeilen nach oben hin "vom Bildschirmrand fielen" konnte man den Screenbuffer als sogenannter "[Ringbuffer](https://en.m.wikipedia.org/wiki/Circular_buffer)" implementieren, also als ein Array mit fester Größe und einem Index in das Array, das den offset der ersten Zeile angibt (eine Zeile ist genau `80*8*8/8=640`bytes lang).
- [ ] Wenn eine neue Zeile hinzugefügt wird, überschreibt sie einfach die aktuelle Zeile und der Pointer wandert zur nächsten.
- [ ] Wenn beim Lesen des Speichers oder beim Update des Pointers das Ende des Speicherbereichs erreicht wird, springt man einfach wieder an den Anfang weiter.
- [ ] Lange Rede, kurzer Sinn: diese Art der Bildschirmausgabe war einfach zu erreichen mit einfachsten Mitteln.
- [ ] Sie fragen sich vielleicht, warum ich so sehr auf diese alten Art von UI herum reite. Wie wir gleich sehen werden, gibt es eine überraschende Parallele zwischen Text in einem Terminal und moderner 3D Grafik. Außerdem ist das was dazwischen kommt nicht mehr so interessant: Computer erlaubten den Programmen direkt in den Renderbuffer zu schreiben, die Auflösung wurde größer und es kam Farbe dazu. Wenn ein Programm Pixel direkt zeichnen wollte, bleib es ihm selbst überlassen, wie und was es da zeichnet.
# Polygone
> Draw: Cube and update the drawing as we take it apart
- [ ] Jetzt wo wir wissen, wie man ein Terminal zeichnet, machen wir uns kurz mal Gedanken, wie man 3D Grafik zeichnet. Nehmen wir diesen Würfel (der sich am besten dreht)
> Vielleicht als Frage an die Studierenden hier
- [ ] Zerlegen wir den Würfel mal in seine Einzelteile, also Dinge die unabhängig voneinander gezeichnet werden können. 
- [ ] Er hat 6 Seiten die alle unabhängig voneinander gezeichnet werden. Jede Seite hat 1 Fläche, 4 Kanten und 4 Ecken. Geht es noch einfacher?
- [ ] Ja, jede Seite besteht ihrerseits aus 2 Dreiecken. Jedes Dreieck hat 1 Fläche, 3 Kanten und 3 Ecken. Beide Dreiecke teilen sich je 2 von den Ecken und eine Kante, aber das ist eine Frage wie man sie abspeichert. Letzendlich macht es null Unterschied ob man die beiden Ecken separat abspeichert oder nicht - solange ihre Coordinaten gleich sind, ist es die gleiche Ecke.
      Können wir das Dreieck noch weiter vereinfachen?  
- [ ] Nein, jede Fläche mit weniger als 3 Ecken ist eine Linie. Und die Oberfläche eine Linie ist immer null. Man kann "dicke" Linien zeichnen, aber wenn eine Software das macht, dann zeichnet Sie in Wirklichkeit wieder lange Rechtecke. 
- [ ] "Polygon" ist eigentlich ein Oberbegriff, weil er jede Fläche die an mehr als 2 Punkten angrenzt beschreibt, in OpenGL wird der mathematisch korrektere Begriff "Triangle" verwendet, weil die Tatsache dass es genau 3 Punkte sind schon relevant ist.  
> Mesh
- [ ] Meshes werden so genannt weil sie aussehen wie ein Model aus Chicken Wire, wie z.B. beim Theaterbau. Typischerweise werden Meshes dargestellt als ob sie aus Vier-, nicht Dreiecken bestehen würden, aber das ist der Tatsache geschuldet, dass das händische Modelling um einiges einfacher ist mit Vierecken. Insbesondere wenn das Model später verformt werden soll.
- [ ] Es gibt keine runden Flächen in einem Mesh, wenn man Rundungen darstellen möchte, muss man halt dafür sorgen, dass die Polygone klein genug sind um keine sichtbaren Kanten im Profil zu generieren.
> Chicken Wire

# 3D Grafik (endlich)
- [ ] Okay, also so wie die Buchstaben das grundlegende Element des Terminals sind, sind Polygone das grundlegende Element von Meshes, also für normale 3D Grafik (es gibt noch andere Methoden, aber die sind alle komplexer).
      So wie wir im Terminal alle Buchstaben einzeln zeichnen konnten und das Gesamtergebnis dann korrekt war, so können wir in 3D einfach alle Dreiecke einzeln zeichnen und das Gesamtergebnis ist ebenfalls korrekt. (Vielleicht mit Asterisk: wir brauchen noch irgendeine Lösung um die Flächen in der Tiefe zu ordnen, aber dazu kommen wir noch)
- [ ] WIe zeichnet man also ein einzelnes Dreieck in 3D? Beginnin wir mir der simplen Frage, ob ein Pixel unter einem Dreieck liegt oder nicht
> BIld von Dreieck über einem Pixel-Raster
- [ ] Man hat drei 3D Koordinaten. Aber die dritte Dimension können wir auf einem 2D BIldschirm eh nicht abbilden ... Das erste was wir also machen müssen ist das 3D Dreieck auf eine 2D Fläche zu projizieren. Stellen Sie sich vor, wir würden eine Taschenlampe auf ein Dreieck richten, das vor einer großen Wand schwebt. Den Schatten den das Dreieck wirft ist die Projektion.
      Das machen wir mit Mathe, aber erst in 2 bis 3 Vorlesungen, heute gibt es noch genug zu tun.
 - [ ] Jetzt haben wir also ein zweidimensionales Dreieck auf einem 2D-Grid aus Pixeln. Wieder die Frage: wie stellen wir fest, ob ein Pixel unter dem Dreieck liegt, oder nicht?
 - [ ] Wir könnten aufwendig berechnen, wie viel Fläche des Pixels unter dem Dreieck liegt. Aber das ist aufwendig und hat viele Edge-cases die man abdecken muss. Stattdessen sagt man einfach, dass der Pixel vollständig ausgefüllt ist, wenn der Mittelpunkt (der [Centroid](https://en.wikipedia.org/wiki/Centroid)) im Dreieck liegt.
 - [ ] Interessanterweise ist es vergleichsweise günstig zu testen ob ein Punkt auf einer 2D Ebene innerhalb oder außerhalb eines Dreiecks liegt (siehe SO Anwort [hier](https://math.stackexchange.com/a/51459)). Angeblich ist es so viel schneller als alle Alternativen Antworten, dass einem geraten wird einfach eine "Narrow Bounding Box" um das Dreieck zu legen und einfach alle Punkte zu testen.
 - [ ] Soweit so gut. Am Ende dieses Schrittes haben wir ein BIld auf dem jedem PIxel 0-1 Triangle zugeordnet ist. Wir ignorieren hierbei explizit die Möglichkeit von half-transparenten Triangles und Multisampling, was zu Transparenz an den Rändern der Triangles führen würde. Keine Transparenz.
 - [ ] Noch sind wir aber nicht fertig. Die 6 Flächen des Würfels zeigen eine unterschiedliche Augenanzahl an sagen wir also einfach mal, dass sie unterschiedliche Texturen haben (kann ich das Wort Textur hier schon verwenden?). Außerdem zeigen sie in unterschiedliche Richtungen und sind je nach Umgebung anders beleuchtet. 
 - [ ] Was ich damit sagen will ist, dass es nicht damit getan ist zu gucken ob ein Pixel von einem Triangle überlagert wird, man muss auch noch eine Extra-Funktion ausführen um den Farbwert des Pixels zu bekommen. 
 - [ ] Jetzt hat man das Finale Bild vom Würfel.

# GPUs
> Neue Folie, draw both bullet points
 - [ ] Wir haben jetzt einen Eindruck davon, was alles getan werden muss um ein 3D Bild zu zeichnen. Hier noch einmal die schnelle Zusammenfassung.
	 1. Für jedes Triangle brauchen wir alle Pixel, die dem Dreieck zugewiesen sind
	 2. Für jeden Pixel brauchen wir einen Funktionsaufruf um den Farbwert zu bekommen
- [ ] Dummerweise sind beide Schritte auch noch Loops die stark abhängig vom Aufbau der Szene sind, je mehr Dreiecke es gibt desto länger braucht Schritt 1, je mehr Fläche im BIld gefüllt ist, desto länger braucht Schritt 2.
- [ ] im Klaren Text bedeutet dies also das für jeden Update des Bildschirms mindestens so viele Funktionen Aufrufe nötig sind wie Pixel dargestellt werden. Und das jedes Mal wenn ein neues Bild berechnet wird. Und das auf Hardware von 1970. Kein Wunder also, dass etwas besseres her musste.
- [ ] ... und das neben dem, was der Computer eigentlich machen sollte. Zum Beispiel den Game state updaten.
- [ ] Selbst moderne CPUs kommen da schnell an ihre Grenzen, insbesondere weil man für jeden Frame in einer Echtzeit-Anwendung nur ein stark begrenztes Zeitbudget hat (~16m bei einem 60 Hz Spiel).
- [ ] Damals ging das natürlich gar nicht. Es gab zwar Erfolge 3D Grafik auch auf der CPU zu berechnen, doch es wurde schnell klar, dass lineares computing allein hier nicht helfen würde.
      Was also tun?
- [ ] Beide Schritte sind essentiell "Loops" in denen jede Iteration unabhängig vom Rest berechnet werden kann.
- [ ] Anstatt einen Prozessor damit zu betrauen alle Triangles nacheinander zu platzieren, könnte man eigentlich auch zwei CPUs benutzen und würde auf einen schlag doppelt so viel Durchsatz machen. Oder 4 für den vierfachen Durchsatz ... oder 8 etc.
- [ ] Schnell kommt man in Sphären, wo die Leistung des einzelnen Prozessors gar nicht mehr so ausschlaggebend ist für den Durchsatz, weil einfach so viel Arbeit parallel passiert. Und so entstanden die ersten GPUs - "Graphics Processing Unit". 
- [ ] Ich sprach bei der CPU Mal über "lineares computing". Das hier im Gegensatz ist "parallel" computing. 
> RTX3070 closed / open
- [ ] Eine Nvidia GeForce RTX 3070 zum Beispiel hat eine durchschnittliche Geschwindigkeit von 1.5 GHz. Im Vergleich zu einem modernen CPU Kern ist das ungefähr ein drittel der Geschwindigkeit - im besten Falle. Aller Wahrscheinlichkeit steht die CPU in einem wahren Vergleich der reinen Geschwindigkeit noch deutlich besser da, durch caching, preemptive execution etc. Aber egal,  sagen wir halt das ein GPU Kern nur ein zehntel so schnell ist wie ein CPU Kern. Selbst diese Differenz in clock speed wird mehr als wett gemacht durch die schiere Anzahl von Kernen. Bei der RTX 3070 sind es 5888 - und bei den modernsten Karten noch fast drei mal mehr.
- [ ] Beim Rechnen auf der GPU kommt also alles auf throughput an. Nicht execution speed, sondern die Menge an Berechnungen die ausgeführt werden. Alle Designmerkmale von OpenGL und anderen GPU Apis lassen sich auf diese grundlegende Eigenschaft zurück führen.

# OpenGL
- [ ] Wir sind schon fast bei WebGL angekommen, aber noch befinden wir uns in der weiten Vergangenheit
- [ ] Zu diesem Zeitpunkt sind GPUs komplett neu und die Verbindung zwischen dem "klassischen" Computer und dieser neuartigen Grafikkarte ist komplett unterspezifiziert
- [ ] Wie immer gibt es vereinzelnde Produkte von großen Firmen, die versuchen eigene Standards zu setzen. Wenn man eine Grafikkarte von Firma X hat, muss man deren Devkit verwenden um sie zu programmieren. Wenn man stattdessen eine Grafikkarte von Firma Y hat ... dann gibt's halt keine GPU Beschleunigung. Oder natürlich, man bezahlt seine Programmierer dafür für die Schnittstellen _beider_ Firmen zu unterstützen. Ein Beispiel hiervor ist die bekannte "Voodoo" Grafikkarte, mit der [Glide API](https://en.wikipedia.org/wiki/Glide_(API))
> Voodoo
- [ ] Das ist natürlich nicht tragbar. Also fingen die gewieften Programmierer an eine _gemeinsame_ Schnittstelle zu entwickeln, mit deren Hilfe man alle existierenden GPUs programmieren sollen könnte, und die offen genug ist um auch zukünftige Generationen, von potentiellen neuen Firmen zu unterstützen.
- [ ] Khronos (Zitat von https://www.khronos.org/about/)
    >  The Khronos Group is an open, non-profit, member-driven consortium of over 150 industry-leading companies creating advanced, royalty-free interoperability standards for 3D graphics, augmented and virtual reality, parallel programming, vision acceleration and machine learning.
- [ ] OpenGL entwickelte sich über die Jahre stark weiter. Inzwischen gibt es OpenGL 4.6 (Stand 2023)
- [ ] Mit OpenGL 3.0 gab es einen Bruch in dem API Design. Davor gab es die sogenannte "Fixed Function Pipeline", in der viel Schritte, die man heutzutage mit frei programmierbaren Funktionen (Shader) abbilden würde, als Teil der OpenGL API definiert waren, z.B. die Positionierung der Kamera, oder das Zeichnen von Punkten und Linien.
- [ ] während die alten, oder "legacy" OpenGL Funktionen von neueren Standards immer noch unterstützt werden, so sind sie oft nicht mehr zeitgemäß und sollten vermieden werden. Das bedeutet auch, dass sie potentiell weniger performant sind. Wenn Sie in einem online Tutorial irgendetwas mit `GL_BEGIN` lesen, ist das ein gutes Zeichen dafür, dass Sie sich ein anderes Tutorial finden sollten. Ich werde nicht weiter darauf eingehen, weil das nur verwirrend wäre. Für mehr Infos: https://www.khronos.org/opengl/wiki/Legacy_OpenGL

# WebGL
diagram here
- [ ] WebGL ist ein Derivat von OpenGL, bzw. OpenGL ES, seinerseits einer simplizierten Form von OpenGL3.x die eingeführt wurde um Anwendungen speziell für mobile Endgeräte und Computer mit weniger starken Grafikkarten zu schreiben.
- [ ] Wir verwenden sogar schon WebGL 2, einem Derivat von OpenGL ES 3.2, das mehr und modernere Funktionen unterstützt. Es kam 2017 raus und ist die modernste Web API für 3D Grafik. 
- [ ] Es gibt auch noch einen weiteren Standard, WebGPU, der allderings noch in der Entwicklung ist und im Augenblick von nicht so vielen Browsern unterstützt wird. Firefox auf Linux zum Beispiel noch nicht. Außerdem ist dieser Standard nicht speziell auf grafische Anwendungen ausgerichtet sondern General GPU Computing. Das macht den Einstieg in Programmierung für Grafik eventuell schwieriger als notwendig.
- [ ] WebGL(2) braucht ein canvas element um auf einer Webseite platziert zu werden.
- [ ] https://www.khronos.org/webgl/wiki/

