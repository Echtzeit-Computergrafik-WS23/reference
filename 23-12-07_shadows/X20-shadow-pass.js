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

// Solids ----------------------------------------------------------------------

const solidVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_invLightRotation;
    uniform mat4 u_viewXform;
    uniform mat4 u_cameraProjection;
    uniform vec3 u_viewPos;

    in mat4 a_modelMatrix;
    in vec3 a_pos;
    in vec3 a_normal;
    in vec3 a_tangent;
    in mat3 a_normalMatrix;
    in vec2 a_texCoord;

    out vec3 f_pos;
    out vec3 f_lightDir;
    out vec3 f_viewPos;
    out vec2 f_texCoord;

    void main() {
        vec3 normal = a_normalMatrix * a_normal;
        vec3 tangent = a_normalMatrix * a_tangent;
        vec3 bitangent = cross(normal, tangent);
        mat3 tbn = transpose(mat3(tangent, bitangent, normal));

        // Transform world space coords to tangent space
        f_pos = tbn * vec3(a_modelMatrix * vec4(a_pos, 1.0));
        f_viewPos = tbn * u_viewPos;
        f_lightDir = tbn * u_invLightRotation * vec3(.0, .0, -1.0);

        f_texCoord = a_texCoord;

        gl_Position = u_cameraProjection * u_viewXform * a_modelMatrix * vec4(a_pos, 1.0);
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

    in vec3 f_pos;
    in vec3 f_lightDir;
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
        vec3 normal = normalize( // only apply the normal map at half strength
            mix(vec3(0., 0., 1.),
            texNormal * (255./128.) - 1.0,
            0.5));
        float diffuseIntensity = max(dot(normal, f_lightDir), 0.0);
        vec3 diffuse = diffuseIntensity * u_lightColor * texDiffuse;

        // specular
        vec3 viewDir = normalize(f_viewPos - f_pos);
        vec3 halfWay = normalize(f_lightDir + viewDir);
        float specularIntensity = pow(max(dot(normal, halfWay), 0.0), u_shininess);
        vec3 specular = (u_specular * specularIntensity) * texSpecular * u_lightColor;

        // color
        FragColor = vec4(ambient + diffuse + specular, 1.0);
    }
`;

// Skybox ----------------------------------------------------------------------

const skyVertexShader = `#version 300 es
    precision highp float;

    uniform mat3 u_lightRotation;
    uniform mat3 u_viewRotation;
    uniform mat4 u_cameraProjection;

    in vec3 a_pos;

    out vec3 f_texCoord;

    // This matrix rotates the skybox so that the sun shines down the positive
    // Z axis instead of its native (unaligned) direction.
    const mat3 baseRotation = mat3(
        -0.9497352095434962, -0.0835014389652365, 0.30171268028391895,
        0.0, 0.9637708963658905, 0.26673143668883115,
        -0.3130543591029702, 0.2533242369155048, -0.9153271542119822
    );

    void main() {
        // Use the local position of the vertex as texture coordinate.
        f_texCoord = baseRotation * u_lightRotation * a_pos;

        // By setting Z == W, we ensure that the vertex is projected onto the
        // far plane, which is exactly what we want for the background.
        vec4 ndcPos = u_cameraProjection * inverse(mat4(u_viewRotation)) * vec4(a_pos, 1.0);
        gl_Position = ndcPos.xyww;
    }
`;

const skyFragmentShader = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        FragColor = texture(u_skybox, f_texCoord);
    }
`;

// Shadow ----------------------------------------------------------------------

const shadowVertexShader = `#version 300 es
precision highp float;

layout(location = 4) in vec3 a_pos;

uniform mat4 u_modelMatrix;
uniform mat4 u_lightXform;
uniform mat4 u_lightProjection;

void main()
{
    gl_Position = u_lightProjection * u_lightXform * u_modelMatrix * vec4(a_pos, 1.0);
}
`;

const shadowFragmentShader = `#version 300 es
    precision mediump float;

    void main() {}
`;

// =============================================================================
// Geometry
// =============================================================================

