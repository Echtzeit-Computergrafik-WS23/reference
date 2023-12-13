////////////////////////////////////////////////////////////////////////////////
// START OF BOILERPLATE CODE ///////////////////////////////////////////////////

console.log('Hello, WebGL!');

// Get the WebGL context
const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl2');

// Add mouse move event handlers to the canvas to update the cursor[] array.
const cursor = [0, 0];
canvas.addEventListener('mousemove', (event) =>
{
    cursor[0] = (event.offsetX / canvas.width) * 2 - 1;
    cursor[1] = (event.offsetY / canvas.height) * -2 + 1;
});

function onMouseDrag(callback)
{
    canvas.addEventListener('pointerdown', () =>
    {
        const stopDrag = () =>
        {
            canvas.removeEventListener("pointermove", callback);
            canvas.removeEventListener("pointerup", stopDrag);
            canvas.removeEventListener("pointerleave", stopDrag);
        };

        canvas.addEventListener('pointermove', callback);
        canvas.addEventListener("pointerup", stopDrag, { once: true });
        canvas.addEventListener("pointerleave", stopDrag, { once: true });
    });
}

function onMouseWheel(callback)
{
    canvas.addEventListener('wheel', callback);
}

function onKeyDown(callback)
{
    canvas.addEventListener('keydown', callback);
}

function onKeyUp(callback)
{
    canvas.addEventListener('keyup', callback);
}

// Basic render loop manager.
function setRenderLoop(callback)
{
    function renderLoop(time)
    {
        if (setRenderLoop._callback !== null) {
            setRenderLoop._callback(time);
            requestAnimationFrame(renderLoop);
        }
    }
    setRenderLoop._callback = callback;
    requestAnimationFrame(renderLoop);
}
setRenderLoop._callback = null;

import glance from './js/glance.js';

// BOILERPLATE END
////////////////////////////////////////////////////////////////////////////////

const {
    vec3,
    mat3,
    mat4,
} = glance;

// =============================================================================
// Shader Code
// =============================================================================

const bulbVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    in vec3 a_pos;

    void main() {
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const bulbFragmentShader = `#version 300 es
    precision mediump float;

    out vec4 FragColor;

    void main() {
        FragColor = vec4(1.0);
    }
`;

const phongVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform vec3 u_lightPos;
    uniform vec3 u_viewPos;

    in mat4 a_modelMatrix;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec3 a_tangent;
    in mat3 a_normalMatrix;
    in vec2 a_texCoord;

    out vec3 f_worldPos;
    out vec3 f_lightPos;
    out vec3 f_viewPos;
    out vec2 f_texCoord;

    void main() {
        vec3 normal = a_normalMatrix * a_normal;
        vec3 tangent = a_normalMatrix * a_tangent;
        vec3 bitangent = cross(normal, tangent);
        mat3 tbn = transpose(mat3(tangent, bitangent, normal));

        // Transform world space coords to tangent space
        f_worldPos = tbn * vec3(a_modelMatrix * vec4(a_pos, 1.0));
        f_lightPos = tbn * u_lightPos;
        f_viewPos = tbn * u_viewPos;

        f_texCoord = a_texCoord;

        gl_Position = u_projectionMatrix * u_viewMatrix * a_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const phongFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;

    in vec3 f_worldPos;
    in vec3 f_lightPos;
    in vec3 f_viewPos;
    in vec2 f_texCoord;

    out vec4 FragColor;

    void main() {

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, f_texCoord).rgb;

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        vec3 normal = normalize(texNormal * (255./128.) - 1.0);
        vec3 lightDir = normalize(f_lightPos - f_worldPos);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(f_viewPos - f_worldPos);
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // color
        FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

// =============================================================================
// Constants
// =============================================================================

const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 14);

// Quad ------------------------------------------------------------------------

const phongShader = glance.buildShaderProgram(gl, "phong-shader", phongVertexShader, phongFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.15,
    u_shininess: 128,
    u_lightColor: [1, 1, 1],
    u_projectionMatrix: projectionMatrix,
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
});

const quadIBO = glance.createIndexBuffer(gl, glance.createPlaneIndices());

