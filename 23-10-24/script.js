////////////////////////////////////////////////////////////////////////////////
// BOILERPLATE START

// Get the WebGL context
const canvas = document.getElementById('canvas')
const gl = canvas.getContext('webgl2')

// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0]
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1
})

// Basic render loop manager.
function setRenderLoop(callback)
{
    function renderLoop(time)
    {
        if (setRenderLoop._callback !== null) {
            setRenderLoop._callback(time)
            requestAnimationFrame(renderLoop)
        }
    }
    setRenderLoop._callback = callback
    requestAnimationFrame(renderLoop)
}
setRenderLoop._callback = null

// BOILERPLATE END
////////////////////////////////////////////////////////////////////////////////
// Shader //////////////////////////////////////////////////////////////////////

const vertexShaderSource = `#version 300 es
    precision highp float; // Calculate the varying outputs with high precision

    in vec2 a_pos;
    in vec3 a_color;

    out vec3 f_color;

    void main() {
         gl_Position = vec4(a_pos, 0.0, 1.0);
         f_color = a_color;
    }
`

const fragmentShaderSource = `#version 300 es
    precision mediump float; // Fragment shader calculations require less precision.

    uniform float u_time;
    uniform vec2 u_cursor;

    in vec3 f_color;

    out vec4 FragColor;

    void main() {
        vec2 fragCoord = (gl_FragCoord.xy / 512.0) * 2.0 - vec2(1.0);
        vec2 delta = fragCoord - u_cursor;
        float dist = 0.4 / dot(delta, delta);
        FragColor = vec4(
          mod(f_color + (vec3(u_time) + vec3(0.25, 0.5, 0.75)), 1.0) * min(1.0, max(dist, 0.0)),
          1.0);
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
    -1., -1., 1, 0, 0,
    +1., -1., 0, 1, 0,
    +1., +1., 0, 0, 1,
    -1., +1., 1, 1, 1,
])

// Create the position buffer
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)

const faceIndices = new Uint16Array([
    0, 1, 2, // first triangle
    0, 2, 3, // second triangle
])

// Create the index buffer
const indexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW)

// Attribute Mapping ///////////////////////////////////////////////////////////

// Map the contents of the buffer to the vertex shader
const vertexAttribute = gl.getAttribLocation(shaderProgram, 'a_pos')
gl.enableVertexAttribArray(vertexAttribute)
gl.vertexAttribPointer(
    vertexAttribute,
    2,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    20,       // stride
    0         // offset
)

const colorAttribute = gl.getAttribLocation(shaderProgram, 'a_color')
gl.enableVertexAttribArray(colorAttribute)
gl.vertexAttribPointer(
    colorAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    20,       // stride
    8         // offset
)

// Uniforms ////////////////////////////////////////////////////////////////////

const timeUniform = gl.getUniformLocation(shaderProgram, "u_time")
const cursorUniform = gl.getUniformLocation(shaderProgram, "u_cursor")

// Rendering ///////////////////////////////////////////////////////////////////

function renderLoop(time)
{
    gl.uniform1f(timeUniform, time / 5000)
    gl.uniform2f(cursorUniform, cursor[0], cursor[1])

    // Draw the scene.
    gl.drawElements(
        gl.TRIANGLES,       // primitive type
        faceIndices.length, // vertex count
        gl.UNSIGNED_SHORT,  // type of indices
        0                   // offset
    )
}
setRenderLoop(renderLoop)