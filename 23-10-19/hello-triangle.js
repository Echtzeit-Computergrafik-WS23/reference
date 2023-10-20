// Shader //////////////////////////////////////////////////////////////////////

const vertexShaderSource = `
	attribute vec2 vertexPos;
	void main() {
 		gl_Position = vec4(vertexPos, 0.0, 1.0);
	}
`

const fragmentShaderSource = `
	void main() {
		gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
	}
`

// Create the Vertex Shader
const vertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(vertexShader, vertexShaderSource)
gl.compileShader(vertexShader)

// Create the Fragment Shader
const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(fragmentShader, fragmentShaderSource)
gl.compileShader(fragmentShader)

// Link the two into a single Shader Program
const shaderProgram = gl.createProgram()
gl.attachShader(shaderProgram, vertexShader)
gl.attachShader(shaderProgram, fragmentShader)
gl.linkProgram(shaderProgram)
gl.useProgram(shaderProgram)

// Data ////////////////////////////////////////////////////////////////////////

const vertexPositions = new Float32Array([
	-.5, -.5,
	+.5, -.5,
	+.0, +.5,
])

// Create the position buffer
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)

const faceIndices = new Uint16Array([
	0, 1, 2,
])

// Create the index buffer
const indexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW)

// Attribute Mapping ///////////////////////////////////////////////////////////

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

// Rendering ///////////////////////////////////////////////////////////////////

// Draw the scene.
gl.drawElements(
	gl.TRIANGLES,       // primitive type
	3,                  // vertex count
	gl.UNSIGNED_SHORT,  // type of indices
	0                   // offset
)

