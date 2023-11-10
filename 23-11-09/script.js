////////////////////////////////////////////////////////////////////////////////
// START OF BOILERPLATE CODE ///////////////////////////////////////////////////

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

function onMouseDrag(callback)
{
    canvas.addEventListener('mousedown', () =>
    {
        canvas.addEventListener('mousemove', callback)
        canvas.addEventListener('mouseup', () =>
        {
            canvas.removeEventListener('mousemove', callback)
        }, { once: true })
    })
}

function onMouseWheel(callback)
{
    canvas.addEventListener('wheel', callback)
}

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
// START OF LIBRARY CODE ///////////////////////////////////////////////////////

// Math ------------------------------------------------------------------------

const epsilon = 0.000001
const vec3 = {
    zero: () => [0, 0, 0],
    scale: (out, s) => { out[0] *= s; out[1] *= s; out[2] *= s; return out },
    length: (v) => Math.hypot(v[0], v[1], v[2]),
    normalize: (out) =>
    {
        const len = vec3.length(out)
        return len ? vec3.scale(out, 1 / len) : out
    },
    transformMat4: (out, m) =>
    {
        const x = out[0], y = out[1], z = out[2]
        out[0] = x * m[0] + y * m[4] + z * m[8] + m[12]
        out[1] = x * m[1] + y * m[5] + z * m[9] + m[13]
        out[2] = x * m[2] + y * m[6] + z * m[10] + m[14]
        return out
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

// 3D Primitives ---------------------------------------------------------------

function createSphereAttributes(radius, latitudeBands, longitudeBands)
{
    const buffer = []
    for (let lat = 0; lat <= latitudeBands; lat++) {
        const theta = lat * Math.PI / latitudeBands
        const sinTheta = Math.sin(theta)
        const cosTheta = Math.cos(theta)
        for (let lon = 0; lon <= longitudeBands; lon++) {
            const phi = lon * 2 * Math.PI / longitudeBands
            const x = Math.cos(phi) * sinTheta
            const y = cosTheta
            const z = Math.sin(phi) * sinTheta
            const u = 1. - (lon / longitudeBands)
            const v = lat / latitudeBands
            buffer.push(radius * x, radius * y, radius * z) // position
            buffer.push(x, y, z)                            // normals
            buffer.push(u, v)                               // texture coords
        }
    }
    return buffer
}
function createSphereIndices(latitudeBands, longitudeBands)
{
    const buffer = []
    for (let lat = 0; lat < latitudeBands; lat++) {
        for (let lon = 0; lon < longitudeBands; lon++) {
            const first = (lat * (longitudeBands + 1)) + lon
            const second = first + longitudeBands + 1
            buffer.push(first, first + 1, second)
            buffer.push(second, first + 1, second + 1)
        }
    }
    return buffer
}

function createUnitBoxAttributes()
{
    return [
        -1, -1, -1, // 0
        +1, -1, -1, // 1
        +1, +1, -1, // 2
        -1, +1, -1, // 3
        -1, -1, +1, // 4
        +1, -1, +1, // 5
        +1, +1, +1, // 6
        -1, +1, +1, // 7
    ]
}

function createUnitBoxIndices()
{
    return [
        4, 5, 6, 4, 6, 7, // front
        1, 0, 3, 1, 3, 2, // back
        7, 6, 2, 7, 2, 3, // top
        0, 1, 5, 0, 5, 4, // bottom
        5, 1, 2, 5, 2, 6, // right
        0, 4, 7, 0, 7, 3, // left
    ]
}

// END OF LIBRARY CODE /////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// Shader //////////////////////////////////////////////////////////////////////

const vertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform mat3 u_normalMatrix;

    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    out vec3 f_worldPos;
    out vec3 f_normal;
    out vec2 f_texCoord;

    void main() {
        f_worldPos = vec3(u_modelMatrix * vec4(a_pos, 1.0));
        f_normal = u_normalMatrix * a_normal;
        f_texCoord = a_texCoord;
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`

const fragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;
    uniform sampler2D u_texAmbient;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;

    in vec3 f_worldPos;
    in vec3 f_normal;
    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {

        // texture
        vec3 texAmbient = texture(u_texAmbient, f_texCoord).rgb;
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;

        // ambient
        vec3 ambient = max(vec3(u_ambient), texAmbient) * texDiffuse;

        // diffuse
        vec3 normal = normalize(f_normal);
        vec3 lightDir = normalize(u_lightPos - f_worldPos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(u_viewPos - f_worldPos);
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // color
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

// Skybox Shader ///////////////////////////////////////////////////////////////

const skyVertexShaderSource = `#version 300 es
    precision highp float;

    uniform mat3 u_viewRotationMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;

    out vec3 f_texCoord;

    void main() {
        // Use the local position of the vertex as texture coordinate.
        f_texCoord = a_pos;

        // By setting Z == W, we ensure that the vertex is projected onto the
        // far plane, which is exactly what we want for the background.
        vec4 ndcPos = u_projectionMatrix * inverse(mat4(u_viewRotationMatrix)) * vec4(a_pos, 1.0);
        gl_Position = ndcPos.xyww;
    }
`

const skyFragmentShaderSource = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        // The fragment color is simply the color of the skybox at the given
        // texture coordinate (local coordinate) of the fragment on the cube.
        FragColor = texture(u_skybox, f_texCoord);
    }
`

// Create the Vertex Shader
const skyVertexShader = gl.createShader(gl.VERTEX_SHADER)
gl.shaderSource(skyVertexShader, skyVertexShaderSource)
gl.compileShader(skyVertexShader)

// Create the Fragment Shader
const skyFragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
gl.shaderSource(skyFragmentShader, skyFragmentShaderSource)
gl.compileShader(skyFragmentShader)

// Link the two into a single Shader Program
const skyShaderProgram = gl.createProgram()
gl.attachShader(skyShaderProgram, skyVertexShader)
gl.attachShader(skyShaderProgram, skyFragmentShader)
gl.linkProgram(skyShaderProgram)

// Data ////////////////////////////////////////////////////////////////////////

const sphereVao = gl.createVertexArray()
gl.bindVertexArray(sphereVao)

// Create the vertex attribute buffer
const sphereAttributes = createSphereAttributes(.9, 64, 64)
const vertexAttributes = new Float32Array(sphereAttributes)
const attributeBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer)
gl.bufferData(gl.ARRAY_BUFFER, vertexAttributes, gl.STATIC_DRAW)

// Create the index buffer
const sphereIndices = createSphereIndices(64, 64)
const faceIndices = new Uint16Array(sphereIndices)
const indexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, faceIndices, gl.STATIC_DRAW)

// Define the attribute buffer layout
const vertexAttribute = gl.getAttribLocation(shaderProgram, 'a_pos')
gl.enableVertexAttribArray(vertexAttribute)
gl.vertexAttribPointer(
    vertexAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    32,       // stride
    0,        // offset
)
const normalAttribute = gl.getAttribLocation(shaderProgram, 'a_normal')
gl.enableVertexAttribArray(normalAttribute)
gl.vertexAttribPointer(
    normalAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    32,       // stride
    12,       // offset
)
const texCoordAttribute = gl.getAttribLocation(shaderProgram, 'a_texCoord')
gl.enableVertexAttribArray(texCoordAttribute)
gl.vertexAttribPointer(
    texCoordAttribute,
    2,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    32,       // stride
    24,       // offset
)

gl.bindVertexArray(null)
gl.bindBuffer(gl.ARRAY_BUFFER, null)
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

// Skybox Data /////////////////////////////////////////////////////////////////

const skyVao = gl.createVertexArray()
gl.bindVertexArray(skyVao)

const skyAttributes = createUnitBoxAttributes()
const skyVertexAttributes = new Float32Array(skyAttributes)
const skyAttributeBuffer = gl.createBuffer()
gl.bindBuffer(gl.ARRAY_BUFFER, skyAttributeBuffer)
gl.bufferData(gl.ARRAY_BUFFER, skyVertexAttributes, gl.STATIC_DRAW)

const skyIndices = createUnitBoxIndices()
const skyFaceIndices = new Uint16Array(skyIndices)
const skyIndexBuffer = gl.createBuffer()
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIndexBuffer)
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, skyFaceIndices, gl.STATIC_DRAW)

