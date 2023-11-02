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

// Math ////////////////////////////////////////////////////////////////////////

const epsilon = 0.000001
const vec3 = {
    scale: (out, s) => { out[0] *= s; out[1] *= s; out[2] *= s; return out },
    length: (v) => Math.hypot(v[0], v[1], v[2]),
    normalize: (out) =>
    {
        const len = vec3.length(out)
        return len ? vec3.scale(out, 1 / len) : out
    },
}
const mat3 = {
    fromMat4: (m) => ([
        m[0], m[1], m[2],
        m[4], m[5], m[6],
        m[8], m[9], m[10]]),
}
const mat4 = {
    identity: () => ([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1]),
    fromTranslation: (v) =>
    {
        return [
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            v[0], v[1], v[2], 1]
    },
    fromRotation: (rad, axis) =>
    {
        let x = axis[0], y = axis[1], z = axis[2]
        let len = Math.hypot(x, y, z)
        if (len < epsilon) return mat4.identity()
        len = 1 / len
        x *= len, y *= len, z *= len
        const s = Math.sin(rad)
        const c = Math.cos(rad)
        const t = 1 - c
        return [
            x * x * t + c, y * x * t + z * s, z * x * t - y * s, 0,
            x * y * t - z * s, y * y * t + c, z * y * t + x * s, 0,
            x * z * t + y * s, y * z * t - x * s, z * z * t + c, 0,
            0, 0, 0, 1]
    },
    multiply: (out, m) =>
    {
        const a00 = out[0], a01 = out[1], a02 = out[2], a03 = out[3]
        const a10 = out[4], a11 = out[5], a12 = out[6], a13 = out[7]
        const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11]
        const a30 = out[12], a31 = out[13], a32 = out[14], a33 = out[15]
        let b0 = m[0], b1 = m[1], b2 = m[2], b3 = m[3]
        out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
        out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
        out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
        out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
        b0 = m[4], b1 = m[5], b2 = m[6], b3 = m[7]
        out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
        out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
        out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
        out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
        b0 = m[8], b1 = m[9], b2 = m[10], b3 = m[11]
        out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
        out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
        out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
        out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
        b0 = m[12], b1 = m[13], b2 = m[14], b3 = m[15]
        out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30
        out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31
        out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32
        out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33
        return out
    },
    perspective: (fov, aspect, near, far) =>
    {
        const f = 1 / Math.tan(fov / 2)
        let o33, o43
        if (far !== null && far !== Infinity) {
            const nf = 1 / (near - far)
            o33 = (far + near) * nf
            o43 = 2 * far * near * nf
        } else {
            o33 = -1
            o43 = -2 * near
        }
        return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, o33, -1,
            0, 0, o43, 0]
    },
    transpose: (out) =>
    {
        const a01 = out[1], a02 = out[2], a03 = out[3]
        const a12 = out[6], a13 = out[7]
        const a23 = out[11]
        out[1] = out[4]
        out[2] = out[8]
        out[3] = out[12]
        out[4] = a01
        out[6] = out[9]
        out[7] = out[13]
        out[8] = a02
        out[9] = a12
        out[11] = out[14]
        out[12] = a03
        out[13] = a13
        out[14] = a23
        return out
    },
    invert: (out) =>
    {
        const a00 = out[0], a01 = out[1], a02 = out[2], a03 = out[3]
        const a10 = out[4], a11 = out[5], a12 = out[6], a13 = out[7]
        const a20 = out[8], a21 = out[9], a22 = out[10], a23 = out[11]
        const a30 = out[12], a31 = out[13], a32 = out[14], a33 = out[15]
        const b00 = a00 * a11 - a01 * a10
        const b01 = a00 * a12 - a02 * a10
        const b02 = a00 * a13 - a03 * a10
        const b03 = a01 * a12 - a02 * a11
        const b04 = a01 * a13 - a03 * a11
        const b05 = a02 * a13 - a03 * a12
        const b06 = a20 * a31 - a21 * a30
        const b07 = a20 * a32 - a22 * a30
        const b08 = a20 * a33 - a23 * a30
        const b09 = a21 * a32 - a22 * a31
        const b10 = a21 * a33 - a23 * a31
        const b11 = a22 * a33 - a23 * a32
        let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
        if (!det) {
            return null
        }
        det = 1 / det
        out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det
        out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
        out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det
        out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
        out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det
        out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
        out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det
        out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
        out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det
        out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
        out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det
        out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
        out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det
        out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
        out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det
        out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det
        return out
    }
}

