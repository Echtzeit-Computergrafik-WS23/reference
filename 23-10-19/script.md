# Die wichtigste Theorie in Kurzform
> Slide mit den Drei wichtigsten Theorie-Punkten über WebGL und einem memorablen Bild:
- [ ] 1. WebGL ist eine **State Machine** - alle Funktionen laufen im Kontext der vorhergehenden Funktionen ab.
- [ ] Wenn Sie sagen, dass die "clearColor" jetzt grün ist und sie dann ein `gl.clear()` aufrufen, wird der Bildschirm grün. Wenn Sie nun die "clearColor" auf rot setzen, wir der gleiche Aufruf den Bildschirm plötzlich rot machen.
- [ ] Das macht es schwer den Überblick über den _State_ zu behalten, weshalb die erste Sache die man natürlicherweise mit WebGL programmiert Funktionen sind ... um nicht mehr mit OpenGL direkt arbeiten zu müssen.
- [ ] 2. WebGL trennt klar zwischen dem vorgehaltenen State den Sie verwalten, (der **Client** State) und dem State der auf der GPU liegt (dem **Server** State).
- [ ] Es ist zwar möglich nachzufragen, z.B. welche Textur gerade aktiviert ist (welcher State die State Machine hat), aber das ist Funktionalität die im Treiber, also auf der CPU abläuft. 
- [ ] Das Daten, die auf der GPU errechnet werden dann wieder zurück an den Hauptprozessor geschickt werden ist eine neue Entwicklung und eher relevant für GPGPU (General Purpose Graphics Processing Unit) Programmierung wie OpenCL, oder Vulkan / WebGPU.
- [ ] 3. WebGL ist dafür da **parallel** ablaufende Funktionen zu steuern.
- [ ] Parallel bedeutet die _selbe_ Funktion auf _unterschiedlichen_ input Daten.
      Effektiv bedeutet dass, das jede Interaktion mit der GPU so aussieht:
	- [ ] 1. Die auszuführende _Funktion_ wird für die GPU kompiliert und hochgeladen
	- [ ] 2. Die benötigten _Daten_ werden werden in den VRAM hochgeladen
	- [ ] 3. Die Funktion wird ausgeführt
	- [ ] 4. Das Resultat wird ausgelesen
	- [ ] ... Zurück zu Schritt 1 oder 2
# Konzeption (Daten)
> Ein Bild von einem Dreieck. Anstatt bullets erscheinen mehr und mehr Daten um das Dreieck herum. Das Dreieck kann ruhig squiggly sein, oder?
- [ ] Wir wollen ein Dreieck zeichnen.
- [ ] Um dies zu tun, brauchen wir die folgenden Daten:
	1. 3 Positionen in 2D
	2. Eine Farbe
	3. Ein "Viewport"
	4. Die Bildschirmauflösung
- [ ] Die Bildschirmauflösung ist etwas, das wir WebGL gleich am Anfang sagen müssen, wenn wir das `canvas` Element erstellen. 
	- [ ] An sich ist es kein Problem sie auch noch später zu ändern, aber es ist nicht etwas, wofür die API designed ist. 
	- [ ] Ich kann mir vorstellen, dass jede Änderung einen kompletten Reset auf GPU Seite nach sich zieht, es sollte also nicht zu häufig gemacht werden.
- [ ] Der Viewport, also der rechteckige Bereich aus dem unendlich großen 2D Raum, der am Ende auf den Bildschirm gezeichnet wird ist bei WebGL fest eingestellt: 
	- [ ] er geht auf beiden Achsen jeweils von -1 zu + 1 - da können wir nichts dran ändern.
- [ ] Die Farbe können wir uns frei aussuchen, ich nehme im Beispiel rot, also `(1, 0, 0, 1)` (mit voller opacity)
- [ ] Die Punkte sollten innerhalb des Viewports liegen und nicht alle auf einer Linie liegen, ansonsten können sie aber frei gewählt werden.
# Konzeption (Funktionen)
> Idealerweise hätten wir hier eine Slide mit ein paar verschieden farbige 3D Triangles vor einer Wand, um die man ein Bisschen die Kamera kreisen lassen kann.
> Auf Knopfdruck "splatten" die Triangles gegen die Wand und bilden die Coverage Map.
- [ ] Sie erinnern sich, wir sprachen schon einmal darüber welche Funktionen wir brauchen in  [[03 - A History of WebGL]]. 
	- [ ] Zunächst benötigen wir eine Funktion, um die Eckpunkte des Dreiecks in den Viewport zu projizieren.
	- [ ] Dann brauchen wir eigentlich eine Funktion pro Pixel um zu testen unter welchem Triangle (wenn überhaupt) er liegt
	- [ ] Und als letztes eine Funktion um die Farbe des Pixels zu bestimmen.
		- [ ] Je nachdem unter welchem Dreieck liegt, bekommt er eine andere Farbe.
		- [ ] Pixel die nicht unter einem Dreieck liegen werden nicht angefasst, behalten also ihre derzeitige Farbe.