// Define the attribute buffer layout
const skyPosAttribute = gl.getAttribLocation(skyShaderProgram, 'a_pos')
gl.enableVertexAttribArray(skyPosAttribute)
gl.vertexAttribPointer(
    skyPosAttribute,
    3,        // numComponents
    gl.FLOAT, // type
    false,    // normalize
    12,       // stride
    0,        // offset
)

gl.bindVertexArray(null)
gl.bindBuffer(gl.ARRAY_BUFFER, null)
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null)

// Textures ////////////////////////////////////////////////////////////////////

const WIP_TEXTURE_UNIT = gl.TEXTURE0 + gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) - 1

const textures = [gl.createTexture(), gl.createTexture(), gl.createTexture()]
const [ambientTexture, diffuseTexture, specularTexture] = textures

const anisotropyExtension = gl.getExtension("EXT_texture_filter_anisotropic")
const maxAnisotropy = anisotropyExtension ? gl.getParameter(anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : null

const placeholderPixel = new Uint8Array([0, 0, 0, 255])
const textureUrls = [
    'Earth_Ambient.avif',
    'Earth_Diffuse.avif',
    'Earth_Specular.avif',
]

textures.forEach((texture, index) =>
{
    gl.activeTexture(WIP_TEXTURE_UNIT)
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholderPixel)

    let image = new Image()
    image.onload = () =>
    {
        gl.activeTexture(WIP_TEXTURE_UNIT)
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D,
            0,                  // level
            gl.RGBA,            // internal format
            gl.RGBA,            // (source) format
            gl.UNSIGNED_BYTE,   // data type
            image)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

        if (maxAnisotropy !== null) {
            gl.texParameterf(gl.TEXTURE_2D, anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT, maxAnisotropy)
        }

        gl.bindTexture(gl.TEXTURE_2D, null)
        image = null
    }
    image.src = textureUrls[index]
    gl.bindTexture(gl.TEXTURE_2D, null)
})