const cameraProjection = mat4.perspective(Math.PI / 4, 1, 0.1, 14);

const lightProjection = mat4.ortho(-1, 1, -1, 1, 0, 3);

const solidShader = glance.buildShaderProgram(gl, "floor-shader", solidVertexShader, solidFragmentShader, {
    u_ambient: 0.2,
    u_specular: 0.35,
    u_shininess: 64,
    u_lightColor: [1, 1, 1],
    u_cameraProjection: cameraProjection,
    u_texDiffuse: 0,
    u_texSpecular: 1,
    u_texNormal: 2,
});

// Floor -----------------------------------------------------------------------

const floorIBO = glance.createIndexBuffer(gl, glance.createPlaneIndices());

const floorABO = glance.createAttributeBuffer(gl, "floor-abo", glance.createPlaneAttributes(1, 1, { tangents: true }), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

const floorModelMatrix = mat4.fromRotation(Math.PI / 2, [-1, 0, 0]);
const floorNormalMatrix = mat3.fromMat4(floorModelMatrix);
const floorInstanceAttributes = new Float32Array([...floorModelMatrix, ...floorNormalMatrix]);
const floorIABO = glance.createAttributeBuffer(gl, "floor-iabo", floorInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const floorVAO = glance.createVAO(
    gl,
    "floor-vao",
    floorIBO,
    glance.buildAttributeMap(solidShader, [floorABO, floorIABO]),
);
const floorTextureDiffuse = await glance.loadTextureNow(gl, "./img/Rockwall_Diffuse.jpg");
const floorTextureSpecular = await glance.loadTextureNow(gl, "./img/Rockwall_Specular.jpg");
const floorTextureNormal = await glance.loadTextureNow(gl, "./img/Rockwall_Normal.jpg");

// Torus -----------------------------------------------------------------------

const torusIBO = glance.createIndexBuffer(gl, glance.createTorusKnotIndices(
    128,     // tubularSegments
    32,      // radialSegments
));

const torusABO = glance.createAttributeBuffer(gl, "torus-abo", glance.createTorusKnotAttributes({
    radius: 0.1,
    tube: 0.035,
    tubularSegment: 128,
    radialSegments: 32,
    p: 2,
    q: 3,
    tangents: true,
}), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

const torusModelMatrix = mat4.fromTranslation([0, 0.2, 0]);
const torusNormalMatrix = mat3.fromMat4(torusModelMatrix);
const torusInstanceAttributes = new Float32Array([...torusModelMatrix, ...torusNormalMatrix]);
const torusIABO = glance.createAttributeBuffer(gl, "torus-iabo", torusInstanceAttributes, {
    a_modelMatrix: { size: 4, width: 4, type: gl.FLOAT, divisor: 1 },
    a_normalMatrix: { size: 3, width: 3, type: gl.FLOAT, divisor: 1 },
});

const torusVAO = glance.createVAO(
    gl,
    "torus-vao",
    torusIBO,
    glance.buildAttributeMap(solidShader, [torusABO, torusIABO])
);

// Skybox ----------------------------------------------------------------------

const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_cameraProjection: cameraProjection,
    u_skybox: 0,
});

const boxIndex = glance.createBoxIndices(true);
const boxAttributes = glance.createBoxAttributes(2, { normals: false, texCoords: false, sharedVertices: true });
const skyIBO = glance.createIndexBuffer(gl, boxIndex);
const skyABO = glance.createAttributeBuffer(gl, "sky-abo", boxAttributes, {
    a_pos: { size: 3, type: gl.FLOAT },
});

const skyVAO = glance.createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO));

const skyCubemap = await glance.loadCubemapNow(gl, "sky-texture", [
    "./img/Skybox_Right.avif",
    "./img/Skybox_Left.avif",
    "./img/Skybox_Top.avif",
    "./img/Skybox_Bottom.avif",
    "./img/Skybox_Front.avif",
    "./img/Skybox_Back.avif",
]);

// =============================================================================
// Shadow Setup
// =============================================================================

const shadowShader = glance.buildShaderProgram(gl, "shadow-shader", shadowVertexShader, shadowFragmentShader, {
    u_lightProjection: lightProjection,
});