- [ ] Die zweite Funktion, das Testen ob ein Pixel unter einem Dreieck liegt, ist jedes Mal die selbe. Es gibt keine Situation wir es besser machen könnten als auf die Art und Weise wie die GPU sie implementiert, deshalb wird dieser Schritt immer automatisch für uns gemacht.
- [ ] Die erste Funktion ist für unser Beispiel trivial.
	- [ ]  Die Vertices sind perfekt platziert, so wie wir sie an die GPU übergeben, deshalb ist diese Funktion effektiv ein `noop`. 
	- [ ] Wir müssen sie trotzdem schreiben, es gibt keine "Default"-Funktion, die OpenGL für uns bereitstellt.
- [ ] Die zweite Funktion ist ebenfalls maximal einfach. 
	- [ ] Wir wollen einfach, dass jeder Pixel der unter dem Dreieck liegt rot ist. 
	- [ ] Das heißt, die Funktion gibt immer die gleiche Farbei zurück.
# Shader Programme (1/2)
> Ein Bild der OpenGL Pipeline als Treppe von links oben nach rechts oben, der user-provided State oben, neu erzeugter State rechts vom Pipeline Schritt
- [ ] OpenGL war immer konzipiert als API für 3D Grafik, und wie gerade ausgeführt, sind die groben Schritte um 3D Grafik auf den Bildschirm zu zeichnen immer die selben.
- [ ] Deshalb funktioniert das Rendern in OpenGL auch immer gleich - man nennt es auch die "Render Pipeline"
- [ ] Das "Was" ist immer das selbe, das einzige was sich ändert ist das "Wie".
- [ ] Und auch das nicht für alle Schritte, sondern nur für einige, bei WebGL diese beiden.
	- [ ] Der linke nennt sich "Vertex Shader", weil er auf Vertex Informationen arbeitet
	- [ ] Der recht heißt "Fragment Shader". Wenn Sie "Fragment" hören, denken Sie "Pixel" und sie liegen zu 99% richtig.
	- [ ] Der einzige Grund warum das Wort "Fragment" verwendet wurde, ist weil die eigentliche Farbe des Pixels, der am Ende auf den Bildschirm gezeichnet wird nicht ausschließlich von der Ausgabe dieses Shaders abhängt, sondern auch von der Farbe die schon im Renderbuffer vorhanden ist - zum Beispiel wenn die Farbe die aus dem Fragment Shader kommt, halb-transparent ist.