// Shader //////////////////////////////////////////////////////////////////////

const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_color;
    in vec3 a_normal;

    out vec3 f_color;
    out vec3 f_worldPos;
    out vec3 f_normal;

    void main() {
        // The world position is calculated by multiplying the model matrix with the
        // vertex position in model space.
        // The model matrix is a 4x4 matrix, which is why we need to expand the 3D
        // vertex position to a 4D vector by adding a 1.0 as the 4th component.
        // After the transformation, we can discard the 4th component again.
        f_worldPos = vec3(u_modelMatrix * vec4(a_pos, 1));

        // The final vertex position is calculated by multiplying the world position
        // with view matrix first and projection matrix second.
        // You can think of it as first moving the world so that the camera is at
        // the center, then rotating the world so that the camera is looking down
        // the negative z-axis.
        // The projection matrix then transforms the 3D world to 2D screen space.
        gl_Position = u_projectionMatrix * u_viewMatrix * vec4(f_worldPos, 1.0);

        // Normal vectors are perpendicular to the surface of the model, and must be
        // transformed differently than the vertex position.
        // Instead, they are transformed by the inverse transpose of the model
        // matrix which we pre-calculate in the application, so we don't have to do
        // it for every vertex in the shader.
        // The normal matrix is a 3x3 matrix, because it only rotates and scales
        // the normal vectors, but doesn't translate them.
        // This is the same as calling:
        //  f_normal = transpose(inverse(mat3(u_modelMatrix))) * a_normal;
        // inside the vertex shader.
        f_normal = u_normalMatrix * a_normal;

        // The color is passed through unchanged.
        f_color = a_color;
    }
