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

const lightFarPlane = 30;

const cameraProjection = mat4.perspective(Math.PI / 4, 1, 0.1, 28);
const lightProjection = mat4.perspective(Math.PI / 2, 1, 0, lightFarPlane);

const cameraStartAngle = [-0.3, -0.6];
const cameraStartDistance = 3.5;
const cameraMinDistance = 1.5;
const cameraMaxDistance = 10.0;

const cameraMoveSpeed = 0.1;
const cameraRotateSpeed = -0.01;

const lightDistance = 0.0;
const lightRadius = 5.0;
const lightSpeed = 0.0001;

const wallDistance = cameraMaxDistance;

// =============================================================================
// Shader Code
// =============================================================================

// Solids ----------------------------------------------------------------------

const solidVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_viewXform;
    uniform mat4 u_viewProjection;
    uniform vec3 u_lightPos;
    uniform vec3 u_viewPos;

    layout (location = 0) in vec3 a_pos;
    layout (location = 1) in mat4 a_modelMatrix;
    in vec3 a_normal;
    in vec3 a_tangent;
    in mat3 a_normalMatrix;
    in vec2 a_texCoord;

    out vec3 f_fragPosWS;
    out vec3 f_fragPosTS;
    out vec3 f_lightPosWS;
    out vec3 f_lightPosTS;
    out vec3 f_viewPosTS;
    out vec2 f_texCoord;

    void main() {
        vec4 worldPos = a_modelMatrix * vec4(a_pos, 1.0);
        f_fragPosWS = worldPos.xyz;
        f_lightPosWS = u_lightPos;

        // Transform world space coords to tangent space
        vec3 normal = a_normalMatrix * a_normal;
        vec3 tangent = a_normalMatrix * a_tangent;
        vec3 bitangent = cross(normal, tangent);
        mat3 tbn = transpose(mat3(tangent, bitangent, normal));
        f_fragPosTS = tbn * f_fragPosWS;
        f_lightPosTS = tbn * u_lightPos;
        f_viewPosTS = tbn * u_viewPos;

        f_texCoord = a_texCoord;
        gl_Position = u_viewProjection * u_viewXform * worldPos;
    }