// Skybox Texture //////////////////////////////////////////////////////////////

const skyUrls = [ // order: right, left, top, bottom, front, back
    'Skybox_Right.avif',
    'Skybox_Left.avif',
    'Skybox_Top.avif',
    'Skybox_Bottom.avif',
    'Skybox_Front.avif',
    'Skybox_Back.avif',
]

const skyTexture = gl.createTexture()
let skyTexturesLoaded = 0
gl.activeTexture(WIP_TEXTURE_UNIT)
gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTexture)
for (let i = 0; i < skyUrls.length; i++) {
    gl.texImage2D(
        gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, // face
        0,                                  // level
        gl.RGBA,                            // internal format
        1,                                  // width
        1,                                  // height
        0,                                  // border (must be zero)
        gl.RGBA,                            // (source) format
        gl.UNSIGNED_BYTE,                   // data type
        placeholderPixel,                   // data (will be set later)
    )

    let image = new Image()
    image.onload = () =>
    {
        const index = i
        gl.activeTexture(WIP_TEXTURE_UNIT)
        gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTexture)
        gl.texImage2D(
            gl.TEXTURE_CUBE_MAP_POSITIVE_X + index, // face
            0,                                      // level
            gl.RGB,                                 // internal format
            gl.RGB,                                 // (source) format
            gl.UNSIGNED_BYTE,                       // data type
            image,                                  // data
        )
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)

        gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)
        ++skyTexturesLoaded
        image = null
    }
    image.src = skyUrls[i]
}
gl.bindTexture(gl.TEXTURE_CUBE_MAP, null)

// Uniforms ////////////////////////////////////////////////////////////////////

// Constants

const projectionMatrix = new Float32Array(mat4.perspective(Math.PI / 4, 1, 0.1, 10))

gl.useProgram(shaderProgram)
gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_ambient"), 0.02)
gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_specular"), 0.6)
gl.uniform1f(gl.getUniformLocation(shaderProgram, "u_shininess"), 64)
gl.uniform3fv(gl.getUniformLocation(shaderProgram, "u_lightPos"), [0, 0, 5])
gl.uniform3fv(gl.getUniformLocation(shaderProgram, "u_lightColor"), [1, 1, 1])
gl.uniform1i(gl.getUniformLocation(shaderProgram, "u_texAmbient"), 0)
gl.uniform1i(gl.getUniformLocation(shaderProgram, "u_texDiffuse"), 1)
gl.uniform1i(gl.getUniformLocation(shaderProgram, "u_texSpecular"), 2)
gl.uniformMatrix4fv(
    gl.getUniformLocation(shaderProgram, "u_projectionMatrix"), false,
    projectionMatrix)
gl.useProgram(null)

gl.useProgram(skyShaderProgram)
gl.uniformMatrix4fv(
    gl.getUniformLocation(skyShaderProgram, "u_projectionMatrix"), false,
    projectionMatrix)
gl.uniform1i(gl.getUniformLocation(skyShaderProgram, "u_skybox"), 0)
gl.useProgram(null)

// Dynamic