`

const fragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;
    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;

    in vec3 f_color;
    in vec3 f_worldPos;
    in vec3 f_normal;

    out vec4 FragColor;

    void main() {
        // ambient
        vec3 ambient = u_ambient * f_color;

        // diffuse
        vec3 normal = normalize(f_normal);
        vec3 lightDir = normalize(u_lightPos - f_worldPos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * f_color;

        // specular
        vec3 viewDir = normalize(u_viewPos - f_worldPos);
#if 0   // phong
        vec3 reflectDir = reflect(-lightDir, normal);
        float specularIntensity = dot(viewDir, reflectDir);
#else   // blinn
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = dot(normal, halfWay);
#endif
        specularIntensity = pow(max(specularIntensity, 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * u_lightColor;
        FragColor = vec4(ambient + diffuse + specular, 1.0);
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
if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw new Error(`Unable to initialize shader program "${name}":${gl.getProgramInfoLog(shaderProgram)}`
        + `\nVertex Shader log: ${gl.getShaderInfoLog(vertexShader)}`
        + `\nFragent Shader log: ${gl.getShaderInfoLog(fragmentShader)}`)
}
gl.useProgram(shaderProgram)

// Data ////////////////////////////////////////////////////////////////////////

const vertexPositions = new Float32Array([
    // Front face
    -.5, -.5, +.5, .6, .6, .6, 0, 0, 1,
    +.5, -.5, +.5, .6, .6, .6, 0, 0, 1,
    +.5, +.5, +.5, .6, .6, .6, 0, 0, 1,
    -.5, +.5, +.5, .6, .6, .6, 0, 0, 1,

    // Back face
    +.5, -.5, -.5, .6, .6, .6, 0, 0, -1,
    -.5, -.5, -.5, .6, .6, .6, 0, 0, -1,
    -.5, +.5, -.5, .6, .6, .6, 0, 0, -1,
    +.5, +.5, -.5, .6, .6, .6, 0, 0, -1,

    // Top face
    -.5, +.5, +.5, .6, .6, .6, 0, 1, 0,
    +.5, +.5, +.5, .6, .6, .6, 0, 1, 0,
    +.5, +.5, -.5, .6, .6, .6, 0, 1, 0,
    -.5, +.5, -.5, .6, .6, .6, 0, 1, 0,

    // Bottom face
    -.5, -.5, -.5, .6, .6, .6, 0, -1, 0,
    +.5, -.5, -.5, .6, .6, .6, 0, -1, 0,
    +.5, -.5, +.5, .6, .6, .6, 0, -1, 0,
    -.5, -.5, +.5, .6, .6, .6, 0, -1, 0,

    // Right face
    +.5, -.5, +.5, .6, .6, .6, 1, 0, 0,
    +.5, -.5, -.5, .6, .6, .6, 1, 0, 0,
    +.5, +.5, -.5, .6, .6, .6, 1, 0, 0,
    +.5, +.5, +.5, .6, .6, .6, 1, 0, 0,

    // Left face
    -.5, -.5, -.5, .6, .6, .6, -1, 0, 0,
    -.5, -.5, +.5, .6, .6, .6, -1, 0, 0,
    -.5, +.5, +.5, .6, .6, .6, -1, 0, 0,
    -.5, +.5, -.5, .6, .6, .6, -1, 0, 0,

])

// Create the position buffer
const positionBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexPositions, gl.STATIC_DRAW)

const faceIndices = new Uint16Array([
    0, 1, 2, 0, 2, 3,       // front
    4, 5, 6, 4, 6, 7,       // back
    8, 9, 10, 8, 10, 11,    // top
    12, 13, 14, 12, 14, 15, // bottom
    16, 17, 18, 16, 18, 19, // right
    20, 21, 22, 20, 22, 23, // left
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
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    36,       // stride
    0         // offset
)

const colorAttribute = gl.getAttribLocation(shaderProgram, 'a_color')
gl.enableVertexAttribArray(colorAttribute)
gl.vertexAttribPointer(
    colorAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    36,       // stride
    12        // offset
)

const normalAttribute = gl.getAttribLocation(shaderProgram, 'a_normal')
gl.enableVertexAttribArray(normalAttribute)
gl.vertexAttribPointer(
    normalAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    36,       // stride
    24        // offset
)

// Uniforms ////////////////////////////////////////////////////////////////////

// Constants

let lightPos = [0, 0, 1]
const lightColor = [1.0, 1.0, 1.0]
const viewPos = [0, 0, 2.5]
const ambient = 0.1
const specular = 0.35
const shininess = 64
const projection = mat4.perspective(Math.PI / 4, 1, 0.1, 10)

gl.uniform3fv(
    gl.getUniformLocation(shaderProgram, "u_lightPos"),
    lightPos)

gl.uniform3fv(
    gl.getUniformLocation(shaderProgram, "u_lightColor"),
    lightColor)

gl.uniform3fv(
    gl.getUniformLocation(shaderProgram, "u_viewPos"),
    viewPos)

gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "u_ambient"),
    ambient)

gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "u_specular"),
    specular)

gl.uniform1f(
    gl.getUniformLocation(shaderProgram, "u_shininess"),
    shininess)

gl.uniformMatrix4fv(
    gl.getUniformLocation(shaderProgram, "u_projectionMatrix"),
    false, new Float32Array(projection))

gl.uniformMatrix4fv(
    gl.getUniformLocation(shaderProgram, "u_viewMatrix"),
    false, new Float32Array(mat4.invert(mat4.fromTranslation(viewPos))))

// Dynamic


const modelMatrixUniform = gl.getUniformLocation(shaderProgram, "u_modelMatrix")
const modelMatrix = new Float32Array(16)

const normalMatrixUniform = gl.getUniformLocation(shaderProgram, "u_normalMatrix")
const normalMatrix = new Float32Array(9)

// Rendering ///////////////////////////////////////////////////////////////////

// gl.enable(gl.DEPTH_TEST)   // Enable depth testing.
gl.enable(gl.CULL_FACE)    // Enable (back-)face culling.

function renderLoop(time)
{
    // Update the model matrix every frame
    let mat = mat4.identity()
    mat4.multiply(mat, mat4.fromRotation(0.001 * time, [0, 1, 0]))
    // mat4.multiply(mat, mat4.fromRotation(0.0002 * time, [1, 0, 0]))
    mat4.multiply(mat, mat4.fromRotation(0.0004 * time, [0, 0, 1]))
    modelMatrix.set(mat)
    gl.uniformMatrix4fv(
        modelMatrixUniform,
        false, // has to be false
        modelMatrix)

    // Update the normal matrix every frame as well
    normalMatrix.set(mat3.fromMat4(mat4.transpose(mat4.invert(mat))))
    gl.uniformMatrix3fv(
        normalMatrixUniform,
        false, // has to be false
        normalMatrix)

    // Clear the renderbuffers before drawing.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    // Draw the scene.
    gl.drawElements(
        gl.TRIANGLES,       // primitive type
        faceIndices.length, // vertex count
        gl.UNSIGNED_SHORT,  // type of indices
        0                   // offset
    )
}
setRenderLoop(renderLoop)