`;

const solidFragmentShader = `#version 300 es
    precision mediump float;

    uniform float u_ambient;
    uniform float u_specular;
    uniform float u_shininess;
    uniform vec3 u_lightColor;
    uniform sampler2D u_texDiffuse;
    uniform sampler2D u_texSpecular;
    uniform sampler2D u_texNormal;
    uniform mediump samplerCubeShadow u_texShadow;

    in vec3 f_fragPosWS;
    in vec3 f_fragPosTS;
    in vec3 f_lightPosWS;
    in vec3 f_lightPosTS;
    in vec3 f_viewPosTS;
    in vec2 f_texCoord;

    out vec4 FragColor;

    float calculateShadow(float);

    const float farPlane = ${lightFarPlane.toFixed(2)};

    void main() {

        // texture
        vec3 texDiffuse = texture(u_texDiffuse, f_texCoord).rgb;
        vec3 texSpecular = texture(u_texSpecular, f_texCoord).rgb;
        vec3 texNormal = texture(u_texNormal, f_texCoord).rgb;

        // ambient
        vec3 ambient = texDiffuse * u_ambient;

        // diffuse
        vec3 normal = normalize(texNormal * (255./128.) - 1.0);
        vec3 lightDir = normalize(f_lightPosTS - f_fragPosTS);
        float diffuseIntensity = max(dot(normal, lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(f_viewPosTS - f_fragPosTS);
        vec3 halfWay = normalize(lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // shadow
        float shadow = calculateShadow(diffuseIntensity);

        // color
        FragColor = vec4(ambient + shadow * (diffuse + specular), 1.0);
    }

    float calculateShadow(float diffuseIntensity) {
        // Get the vector from the fragment to the light source.
        vec3 fragToLight = f_fragPosWS - f_lightPosWS;

        // Get the current depth from the light's perspective.
        float fragDepth = length(fragToLight) / (farPlane * 2.0);

        // A fixed bias stops a shadow caster from self-shadowing.
        float bias = 0.1;

        // Get the depth to the closest surface from the light's perspective.
        float diskRadius = fragDepth / farPlane * 8.0;
        const vec3 sampleOffsetDirections[20] = vec3[]
        (
           vec3( 1,  1,  1), vec3( 1, -1,  1), vec3(-1, -1,  1), vec3(-1,  1,  1),
           vec3( 1,  1, -1), vec3( 1, -1, -1), vec3(-1, -1, -1), vec3(-1,  1, -1),
           vec3( 1,  1,  0), vec3( 1, -1,  0), vec3(-1, -1,  0), vec3(-1,  1,  0),
           vec3( 1,  0,  1), vec3(-1,  0,  1), vec3( 1,  0, -1), vec3(-1,  0, -1),
           vec3( 0,  1,  1), vec3( 0, -1,  1), vec3( 0, -1, -1), vec3( 0,  1, -1)
        );
        float visibility = 0.0;
        for (int i=0; i<20; i++){
            visibility += texture(u_texShadow, vec4(fragToLight + sampleOffsetDirections[i] * diskRadius, fragDepth - bias));
        }
        return visibility / 20.0;
    }
`;


// Light Bulb ------------------------------------------------------------------

const bulbVertexShader = `#version 300 es
    precision highp float;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_viewProjection;

    in vec3 a_pos;

    void main() {
        gl_Position = u_viewProjection * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
    }
`;

const bulbFragmentShader = `#version 300 es
    precision mediump float;

    out vec4 FragColor;

    void main() {
        FragColor = vec4(1.0);
    }
`;

// Shadow ----------------------------------------------------------------------

const shadowVertexShader = `#version 300 es
precision highp float;

layout (location = 0) in vec3 a_pos;
layout (location = 1) in mat4 a_modelMatrix;

uniform mat4 u_lightXform;
uniform mat4 u_lightProjection;

out vec3 FragPos;

void main()
{
    FragPos = (a_modelMatrix * vec4(a_pos, 1.0)).xyz;
    gl_Position = u_lightProjection * u_lightXform * a_modelMatrix * vec4(a_pos, 1.0);
}
`;

const shadowFragmentShader = `#version 300 es
    precision mediump float;

    uniform highp mat4 u_lightXform;

    in vec3 FragPos;

    const float farPlane = ${lightFarPlane.toFixed(2)};

    void main() {
        // get distance between fragment and light source
        float lightDistance = length(FragPos - vec3(vec4(0.0, 0.0, -1.0, 1.0) * u_lightXform));

        // map to [0;1] range by dividing by far_plane
        lightDistance = lightDistance / farPlane;

        // write this as modified depth
        gl_FragDepth = lightDistance;
    }
`;

// Debug Skybox ----------------------------------------------------------------

const skyVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_viewRotationMatrix;
    uniform mat4 u_viewProjection;

    in vec3 a_pos;

    out vec3 f_texCoord;

    void main() {
        vec4 ndcPos = u_viewProjection * transpose(mat4(u_viewRotationMatrix)) * vec4(a_pos, 1.0);
        gl_Position = ndcPos.xyww;
        f_texCoord = a_pos;
    }
`;

const skyFragmentShader = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        float depth = texture(u_skybox, f_texCoord).r;
        FragColor = vec4(depth, depth, depth, 1.0);
    }
`;

// =============================================================================
// Geometry
// =============================================================================

const solidShader = glance.buildShaderProgram(gl, "solid-shader", solidVertexShader, solidFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.15,
    u_shininess: 128,
    u_lightColor: [1, 1, 1],
    u_viewProjection: cameraProjection,
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
    u_texShadow: 3,
});

// Monkey ----------------------------------------------------------------------

const { attributes: monkeyAttr, indices: monkeyIdx } = await glance.loadObj("./obj/suzanne.obj", {
    tangents: true,
});

const monkeyIBO = glance.createIndexBuffer(gl, monkeyIdx);

const monkeyABO = glance.createAttributeBuffer(gl, "monkey-abo", monkeyAttr, {
    a_pos: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

// const monkeyIBO = glance.createIndexBuffer(gl, glance.createTorusKnotIndices(
//     128,     // tubularSegments
//     32,      // radialSegments
// ));

// const monkeyABO = glance.createAttributeBuffer(gl, "torus-abo", glance.createTorusKnotAttributes({
//     radius: 0.3,
//     tube: 0.13,
//     tubularSegment: 128,
//     radialSegments: 32,
//     p: 2,
//     q: 3,
//     tangents: true,
// }), {
//     a_pos: { size: 3, type: gl.FLOAT },
//     a_normal: { size: 3, type: gl.FLOAT },
//     a_texCoord: { size: 2, type: gl.FLOAT },
//     a_tangent: { size: 3, type: gl.FLOAT },
// });

const monkeyXform = mat4.identity();
const monkeyNormalMatrix = mat3.fromMat4(monkeyXform);
const monkeyInstanceAttributes = new Float32Array([...monkeyXform, ...monkeyNormalMatrix]);
const monkeyIABO = glance.createAttributeBuffer(gl, "monkey-iabo", monkeyInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const monkeyVAO = glance.createVAO(
    gl,
    "monkey-vao",
    monkeyIBO,
    glance.buildAttributeMap(solidShader, [monkeyABO, monkeyIABO]),
);
const monkeyTextureDiffuse = await glance.loadTextureNow(gl, "./img/Rockwall_Diffuse.avif");
const monkeyTextureSpecular = await glance.loadTextureNow(gl, "./img/Rockwall_Specular.avif");
const monkeyTextureNormal = await glance.loadTextureNow(gl, "./img/Rockwall_Normal.avif");

// Walls -----------------------------------------------------------------------

const wallsIBO = glance.createIndexBuffer(gl, glance.createBoxIndices());

const wallsABO = glance.createAttributeBuffer(gl, "walls-abo", glance.createBoxAttributes(wallDistance * 2, {
    height: 2,
    depth: wallDistance * 2,
    tangents: true,
}), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

const wallsInstanceAttributes = new Float32Array((16 + 9) * 6);
const wallPositions = [
    [0, -(wallDistance + 1), 0],
    [0, +(wallDistance + 1), 0],
    [+(wallDistance + 1), 0, 0],
    [-(wallDistance + 1), 0, 0],
    [0, 0, +(wallDistance + 1)],
    [0, 0, -(wallDistance + 1)],
];
for (let i = 0; i < 6; ++i) {
    const wallsXform = mat4.fromTranslation(wallPositions[i]);
    if (i >= 2) {
        if (i < 4) {
            mat4.rotate(wallsXform, Math.PI / 2, [0, 1, 0]);
        }
        mat4.rotate(wallsXform, Math.PI / 2, [1, 0, 0]);
    }
    const wallsNormalMatrix = mat3.fromMat4(wallsXform);
    wallsInstanceAttributes.set([...wallsXform, ...wallsNormalMatrix], i * (16 + 9));
}
const wallsIABO = glance.createAttributeBuffer(gl, "walls-iabo", wallsInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const wallsVAO = glance.createVAO(
    gl,
    "walls-vao",
    wallsIBO,
    glance.buildAttributeMap(solidShader, [wallsABO, wallsIABO]),
);

// Bulb ------------------------------------------------------------------------

const bulbShader = glance.buildShaderProgram(gl, "bulb-shader", bulbVertexShader, bulbFragmentShader, {
    u_viewProjection: cameraProjection,
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

// Skybox ----------------------------------------------------------------------

const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_viewProjection: cameraProjection,
    u_skybox: 0,
});

const skyIBO = glance.createIndexBuffer(gl, glance.createSkyBoxIndices());

const skyABO = glance.createAttributeBuffer(gl, "sky-abo", glance.createSkyBoxAttributes(), {
    a_pos: { size: 3, type: gl.FLOAT },
});

const skyVAO = glance.createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO));

// =============================================================================
// Shadow Setup
// =============================================================================

// The Shadow shader is the same as for directional lights.
const shadowShader = glance.buildShaderProgram(gl, "shadow-shader", shadowVertexShader, shadowFragmentShader, {
    u_lightProjection: lightProjection,
});

// Create a cube map texture to store the depth values of the shadow map.
const shadowDepthTexture = glance.createTexture(gl, "shadow-depth", 512, 512, gl.TEXTURE_CUBE_MAP, null, {
    useAnisotropy: false,
    internalFormat: gl.DEPTH_COMPONENT16,
    levels: 1,
    filter: gl.LINEAR,
    compareFunc: gl.LEQUAL,
});

// Create a framebuffer for each face of the cube map (6 total).
const shadowFramebuffers = Array.from({ length: 6 }, (_, i) => glance.createFramebuffer(gl, `shadow-framebuffer${i}`, null, {
    attachment: shadowDepthTexture,
    target: gl.TEXTURE_CUBE_MAP_POSITIVE_X + i,
}));

// =============================================================================
// Draw Calls
// =============================================================================

// Scene State
let viewDist = cameraStartDistance;
let viewPan = cameraStartAngle[0];
let viewTilt = cameraStartAngle[1];
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

const invViewMatrix = new glance.Cached(
    () => mat4.invert(viewMatrix.get()),
    [viewMatrix]
);

const lightPos = new glance.TimeSensitive(
    (time) =>
    {
        return vec3.transformMat4([0, 0, -lightRadius * (0.75 + Math.cos(time * 0.001) * 0.5)], mat4.multiply(
            mat4.fromRotation(time * lightSpeed, [0, 0, -1]),
            mat4.fromRotation(time * lightSpeed * 0.5, [1, 0, 0]),
        ));
    },
);

const lightDirections = new glance.TimeSensitive(
    (time) =>
    {
        const pos = lightPos.getAt(time);
        return [
            mat4.lookAt(pos, vec3.add([+1, 0, 0], pos), [0, -1, 0]),
            mat4.lookAt(pos, vec3.add([-1, 0, 0], pos), [0, -1, 0]),
            mat4.lookAt(pos, vec3.add([0, +1, 0], pos), [0, 0, +1]),
            mat4.lookAt(pos, vec3.add([0, -1, 0], pos), [0, 0, -1]),
            mat4.lookAt(pos, vec3.add([0, 0, +1], pos), [0, -1, 0]),
            mat4.lookAt(pos, vec3.add([0, 0, -1], pos), [0, -1, 0]),
        ];
    });

// The lightId is used to cycle through the 6 faces of the cube map.
let lightDirection = 0;
const lightXform = new glance.TimeSensitive(
    (time) => lightDirections.getAt(time)[lightDirection],
);

const monkeyDrawCall = glance.createDrawCall(
    gl,
    solidShader,
    monkeyVAO,
    {
        uniforms: {
            u_lightPos: (time) => lightPos.getAt(time),
            u_viewXform: () => invViewMatrix.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewMatrix.get()),
        },
        textures: [
            [0, monkeyTextureDiffuse],
            [1, monkeyTextureSpecular],
            [2, monkeyTextureNormal],
            [3, shadowDepthTexture],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const wallsDrawCall = glance.createDrawCall(
    gl,
    solidShader,
    wallsVAO,
    {
        uniforms: {
            u_lightPos: (time) => lightPos.getAt(time),
            u_viewXform: () => invViewMatrix.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewMatrix.get()),
        },
        textures: [
            [0, monkeyTextureDiffuse],
            [1, monkeyTextureSpecular],
            [2, monkeyTextureNormal],
            [3, shadowDepthTexture],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
        instanceCount: 6,
    }
);

const bulbDrawCall = glance.createDrawCall(
    gl,
    bulbShader,
    bulbVAO,
    {
        uniforms: {
            u_modelMatrix: (time) => mat4.fromTranslation(lightPos.getAt(time)),
            u_viewMatrix: () => invViewMatrix.get(),
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const skyDrawCall = glance.createDrawCall(
    gl,
    skyShader,
    skyVAO,
    {
        uniforms: {
            u_viewRotationMatrix: () => mat3.fromMat4(viewRotationMatrix.get()),
        },
        textures: [
            [0, shadowDepthTexture],
        ],
        cullFace: gl.NONE,
        depthTest: gl.LEQUAL,
    }
);

// Shadow ----------------------------------------------------------------------

const shadowDrawCalls = [
    glance.createDrawCall(
        gl,
        shadowShader,
        monkeyVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
            },
            cullFace: gl.BACK,
            depthTest: gl.LESS,
        }
    ),
    glance.createDrawCall(
        gl,
        shadowShader,
        wallsVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
            },
            cullFace: gl.BACK,
            depthTest: gl.LESS,
            instanceCount: 6,
        }
    ),
];

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
    viewDist = Math.max(cameraMinDistance, Math.min(cameraMaxDistance, viewDist * (1 + Math.sign(e.deltaY) * 0.2)));
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

const framebufferStack = new glance.FramebufferStack();

setRenderLoop((time) =>
{
    if (panDelta != 0 || tiltDelta != 0) {
        viewPan += panDelta * .02;
        viewTilt += tiltDelta * .02;
        viewRotationMatrix.setDirty();
    }

    for (let i = 0; i < 6; ++i) {
        framebufferStack.push(gl, shadowFramebuffers[i]);
        {
            gl.clear(gl.DEPTH_BUFFER_BIT);
            lightDirection = i;
            lightXform.setDirty();
            for (const drawCall of shadowDrawCalls) {
                glance.performDrawCall(gl, drawCall, time);
            }
        }
        framebufferStack.pop(gl);
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // glance.performDrawCall(gl, skyDrawCall, time);
    glance.performDrawCall(gl, monkeyDrawCall, time);
    glance.performDrawCall(gl, bulbDrawCall, time);
    glance.performDrawCall(gl, wallsDrawCall, time);
});