- [ ] Jeder Schritt wird übrigens "Shader" genannt, was historisch bedingt aber nicht unbedingt akkurat ist.
	- [ ] Letztendlich bedeutet das Wort "Shader" ja, wie etwas "schattiert" wird, bzw. wie ein Punkt einer Oberfläche aussieht.
	- [ ] [Wikipedia](https://en.wikipedia.org/wiki/Shader) sagt dazu:
	      > In [computer graphics](https://en.wikipedia.org/wiki/Computer_graphics "Computer graphics"), a **shader** is a [computer program](https://en.wikipedia.org/wiki/Computer_program "Computer program") that calculates the appropriate levels of [light](https://en.wikipedia.org/wiki/Light "Light"), [darkness](https://en.wikipedia.org/wiki/Darkness "Darkness"), and [color](https://en.wikipedia.org/wiki/Color "Color") during the [rendering](https://en.wikipedia.org/wiki/Rendering_(computer_graphics) "Rendering (computer graphics)") of a [3D scene](https://en.wikipedia.org/wiki/3D_scene "3D scene")—a process known as _[shading](https://en.wikipedia.org/wiki/Shading "Shading")_.
	 - [ ] Das trifft auf den letzten Schritt zu, aber nicht auf den ersten.
	 - [ ] Trotzdem wird das Wort verwendet für alle Art von code, den man auf die GPU lädt. 
 - [ ] Was diese Zeichnung allerdings nicht illustriert sind die Schnittstellen zwischen unseren  Shadern.
# Shader Programme (2/2) 
> Ein Vertex Shader auf der linken Seite, mit ein paar Ausgängen rechts die ein wenig wie Puzzlestücke aussehen. Auf der rechten Seite ist ein Fragment Shader mit passendem Profil.
- [ ] In dieser Abbildung fehlt die Funktion um Pixel zu generieren. Wir können Sie eh nicht beeinflussen und wird uns so auch nicht weiter beschäftigen.
- [ ] Was wir aber beeinflussen können, sind die Daten die von dem Vertex Shader an den Fragment Shader fließen.
- [ ] Wir kennen schon den einen Output der auf jeden Fall gesetzt werden muss: die Position des Vertex im OpenGL Viewport (sie erinnern sich, -1 bis 1 auf beiden Achsen)
- [ ] Darüber hinaus kann der Vertex Shader aber auch noch beliebige andere Informationen weiter reichen.
	- [ ] Eine Farbe, die benutzt wird um die Fläche einzufärben
	- [ ] Die Normale des Vertices, also die Richtung in der er deutet.
	- [ ] Eine UV-Koordinate die bestimmt wie eine Textur auf das Dreieck gespannt wird
	- [ ] etc.
- [ ] Damit der Fragment Shader mit den Informationen etwas anfangen kann, muss er die passenden Inputs haben.
> Das Vertex Shader Puzzlestück wird ersetzt durch ein Stück das etwas höher ist und zusätzliche outputs bereitstellt.
- [ ] Es ist möglich, dass der Vertex Shader noch zusätzliche Outputs hat, also welche die der Fragment Shader nicht als Input entgegen nimmt.
- [ ] Aber alle Inputs die existieren müssen bedient werden.
- [ ] Es passen also nicht alle Shader zueinander.
- [ ] Damit zwei Shader nebeneinander in der Pipeline leben können, müssen sie gelinked werden.
	- [ ] Wenn Sie schon mal mit C++ oder einer anderen kompilierten Sprache gearbeitet haben, wird Ihnen das ein Begriff sein.
	- [ ] Verschiedene Programm-Bausteine werden zu einem gemeinsamen Programm verlinkt, das am Ende als ganzes ausgeführt werden kann.
	- [ ] Neben dem Test, dass die einzelnen Programmstücke auch zueinander passen, bietet das Linking die Möglichkeit Optimierungen anzubringen, die nicht möglich wären, wenn man sich die Stücke einzeln anguckt. 
	- [ ] Wenn z.B. der Fragment Shader einen Output des Vertex Shaders gar nicht erst verwendet, kann beim Linking sämtlicher Code aus dem Vertex Shader entfernt werden, der nur zur Berechnung des ignorierten outputs benötigt wird.
- [ ] Sowohl das Kompilieren der einzelnen Bausteine, als auch das Linken des Programms findet auf der Client-Seite statt.
	- [ ] Das heißt, so wie wir unsere Daten im Client Code vorbereiten, die dann auf die GPU geladen werden, so müssen wir auch unser Programm (oder unsere Programme) im Client Code vorbereiten um sie anschließend auf die GPU zu schieben.
# GLSL
> Ich glaube worauf es hinaus läuft sind das GLSL ES Logo + eine Liste an Bullet points für jede Eigenschaft von GLSL
- [ ] Etwas, das ich bis hierhin geflissentlich ignoriert habe ist die Frage, wie genau man einen Shader überhaupt definiert. 
- [ ] WebGL läuft zwar im Browser und wird mit JavaScript bedient, aber die GPU hat keinen eingebauten JavaScript interpreter.
- [ ] Stattdessen haben wir GLSL, die [**OpenGL Shading Language**](https://en.wikipedia.org/wiki/OpenGL_Shading_Language)
	- [ ] Eine an C angelehnte, (sehr) strikt typisierte und kompilierte Sprache
	- [ ] Korrekterweise muss man sagen, dass der Dialekt, der in in WebGL verwendet wird **OpenGL ES Shading Language** heißt, was als **GLSL ES** abgekürzt wird (..oder laut Wikipedia **ESSL**, wobei ich das noch nie gesehen habe).
- [ ] Aber warum muss gleich eine neue Sprache her? Gibt es nicht schon genug?
	- [ ] Der Grund dafür ist, dass jede Sprache eine "Runtime" (Laufzeitumgebung) mit sich bringt, ob sie nun explizit oder implizit ist.
	- [ ] Java oder Python z.B. haben eine explizite Runtime. Es gibt ein extra Programm das ausgeführt wird um Java oder Pythoncode zu interpretieren und auszuführen. 
	- [ ] Aber auch C++ und selbst C haben versteckte (implizite) Runtimes, die abgestimmt sind auf die Programme die mit ihnen geschrieben werden und grundlegende Funktionalität bieten, um die man sich nicht selbst zu kümmern hat. In C++ wären dies z.B:
		- [ ] Memory Allocation
		- [ ] Virtual Functions
		- [ ] Name mangling
		- [ ] Exception handling
		- [ ] ...
- [ ] GLSL auf der anderen Seite hat bestimmte Eigenschaften, die für eine Ausführung auf einer GPU optimiert sind:
	- [ ] Auf der GPU wird der exakt selbe Code von hunderten Prozessoren parallel ausgeführt. Bloß auf unterschiedlichen Daten.
		- [ ] Und wenn ich sage "der selbe Code", dann meine ich dass jeder Prozessor zu jedem Zeitpunkt _exakt_ die selbe Berechnung vornimmt.
		- [ ] Denken Sie kurz mal darüber nach.
		- [ ] Was passiert wohl, wenn Sie ein `if` statement im Code haben, das manchmal wahr ist und manchmal falsch ... aber sie lassen den Code parallel auf hunderten Prozessoren laufen? Bei manchen ist die Condition `true`, bei anderen `false` ... aber alle Prozessoren müssen die exakt selben Schritte ausführen.
			- [ ] Die Antwort hier ist so einfach wie skandalös: Beide Code Paths werden von _allen_ Prozessoren ausgeführt, und je nachdem ob die Condition wahr oder falsch ist, wird das Ergebnis des einen branches wieder verworfen.
		- [ ] Das gleiche gilt auch für alle anderen branching operations, wie z.B. eine `while` Schleife.
		- [ ] Wenn die Schleife machmal 2, manchmal 3 und manchmal 100 Wiederholungen lang ist, dann gehen alle Prozessoren die Schleife 100 mal durch. 
	- [ ] Der Speicher wird nicht unterteilt in Stack & Heap ([source](https://gamedev.stackexchange.com/a/61262))
		- [ ] Grob gesagt gibt es in den meisten Programmiersprachen konzeptionell zwei verschiedene Programmbereiche, den "Heap" und den "Stack".
			- [ ] Der "Stack" beinhaltet den State aller Funktionen die gerade ausgeführt werden.
				- [ ] Wenn eine Funktion eine neue Funktion aufruft bevor sie selbst abgeschlossen ist, werden die Daten der neuen Funktion auf den Stack gelegt.
				- [ ] Wenn eine Funktion returned, wird sie komplett vom Stack entfernt.
				- [ ] In den allermeisten Fällen (ich glaube in C++ ist das sogar eine grundlegende Bedingung der Sprache) ist die Größe des Speicherplatzes auf dem Stack für eine Funktion bekannt und konstant. 
			- [ ] Der "Heap" auf der anderen Seite ist Speicherplatz der außerhalb von Funktionen existiert.
				- [ ] Er wird für Objekte mit dynamischer Größe verwendet, also Strings, Lists, Maps etc.
		- [ ] Stattdessen gibt es eine begrenzte Anzahl an Registern die verwendet werden können.
			- [ ] Verschiedene Variablen können das selbe Register belegen, wenn garantiert werden kann, dass beide niemals gleichzeitig existieren können, z.B. weil beide in unterschiedlichen Funktionen leben die sich einander nicht aufrufen
		- [ ] Die Abwesenheit eines Heaps bedeutet dies, das es in GLSL keine Datenstrukturen mit dynamischer Größe gibt. Arrays ja, aber nur mit konstanter und zur Compile Zeit bekannter Größen.
		- [ ] Die Abwesenheit von Stacks wiederum bedeutet, dass Rekursion nicht erlaubt ist.
	- [ ] Auf der "Haben" Seite, hat GLSL eine Reihe an Funktionen eingebaut, die es uns erlauben grafische Programmierung besonders effizient durchzuführen
		- [ ] Oftmals sind solche Funktionen sogar "in Hardware gegossen", also maximal Effizient auszuführen, wenn es geht sollte man sie, statt einer selbst gecodeten Lösung verwenden
		- [ ] z.B. `mix`, `smoothstep`, `normalize`, `inversesqrt`, `clamp`, `length`, `distance`, `dot`, `cross`, `reflect` oder `refract`
	- [ ] Außerdem bietet die Sprache neben normalen Typen wie `int` oder `float` auch viele Vector- und Matrix-Typen an, wie `vec3`, `ivec3`, `mat3` oder `mat3x4`.
		- [ ] Viele mathematischen Funktionen wie `abs`, `max`. `pow` oder `sin` nehmen nicht nur einen skalaren Parameter, sondern können auch direkt auf Vektoren ausgeführt werden.
- [ ] GLSL hat einen C-Style Preprozessor Schritt, mit dem man den Code mit Hilfe von "defines" manipulieren kann, bevor er kompiliert wird.
- [ ] Ich bin mir sicher, dass wir den ein oder anderen Punkt von dieser Liste später noch einmal wiederentdecken werden
# Der Vertex Shader
> Ab hier wird gecoded
- [ ] Der Code ist am Anfang der gleiche wie beim letzten Mal, aber diesmal gehe ich Schritt für Schritt durch.
- [ ] In der zweiten Slide hatte ich geschrieben dass jede Interaktion mit der GPU so aussieht:
	- [ ] 1. Die auszuführende _Funktion_ wird für die GPU kompiliert und hochgeladen
	- [ ] 2. Die benötigten _Daten_ werden werden in den VRAM hochgeladen
	- [ ] 3. Die Funktion wird ausgeführt
	- [ ] 4. Das Resultat wird ausgelesen
	- [ ] ... Zurück zu Schritt 1 oder 2
- [ ] Als erstes definieren wird also unsere Funktion, also das Shader Program.
- [ ] Das Shader Program besteht aus zwei Teilen: Vertex Shader und Fragment Shader, wir beginnen mit dem Vertex Shader.
```javascript
const vertexShaderSource = `
	attribute vec2 vertexPos;
	void main() {
	    gl_Position = vec4(vertexPos.x, vertexPos.y, 0.0, 1.0);
	}
`
```
- [ ] Wie schon in der Konzeption gesagt, macht dieser Shader nichts weiteres als eine Vertex Position als Input zu bekommen und sie in den eingebauten output `gl_Position` zu schreiben. 
- [ ] Wie Sie sehen, hat der Shader eine `main` Funktion, so wie man sie aus C und C++ kennt.
	- [ ] Diese Funktion muss existieren und sie muss `main` heißen und sie muss `void`, also nichts zurückgeben.
	- [ ] Ein explizites `return` statement am Ende der Funktion ist erlaubt, aber egal.
- [ ] Weiterhin sehen Sie, dass der Vertex Shader ein Input hat, ein sogenanntes "Attribut".
	- [ ] Ein Attribut ist ein Wert der aus einem Datenbuffer gelesen wird und der für jeden Aufruf des Shaders unterschiedlich ist.
	- [ ] Auf Datenbuffer kommen wir noch zu sprechen.
	- [ ] In diesem Fall wird der Vertex Shader genau 3 Mal ausgeführt, einmal pro Vertex, und bei jedem Aufruf ist der `vertexPos` Wert ein anderer.
- [ ] GLSL ist ja eine stark typisierte Sprache und der Typ von `gl_Position` ist `vec4`, weshalb wir die 2D Koordinaten aus dem input Attribut um zwei weitere Koordinaten erweitern müssen. Warum der vierte davon 1 ist, darüber sprechen wir noch genügend in der nächste Vorlesung.
- [ ] An Stelle von `vec4(...)` könnten wir auch schreiben:
  ```glsl
  gl_Position = vec4(vertexPos.xy, 0.0, 1.0);
  ```
    oder sogar ohne den "swizzle" am Ende:
  ```glsl
  gl_Position = vec4(vertexPos, 0.0, 1.0);
  ```
- [ ] Ganz wichtig dabei, die Semicolons am Ende jeder Zeile sind _nicht_ optional.
# Der Fragment Shader
- [ ] Der Fragment Shader ist ähnlich, aber noch einfacher:
```javascript
const fragmentShaderSource = `
	void main() {
		gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
	}
`
```
- [ ] Wir haben eine weitere `main` Funktion und eine "built-in" output variable, hier `gl_FragColor`, also die Farbe des Fragments.
- [ ] Wie `gl_Position` ist auch `gl_FragColor` ein `vec4`, braucht also 4 floating point Werte um initialisiert zu werden.
- [ ] In diesem Falle sind das RGBA Werte, also Rot, Grün, Blau und Alpha.
- [ ] Um die Farbe Rot zu bekommen, setzen wir den Rot Wert auf voll, Grün und Blau auf null und Alpha auf eins.
- [ ] Und das war's.
# Das Shader Program
- [ ] Um das Shader Program zu bauen, müssen wir zuerst beide Shader kompilieren und danach linken.
```javascript
// Create the Vertex Shader
const vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertexShader, vertexShaderSource)
gl.compileShader(vertexShader)
```
- [ ] Wir erstellen zuerst ein Shader Objekt mit `gl.createShader(gl.VERTEX_SHADER)`.
	- [ ] Wir müssen den Typ des Shaders direkt mitgeben und uns merken, das Objekt das zurück kommt hat keinerlei Informationen darüber, das es ist.
	- [ ] Wenn ihr das Objekt `vertexShader` loggt, also auf der Konsole ausgebt, bekomme ich in Firefox ein opaques `WebGLShader` angezeigt, ein Typ ohne Methoden oder Fields.
- [ ] Als nächstes laden wir mit `gl.shaderSource` den Shader Code hoch auf die GPU.
	- [ ] Diese Funktion ist wahrscheinlich ein bisschen mehr als ein reines String copy, da strings in JavaScript UTF-16 formatiert sind ([source](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String#utf-16_characters_unicode_code_points_and_grapheme_clusters)), während GLSL EL das UTF-8 Character Set verwendet wahrscheinlich([source](https://registry.khronos.org/OpenGL/specs/es/3.2/GLSL_ES_Specification_3.20.html#character-set))
	- [ ] In der Praxis sollte das keinen Unterschied machen.
- [ ] Und schließlich weisen wir den Treiber an den Shader zu kompilieren.
	- [ ] Idealerweise würden wir sofort im Anschluss prüfen, ob es beim Kompilieren einen Fehler gab, aber jetzt gerade, im ersten Beispiel, wollen wir uns noch nicht mit solchen Eventualitäten herumschlagen.
	- [ ] Das wird dann Ihre Hausaufgabe.
- [ ] In diesem Augenblick haben wir einen einzelnen Vertex Shader auf der GPU. Er ist kompiliert und sitzt einfach so herum.
- [ ] Um mit ihm etwas anfangen zu können, brauchen wir noch den zweiten, den Fragment Shader.
- [ ] Der Code ist fast identisch zu dem für den Vertex Shader:
```javascript
// Create the Fragment Shader
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragmentShader, fragmentShaderSource)
gl.compileShader(fragmentShader)
```
- [ ] Im letzten Schritt linken wir die beiden Shader in ein gemeinsames Programm.
```javascript
// Link the two into a single Shader Program
const shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)
```
- [ ] Ein Shader Program ist ein eigenständiges Objekt in WebGL
	- [ ] Das heißt, dass man den selben Shader in unterschiedliche Programme linken kann.
- [ ] Wir attachen beide Shader.
	- [ ] Die Reihenfolge ist dabei egal.
- [ ] Und schließlich linken wir das Shader Program. Wie das Kompilieren von den Shadern kann dieser Schritt auch fehlschlagen, und wir müssten uns um das Error Handling kümmern, aber das ignorieren wir hier iwdeder.
- [ ] Sobald ein Programm fertig gelinkt ist, verliert es alle Verbindung zu den Shadern aus den es entstanden ist, wir könnten `vertexShader` und `fragmentShader` also auch gleich wieder löschen und es würde nichts ändern.
- [ ] Als letzten Schritt sagen wir WebGL, dass es das Shader Program für alle folgenden Render benutzen soll.
	- [ ] Linken alleine reicht noch nicht aus.
# Die Vertex Positionen
- [ ] Wie in der Konzeption gezeigt, brauchen wir 3 Koordinaten a 2 Dimensionen um das Dreieck zu definieren, also 6 Zahlen.
```javascript
const vertexPositions = new Float32Array([
	-.5, -.5,
	+.5, -.5,
	+.0, +.5,
])
```
- [ ] Wir packen alle 6 Zahlen in ein Array, einen "Buffer", den wir dann an WebGL übergeben
- [ ] Wir können dafür kein standard JavaScript Array verwenden, sondern müssen den genauen Typ der Daten spezifizieren, der in dem Array abgespeichert wird.
- [ ] Das erlaubt WebGL einerseits zu wissen, wie groß der Buffer wird - andererseits kann der JavaScript garantieren, dass nichts anderes außer einem `float` Wert in dem Buffer liegen kann.
	- [ ] Das ist anders als normale JavaScript arrays, die keinerlei Beschränkungen über den Inhalt haben.
- [ ] Die Werte hier definieren uns unser Dreieck im Viewport um den Bereich -1 bis +1 auf beiden Achsen.
- [ ] Als nächstes müssen wir den Buffer auf die GPU hochladen.
```javascript
// Create the position buffer
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)
```
- [ ] Dafür erstellen wir uns zuerst einen generischen Buffer.
- [ ] Das Buffer Objekt das wir erhalten, hat keinerlei Informationen darüber was im Buffer liegt, wie groß er ist, was für einen Typ Daten er enthält oder sonstiges.
- [ ] Wir binden den Buffer in den `GL_ARRAY_BUFFER` target von WebGL.
	- [ ] Als State Machine hat WebGL mehrere "targets", die unterschiedliche Funktionen erfüllen.
	- [ ] Der `GL_ARRAY_BUFFER` Slot, laut [des offiziellen Wikis](https://www.khronos.org/opengl/wiki/Buffer_Object#General_use): _will be used as a source for vertex data._
	- [ ] Wir wollen damit den Wert von `vertexPos` im Vertex Shader füllen, das passt also gut
- [ ] Dann weisen wir WebGL an, den Inhalt des `vertexPosition` buffers in den Buffer hochzuladen, der gerade an das `ARRAY_BUFFER` target gebunden ist, also unser `positionBuffer`.
- [ ] Zusätzlich dazu geben wir WebGL noch den Hinweis `STATIC_DRAW` mit.
	- [ ] `STATIC` bedeutet, dass wir nicht damit rechnen, dass die Daten oft geändert werden
	- [ ] `DRAW` bedeutet, dass die Daten jedoch häufig von der GPU gelesen werden müssen, nämlich wann immer etwas gezeichnet wird.
	- [ ] Andere Hinweise wären z.B. `STREAM_READ` für Daten die häufig geändert und ausschließlich vom user ausgelesen werden, nicht von der GPU
	- [ ] Egal was man hier schreibt, alle Funktionen stehen einem weiterhin offen.
	- [ ] Es ist wirklich nur ein Hinweis in der Hoffnung, dass die GPU ihn nutzen kann um ihr Speicher besser zu organisieren. Die GPU ist erlaubt den Hinweis komplett zu ignorieren.
- [ ] Wir lassen den Buffer am `ARRAY_TARGET` gebunden, weil wir ja gleich unser Dreieck rendern wollen.
# Die Face Indices
- [ ] Im Augenblick haben wir drei Vertices um ein Dreieck zu zeichnen. Klingt logisch.
- [ ] Was ist aber, wenn wir ein Quadrat zeichnen wollen?
	- [ ] Die einfache Antwort wäre hier: "Dann brauchen wir 6 Vertices"
	- [ ] Und tatsächlich, OpenGL bietet diese Möglichkeit an.
	- [ ] Aber nur als Teil der veralteten Legacy Funktionalität
	- [ ] Heutzutage gibt es eine bessere Lösung: Face Indices
```javascript
const faceIndices = new Uint16Array([
	0, 1, 2,
])
```
- [ ] Sidenote: Ich habe nicht herausgefunden warum Dreiecke in Computergrafik "Face" genannt werden, wenn Sie eine Ahnung haben, lassen Sie es mich wissen
- [ ] Face Indices sind triplets, also immer ein Faktor von 3, wobei jede Zahl ein Index in den `ARRAY_BUFFER` darstellt. 
- [ ] Der Buffer in dem die Face Indices gespeichert werden, wird auch "Index Buffer" genannt.
- [ ] Wenn man einen Vertex für mehr als ein Face verwenden möchte,  benutzt man sein Index halt mehrfach.
- [ ] Für das Beispiel mit dem Quadrat bedeutet dies, das wir nur 4 Vertices brauchen, und dafür 6 Einträge in den viel kleineren Index Buffer
- [ ] In unserem jedoch Fall ist der Index buffer trivial: wir benutzen unsere 3 Vertices um genau ein Dreieck zu zeichnen
- [ ] Der Index buffer wird gespeichert als Array aus unsigned, 16 Bit weiten Integers.
	- [ ] Der Datentyp in C heißt "short", da er nur 2 Bytes weit ist, im Gegensatz zum normalen "int" der 4 und "long" der 8 Bytes weit ist.
	- [ ] Die höchste darstellbare Zahl in diesem Datentypen ist `2^16 - 1 = 65'535`.
	- [ ] Das bedeutet nicht, dass der Index Buffer kleiner sein muss als 65k, sondern dass wir mit `short` indices nur maximal 65k Vertices ansprechen können.
	- [ ] Falls wir mehr Vertices haben, brauchen wir mehr Präzision im Index Buffer.
- [ ] Das hochladen der Daten auf die GPU funktioniert genau so wie für den `ARRAY_BUFFER` auch, bloß kommen die Face Indices in ein eigens dafür vorgesehenen Target, den `ELEMENT_ARRAY_BUFFER`
	- [ ] [Das offizielle Wiki](https://www.khronos.org/opengl/wiki/Buffer_Object#General_use) schreibt: _The indices used for indexed rendering will be taken from the buffer object_
```javascript
// Create the index buffer
const indexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexBuffer, gl.STATIC_DRAW)
```
- [ ] Wie auch den `ARRAY_BUFFER` lassen wir auch diesen Buffer an sein target gebunden nachdem wir die Daten fertig  hochgeladen haben
- [ ] Wenn wir das Dreieck gleich zeichnen, muss WebGL Zugriff auf beide Buffer gleichzeitig haben.
# Die Attribute Pointer
- [ ] Wir haben die Daten, wir haben das Program. Fehlt nur noch eins:
- [ ] Das Mapping von Daten zu dem Program.
- [ ] Konkret, das mapping des `ARRAY_BUFFER`s zu den Attributen des Vertex Shaders.
- [ ] Sie erinnern sich, wir haben ein einziges Attribut, einen Input, in dem Vertex Shader.
- [ ] Es heißt "vertexPos" und ist vom Typ ein `vec2` , also 2 floats weit.
- [ ] Gleichzeitig haben wir unseren `positionBuffer` mit 3 mal 2 floats.
- [ ] Das passt soweit ganz gut. Aber das weiß WebGL noch nicht. 
```javascript
// Map the contents of the buffer to the vertex shader
const vertexAttribute = gl.getAttribLocation(shaderProgram, 'vertexPos')
gl.enableVertexAttribArray(vertexAttribute)
gl.vertexAttribPointer(
	vertexAttribute,
	2,        // numComponents
	gl.FLOAT, // type
	false,    // normalize
	0,        // stride
	0         // offset
)
```
- [ ] Als erstes holen wir uns die Position des Attributes aus dem Shader.
- [ ] Stellen sie sich die "Position" vor wie ein Port an einem Computer.
	- [ ] Im Detail ist das zwar noch etwas komplizierter, ein breites Attribut wie eine 4x4 Matrix kann mehrere Positionen einnehmen, aber das ignorieren wir hier mal.
- [ ] Nachdem wir also die Position (den Port) bekommen haben, müssen wir ihn noch öffnen.
	- [ ] Aus irgendeinem, mir unbekannten aber wahrscheinlich hoch-technischen Grund, sind alle Atribute Locations am Anfang disabled.
	- [ ] Damit die Daten im Shader ankommen, müssen wir sie also explizit enablen. 
- [ ] Der dritte Aufruf `vertexAttributePointer` ist schließlich der Ort, an dem wir WebGL genau erklären, wie es das `vertexPos` Attribute mit Daten aus dem `positionBuffer` zu füllen hat
	- [ ] Zuerst sagen wir, wie viele Komponenten das Attribut hat. Ein `vec2` hat 2
	- [ ] Als nächstes definieren wir den Datentyp, in unsrem Falle also `float`
	- [ ] Das `normalize` Argument können Sie ignorieren so lange wir floating point values verwenden, es sagt aus dass integrale Werte auf den floating point Wert 0-1 normalisiert werden sollen.
		- [ ] Keine Ahnung, ich hab es noch nie gebraucht
	- [ ] Stride und offset beschreiben wie sich das Attribute neben anderen Attributen im selben Buffer verhält
		- [ ] In unserem Fall gibt es nur ein Attribut, also sind beide Werte 0
		- [ ] Wir kommen darauf zurück, wenn es mehr als ein Attribut gibt
# Rendering
- [ ] Die `ARRAY_BUFFER` und `ELEMENT_ARRAY_BUFFER` sind gefüllt, die Shader sind kompiliert und das Program wird benutzt. Sogar die Vertex Attribute sind enabled - dann kann es ja losgehen!
```javascript
/// Draw the scene.
gl.drawElements(
    gl.TRIANGLES,       // primitive type
    3,                  // vertex count
    gl.UNSIGNED_SHORT,  // type of indices
    0                   // offset
)
```
- [ ] Der Drawcall ist nun vergleichsweise simpel.
- [ ] `drawElements` bedeutet, dass WebGL den Face Index Buffer verwenden soll um damit Faces zu zeichnen
	- [ ] Es gibt auch andere draw calls, einige davon sind veraltet, andere zu speziell und dritte, auf die wir noch zu sprechen kommen werden
- [ ] `TRIANGLES` ist das was wir zeichnen wollen
	- [ ] Es gäbe auch die Alternative `LINES` zu zeichnen, dazu müssten wir allerdings den Index Buffer und den nächsten Parameter anpassen (Index Buffer zu `0, 1, 1, 2, 2, 0`  und "vertex count" zu `6`)
	- [ ]  Oder Points, aber dafür müssten wir den Fragment Shader umschreiben.
- [ ] Der nächste Parameter ist die Anzahl von Indices die der Draw call verwenden soll, hier sind es 3.
- [ ] Der Datentyp eines Index' für uns also`SHORT
- [ ] Und zuletzt der Offset in den Index Buffer von denen an die 3 Indices gezählt werden.
	- [ ] Wir fangen am Anfang an, der offset is also 0
- [ ] Und damit haben wir unser erstes Dreieck gezeichnet!
# Hausaufgabe
Macht euch eure eigenen Shader load functions, and at least one geometry primitive function (maybe support a plane or cube function but we can't really do more at this point because we cannot rotate the camera yet)