const quadABO = glance.createAttributeBuffer(gl, "quad-abo", glance.createPlaneAttributes(1, 1), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const tangentABO = glance.createAttributeBuffer(gl, "quad-tangent-abo",
    Array().concat(...Array(4).fill([1, 0, 0])),
    {
        a_tangent: { size: 3, type: gl.FLOAT },
    },
);

const quadXform = mat4.fromRotation(Math.PI / 2, [-1, 0, 0]);
const quadModelMatrix = mat3.fromMat4(quadXform);
const quadInstanceAttributes = new Float32Array([...quadXform, ...quadModelMatrix]);
const quadIABO = glance.createAttributeBuffer(gl, "quad-iabo", quadInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const quadVAO = glance.createVAO(
    gl,
    "quad-vao",
    quadIBO,
    glance.buildAttributeMap(phongShader, [quadABO, quadIABO, tangentABO]),
);
const quadTextureDiffuse = await glance.loadTextureNow(gl, "./img/Rockwall_Diffuse.jpg");
const quadTextureSpecular = await glance.loadTextureNow(gl, "./img/Rockwall_Specular.jpg");
const quadTextureNormal = await glance.loadTextureNow(gl, "./img/Rockwall_Normal.jpg");

// Bulb ------------------------------------------------------------------------

const bulbShader = glance.buildShaderProgram(gl, "bulb-shader", bulbVertexShader, bulbFragmentShader, {
    u_projectionMatrix: projectionMatrix,
});

const bulbIBO = glance.createIndexBuffer(gl, glance.createSphereIndices(5, 8));

const bulbABO = glance.createAttributeBuffer(gl, "bulb-abo", glance.createSphereAttributes(0.05, 5, 8, {
    normals: false,
    uvs: false,
}), {
    a_pos: { size: 3, type: gl.FLOAT },
});

const bulbVAO = glance.createVAO(
    gl,
    "bulb-vao",
    bulbIBO,
    glance.buildAttributeMap(bulbShader, bulbABO),
);

// =============================================================================
// Draw Calls
// =============================================================================


// Scene State
let viewDist = 3.5;
let viewPan = 0;
let viewTilt = Math.PI / -4;
let panDelta = 0;
let tiltDelta = 0;

const viewRotationMatrix = new glance.Cached(
    () =>
        mat4.multiply(
            mat4.fromRotation(viewPan, [0, 1, 0]),
            mat4.fromRotation(viewTilt, [1, 0, 0]),
        )
);

const viewMatrix = new glance.Cached(
    () => mat4.multiply(
        viewRotationMatrix.get(),
        mat4.fromTranslation([0, 0, viewDist]),
    ),
    [viewRotationMatrix]
);

const lightDistance = 0.25;
const lightRadius = .8;
const lightSpeed = 0.001;
const lightPos = new glance.TimeSensitive(
    (time) => [
        Math.cos(time * lightSpeed) * lightRadius,
        lightDistance,
        Math.sin(time * lightSpeed) * lightRadius,
    ],
);

const quadDrawCall = glance.createDrawCall(
    gl,
    phongShader,
    quadVAO,
    {
        uniforms: {
            u_lightPos: (time) => lightPos.getAt(time),
            u_viewMatrix: () => mat4.invert(viewMatrix.get()),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewMatrix.get()),
        },
        textures: [
            [0, quadTextureDiffuse],
            [1, quadTextureSpecular],
            [2, quadTextureNormal],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const bulbDrawCall = glance.createDrawCall(
    gl,
    bulbShader,
    bulbVAO,
    {
        uniforms: {
            u_modelMatrix: (time) => mat4.fromTranslation(lightPos.getAt(time)),
            u_viewMatrix: () => mat4.invert(viewMatrix.get()),
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);
// =============================================================================
// System Integration
// =============================================================================

onMouseDrag((e) =>
{
    viewPan += e.movementX * -.01;
    viewTilt += e.movementY * -.01;
    viewRotationMatrix.setDirty();
});

onMouseWheel((e) =>
{
    viewDist = Math.max(1.5, Math.min(10, viewDist * (1 + Math.sign(e.deltaY) * 0.2)));
    viewMatrix.setDirty();
});

onKeyDown((e) =>
{
    if (e.key == "ArrowLeft") {
        panDelta = Math.max(panDelta - 1, -1);
    }
    if (e.key == "ArrowRight") {
        panDelta = Math.min(panDelta + 1, 1);
    }
    if (e.key == "ArrowUp") {
        tiltDelta = Math.max(tiltDelta - 1, -1);
    }
    if (e.key == "ArrowDown") {
        tiltDelta = Math.min(tiltDelta + 1, 1);
    }
});

onKeyUp((e) =>
{
    if (e.key == "ArrowLeft") {
        panDelta = Math.min(panDelta + 1, 1);
    }
    if (e.key == "ArrowRight") {
        panDelta = Math.max(panDelta - 1, -1);
    }
    if (e.key == "ArrowUp") {
        tiltDelta = Math.min(tiltDelta + 1, 1);
    }
    if (e.key == "ArrowDown") {
        tiltDelta = Math.max(tiltDelta - 1, -1);
    }
});

setRenderLoop((time) =>
{
    if (panDelta != 0 || tiltDelta != 0) {
        viewPan += panDelta * .02;
        viewTilt += tiltDelta * .02;
        viewRotationMatrix.setDirty();
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, bulbDrawCall, time);
    glance.performDrawCall(gl, quadDrawCall, time);
});