const modelMatrixUniform = gl.getUniformLocation(shaderProgram, "u_modelMatrix")
const normalMatrixUniform = gl.getUniformLocation(shaderProgram, "u_normalMatrix")
const viewMatrixUniform = gl.getUniformLocation(shaderProgram, "u_viewMatrix")
const viewPosUniform = gl.getUniformLocation(shaderProgram, "u_viewPos")

const skyRotationUniform = gl.getUniformLocation(skyShaderProgram, "u_viewRotationMatrix")
const skyProjectionUniform = gl.getUniformLocation(skyShaderProgram, "u_projectionMatrix")

// Rendering ///////////////////////////////////////////////////////////////////

// Runtime variables
let viewDist = 2.5
let viewPan = 0
let viewTilt = 0
const modelMatrix = new Float32Array(16)
const normalMatrix = new Float32Array(9)
let viewMatrix = new Float32Array(16)
let viewRotationMatrix = new Float32Array(9)

// Ensure all textures are bound correctly
gl.activeTexture(gl.TEXTURE0 + 0)
gl.bindTexture(gl.TEXTURE_2D, ambientTexture)
gl.bindTexture(gl.TEXTURE_CUBE_MAP, skyTexture)
gl.activeTexture(gl.TEXTURE0 + 1)
gl.bindTexture(gl.TEXTURE_2D, diffuseTexture)
gl.activeTexture(gl.TEXTURE0 + 2)
gl.bindTexture(gl.TEXTURE_2D, specularTexture)

function renderLoop(time)
{
    // Update the model- and normal matrix
    let modelMat = mat4.identity()
    mat4.multiply(modelMat, mat4.fromRotation(0.0002 * time, [0, 1, 0]))
    modelMatrix.set(modelMat)
    normalMatrix.set(mat3.fromMat4(mat4.transpose(mat4.invert(modelMat))))

    // Update the view position and -matrix
    let viewMat = mat4.identity()
    mat4.multiply(viewMat, mat4.fromRotation(viewPan, [0, 1, 0]))
    mat4.multiply(viewMat, mat4.fromRotation(viewTilt, [1, 0, 0]))
    viewRotationMatrix.set(mat3.fromMat4(viewMat))
    mat4.multiply(viewMat, mat4.fromTranslation([0, 0, viewDist]))

    const viewPos = vec3.transformMat4(vec3.zero(), viewMat)
    viewMatrix.set(mat4.invert(viewMat))

    // Clear the renderbuffers before drawing.
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Draw the scene.

    // Skybox ------------------------------------------------------------------

    if (skyTexturesLoaded === 6) {
        // Enable the vertex array object
        gl.bindVertexArray(skyVao)

        // Set up the Shader and -Uniforms
        gl.useProgram(skyShaderProgram)
        gl.uniformMatrix3fv(skyRotationUniform, false, viewRotationMatrix)

        // Do not cull faces as we are looking from inside the cube.
        gl.disable(gl.CULL_FACE)

        // Draw the world.
        gl.drawElements(
            gl.TRIANGLES,           // primitive type
            skyIndices.length,   // vertex count
            gl.UNSIGNED_SHORT,      // type of indices
            0,                      // offset
        )
    }

    // World -------------------------------------------------------------------

    // Enable the vertex array object
    gl.bindVertexArray(sphereVao)

    // Set up the Shader and -Uniforms
    gl.useProgram(shaderProgram)
    gl.uniformMatrix4fv(viewMatrixUniform, false, viewMatrix)
    gl.uniform3fv(viewPosUniform, viewPos)
    gl.uniformMatrix4fv(modelMatrixUniform, false, modelMatrix)
    gl.uniformMatrix3fv(normalMatrixUniform, false, normalMatrix)

    // Cull back-facing faces of the sphere
    gl.enable(gl.CULL_FACE)

    // Draw the world.
    gl.drawElements(
        gl.TRIANGLES,           // primitive type
        sphereIndices.length,   // vertex count
        gl.UNSIGNED_SHORT,      // type of indices
        0                       // offset
    )

    // Teardown State
    gl.useProgram(null)
    gl.bindVertexArray(null)
}
setRenderLoop(renderLoop)

onMouseDrag((e) =>
{
    viewPan += e.movementX * -.01
    viewTilt += e.movementY * -.01
})

onMouseWheel((e) =>
{
    viewDist = Math.max(1.5, Math.min(10, viewDist * (1 + Math.sign(e.deltaY) * 0.2)))
})