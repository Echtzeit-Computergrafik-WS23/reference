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
// Constants
// =============================================================================

const nearPlane = 0.2;
const farPlane = 24;
const viewProjection = mat4.perspective(Math.PI / 4, 1, nearPlane, farPlane);

const sphereRadius = 0.25;
const spheresX = 21;
const spheresZ = 21;
const gapFactor = 1.1; // gap is multiple of radius

const cameraStartAngle = [0, Math.PI * -0.25];
const cameraStartPos = [0, 8, 8];

const cameraMoveSpeed = 0.1;
const cameraRotateSpeed = -0.01;
const cameraMin = [-10, sphereRadius + nearPlane, -10];
const cameraMax = [8, 10, 8];

const randomSeed = 123;

// =============================================================================
// Random Number Generator
// =============================================================================

function mulberry32(a)
{
    return function ()
    {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}
const random = mulberry32(randomSeed);

// =============================================================================
// Shader Code
// =============================================================================

// Spheres ---------------------------------------------------------------------

const sphereVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_viewXform;
    uniform mat4 u_viewProjection;

    in mat4 a_modelMatrix;
    in mat3 a_normalMatrix;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec2 a_texCoord;

    // all fragment coordinates are in world space
    out vec3 f_pos;
    out vec3 f_normal;
    out vec2 f_texCoord;

    void main() {
        vec4 worldSpace = a_modelMatrix * vec4(a_pos, 1.0);

        gl_Position = u_viewProjection * u_viewXform * worldSpace;
        f_pos = vec3(worldSpace);
        f_normal = normalize(a_normalMatrix * a_normal);
        f_texCoord = a_texCoord;
    }
`;

const sphereFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightPos;
    uniform vec3 u_lightColor;
    uniform vec3 u_viewPos;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;

    in vec3 f_pos;
    in vec3 f_normal;
    in vec2 f_texCoord;

    out vec4 o_fragColor;

    void main() {

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;

        vec3 lightPositions[2] = vec3[](
            u_lightPos,
            vec3(3.0,  1.0, -3.0)
        );

        vec3 fragColor = vec3(0.0);
        for(int i = 0; i < 2; i++)
        {
            // light
            vec3 lightDir = lightPositions[i] - f_pos;
            float lightDistance = length(lightDir);
            lightDir /= lightDistance;

            // ambient
            vec3 ambient = texDiffuse * u_ambient;

            // diffuse
            vec3 normal = normalize(f_normal);
            float diffuseIntensity = max(dot(normal, lightDir), 0.0);
            vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

            // specular
            vec3 viewDir = normalize(u_viewPos - f_pos);
            vec3 halfWay = normalize(lightDir + viewDir);
            float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
            vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

            // color
            fragColor += ambient + diffuse + specular;
        }
        o_fragColor = vec4(fragColor, 1.0);
    }
`;

// Deferred --------------------------------------------------------------------

const deferredVertexShader = `#version 300 es
    precision highp float;

    in vec2 a_pos;

    void main()
    {
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const deferredFragmentShader = `#version 300 es
    precision mediump float;

    uniform sampler2D u_texture;

    out vec4 o_fragColor;

    void main() {
        vec2 texCoord = gl_FragCoord.xy / vec2(512.0, 512.0);
        o_fragColor = vec4(texture(u_texture, texCoord).rgb, 1.0);
    }
`;

// =============================================================================
// Geometry
// =============================================================================

const sphereShader = glance.buildShaderProgram(gl, "sphere-shader", sphereVertexShader, sphereFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.35,
    u_shininess: 64,
    u_lightPos: [0, 1, 0],
    u_lightColor: [1, 1, 1],
    u_viewProjection: viewProjection,
    u_texDiffuse: 0,
    u_texSpecular: 1,
});

const sphereTextureDiffuse = await glance.loadTextureNow(gl, "./img/Test_Diffuse.avif");
const sphereTextureSpecular = await glance.loadTextureNow(gl, "./img/Test_Specular.avif");

const spheresIBO = glance.createIndexBuffer(gl, glance.createSphereIndices(16, 32));

const spheresABO = glance.createAttributeBuffer(gl, "spheres-abo", glance.createSphereAttributes(sphereRadius, 16, 32), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const spheresInstanceAttributes = new Float32Array((16 + 9) * (spheresX * spheresZ));
{
    const stepX = 2 * sphereRadius * gapFactor;
    const stepZ = 2 * sphereRadius * gapFactor;
    for (let x = 0; x < spheresX; x++) {
        for (let z = 0; z < spheresZ; z++) {
            const rotation = mat4.multiply(
                mat4.fromRotation(random() * Math.PI * 2, [1, 0, 0]),
                mat4.fromRotation(random() * Math.PI * 2, [0, 1, 0])
            );
            const translation = mat4.fromTranslation([
                (x - ((spheresX - 1) / 2)) * stepX,
                random() * -sphereRadius,
                (z - ((spheresZ - 1) / 2)) * stepZ
            ]);
            const modelMatrix = mat4.multiply(translation, rotation);
            const normalMatrix = mat3.fromMat4(modelMatrix);
            spheresInstanceAttributes.set([...modelMatrix, ...normalMatrix], (16 + 9) * (x * spheresX + z));
        }
    }
}
const spheresIABO = glance.createAttributeBuffer(gl, "spheres-iabo", spheresInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const spheresVAO = glance.createVAO(
    gl,
    "spheres-vao",
    spheresIBO,
    glance.buildAttributeMap(sphereShader, [spheresABO, spheresIABO]),
);

// Deferred Quad ---------------------------------------------------------------

const deferredShader = glance.buildShaderProgram(gl, "deferred-shader", deferredVertexShader, deferredFragmentShader, {
    u_texture: 0,
});

const deferredIBO = glance.createIndexBuffer(gl, glance.createQuadIndices());

const deferredABO = glance.createAttributeBuffer(gl, "deferred-abo", glance.createQuadAttributes({
    uvs: false,
}), {
    a_pos: { size: 2, type: gl.FLOAT },
});

const deferredVAO = glance.createVAO(gl, "deferred-vao", deferredIBO, glance.buildAttributeMap(deferredShader, deferredABO));

// =============================================================================
// Draw Calls
// =============================================================================

// Scene State
let viewAngle = cameraStartAngle;
let viewPos = cameraStartPos;
let delta = [0, 0, 0];

const viewRotation = new glance.Cached(
    () => mat4.multiply(
        mat4.fromRotation(viewAngle[0], [0, 1, 0]),
        mat4.fromRotation(viewAngle[1], [1, 0, 0]),
    )
);

const viewXform = new glance.Cached(
    () => mat4.multiply(
        mat4.fromTranslation(viewPos),
        viewRotation.get(),
    ),
    [viewRotation]
);

const invViewXform = new glance.Cached(
    () => mat4.invert(viewXform.get()),
    [viewXform]
);

const spheresDrawCall = glance.createDrawCall(
    gl,
    sphereShader,
    spheresVAO,
    {
        uniforms: {
            u_viewXform: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, sphereTextureDiffuse],
            [1, sphereTextureSpecular],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instanceCount: spheresX * spheresZ,
    },
);

// =============================================================================
// System Integration
// =============================================================================

onMouseDrag((e) =>
{
    viewAngle[0] += e.movementX * cameraRotateSpeed;
    viewAngle[1] += e.movementY * cameraRotateSpeed;
    viewRotation.setDirty();
});

onKeyDown((e) =>
{
    if (e.key == "d") {
        delta[0] = Math.min(delta[0] + 1, 1);
    }
    if (e.key == "a") {
        delta[0] = Math.max(delta[0] - 1, -1);
    }
    if (e.key == "e") {
        delta[1] = Math.min(delta[1] + 1, 1);
    }
    if (e.key == "c") {
        delta[1] = Math.max(delta[1] - 1, -1);
    }
    if (e.key == "w") {
        delta[2] = Math.min(delta[2] + 1, 1);
    }
    if (e.key == "s") {
        delta[2] = Math.max(delta[2] - 1, -1);
    }
});

onKeyUp((e) =>
{
    if (e.key == "d") {
        delta[0] = Math.max(delta[0] - 1, -1);
    }
    if (e.key == "a") {
        delta[0] = Math.min(delta[0] + 1, 1);
    }
    if (e.key == "e") {
        delta[1] = Math.max(delta[1] - 1, -1);
    }
    if (e.key == "c") {
        delta[1] = Math.min(delta[1] + 1, 1);
    }
    if (e.key == "w") {
        delta[2] = Math.max(delta[2] - 1, -1);
    }
    if (e.key == "s") {
        delta[2] = Math.min(delta[2] + 1, 1);
    }
});

const framebufferStack = new glance.FramebufferStack();

setRenderLoop((time) =>
{
    if (delta[0] != 0 || delta[1] || delta[2] != 0) {
        const right = vec3.scale(vec3.transformMat4([1, 0, 0], viewRotation.get()), delta[0] * cameraMoveSpeed);
        const up = vec3.scale(vec3.transformMat4([0, 1, 0], viewRotation.get()), delta[1] * cameraMoveSpeed);
        const forward = vec3.scale(vec3.transformMat4([0, 0, -1], viewRotation.get()), delta[2] * cameraMoveSpeed);
        vec3.add(viewPos, right);
        vec3.add(viewPos, up);
        vec3.add(viewPos, forward);
        vec3.max(viewPos, cameraMin);
        vec3.min(viewPos, cameraMax);
        viewXform.setDirty();
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, spheresDrawCall, time);
});