const shadowDepthTexture = glance.createTexture(gl, "shadow-depth", 512, 512, gl.TEXTURE_2D, null, {
    useAnisotropy: false,
    internalFormat: gl.DEPTH_COMPONENT16,
    levels: 1,
    filter: gl.NEAREST,
});

const shadowFramebuffer = glance.createFramebuffer(gl, "shadow-framebuffer", null, shadowDepthTexture);

// =============================================================================
// Draw Calls
// =============================================================================

// Scene State
let viewDist = 1.3;
let viewPan = 0;
let viewTilt = Math.PI / -10;
let panDelta = 0;
let tiltDelta = 0;

const viewRotation = new glance.Cached(
    () =>
        mat4.multiply(
            mat4.fromRotation(viewPan, [0, 1, 0]),
            mat4.fromRotation(viewTilt, [1, 0, 0]),
        )
);

const viewXform = new glance.Cached(
    () => mat4.multiply(
        viewRotation.get(),
        mat4.fromTranslation([0, 0, viewDist]),
    ),
    [viewRotation]
);

const invViewXform = new glance.Cached(
    () => mat4.invert(viewXform.get()),
    [viewXform]
);

const rotationSpeed = 0.00003;
const lightTilt = 0.4;
const lightRotation = new glance.TimeSensitive(
    (time) => mat3.fromMat4(mat4.multiply(
        mat4.fromRotation(-lightTilt, [1, 0, 0]),
        mat4.fromRotation(time * -rotationSpeed, [0, 1, 0]),
    )),
);
const invLightRotation = new glance.TimeSensitive(
    (time) => mat3.transpose(lightRotation.getAt(time)),
);
const lightXform = new glance.TimeSensitive(
    (time) => mat4.lookAt(
        vec3.transformMat3([0, 0, -1], invLightRotation.getAt(time)),
        [0, 0, 0],
        [0, 1, 0]
    )
);

// Beauty ----------------------------------------------------------------------

const floorDrawCall = glance.createDrawCall(
    gl,
    solidShader,
    floorVAO,
    {
        uniforms: {
            u_invLightRotation: (time) => invLightRotation.getAt(time),
            u_viewXform: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, floorTextureDiffuse],
            [1, floorTextureSpecular],
            [2, floorTextureNormal],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const torusDrawCall = glance.createDrawCall(
    gl,
    solidShader,
    torusVAO,
    {
        uniforms: {
            u_invLightRotation: (time) => invLightRotation.getAt(time),
            u_viewXform: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, floorTextureDiffuse],
            [1, floorTextureSpecular],
            [2, floorTextureNormal],
        ],
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
            u_lightRotation: (time) => lightRotation.getAt(time),
            u_viewRotation: () => mat3.fromMat4(viewRotation.get()),
        },
        textures: [
            [0, skyCubemap],
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
        torusVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
                u_modelMatrix: () => torusModelMatrix,
            },
            cullFace: gl.BACK,
            depthTest: gl.LESS,
        }
    ),
    glance.createDrawCall(
        gl,
        shadowShader,
        floorVAO,
        {
            uniforms: {
                u_lightXform: (time) => lightXform.getAt(time),
                u_modelMatrix: () => floorModelMatrix,
            },
            cullFace: gl.BACK,
            depthTest: gl.LESS,
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
    viewRotation.setDirty();
});

onMouseWheel((e) =>
{
    viewDist = Math.max(0.5, Math.min(5, viewDist * (1 + Math.sign(e.deltaY) * 0.2)));
    viewXform.setDirty();
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
        viewRotation.setDirty();
    }

    // Render shadow map
    framebufferStack.push(gl, shadowFramebuffer);
    {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (const drawCall of shadowDrawCalls) {
            glance.performDrawCall(gl, drawCall, time);
        }
    }
    framebufferStack.pop(gl);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, torusDrawCall, time);
    glance.performDrawCall(gl, floorDrawCall, time);
    glance.performDrawCall(gl, skyDrawCall, time);
});
