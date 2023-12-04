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
// GLANCE
// =============================================================================


function createVAO(gl, name, ibo, attributes)
{
    // Create and bind the VAO.
    const vao = gl.createVertexArray();
    if (vao === null) {
        throw new Error(`Failed to create a new VAO object for "${name}".`);
    }
    gl.bindVertexArray(vao);

    // Bind the index buffer to the VAO.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo.glObject);

    // Bind the attribute buffers to the VAO.
    for (const [location, attrRef] of attributes.entries()) {
        const offset = glance.calcOffset(attrRef);
        if (offset === null) {
            throw new Error(`Could not find VAO attribute for location ${location} in Attribute Buffer "${attrRef.buffer.name}".`);
        }
        const attributeName = attrRef.name;
        const attributeBuffer = attrRef.buffer;
        const bufferStride = glance.calcStride(attributeBuffer.attributes.values());
        const definition = attributeBuffer.attributes.get(attributeName);
        if (definition === undefined) {
            throw new Error(`Could not find VAO attribute for location ${location} in Attribute Buffer "${attributeBuffer.name}".`);
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer.glObject);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
            location,
            definition.size,
            definition.type,
            definition.normalized ?? false,
            bufferStride,
            offset,
        );
        console.log(`Attribute "${attributeName}" of VAO "${name}" bound to location: ${location}`);
    }

    // Reset the WebGL state again.
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null); // unbind the VAO _before_ the IBO!
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // Return the VAO object.
    return {
        name,
        glObject: vao,
        ibo,
        attributes,
    };
}


function performDrawCall(gl, drawCall, time)
{
    // Return early if the draw call is disabled.
    if (drawCall.enabled !== undefined && !drawCall.enabled(time)) {
        return;
    }

    // Bind the VAO and shader program.
    gl.bindVertexArray(drawCall.vao.glObject);
    gl.useProgram(drawCall.program.glObject);

    // Set up the WebGL state for the draw call.
    if (drawCall.cullFace !== gl.NONE) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(drawCall.cullFace);
    }
    if (drawCall.depthTest !== gl.NONE) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(drawCall.depthTest);
    }

    try {
        // Update the uniforms.
        for (const [uniformName, updateCallback] of drawCall.uniforms) {
            const uniform = drawCall.program.uniforms.get(uniformName);
            if (uniform === undefined) {
                throw new Error(`Uniform "${uniformName}" from update callback not found in shader program "${drawCall.program.name}"!`);
            }
            const newValue = updateCallback(time);
            if (newValue === undefined) {
                throw new Error(`Uniform update callback for "${uniformName}" returned undefined!`);
            }
            if (newValue === uniform.value) {
                continue; // no need to update
            }
            uniform.value = newValue;
            try {
                glance.setUniform(gl, uniform);
            } catch (error) {
                throw new Error(`Failed to update uniform "${uniformName}" of shader "${drawCall.program.name}": ${error}`);
            }
        }

        // Bind the textures
        for (const [id, unit] of drawCall.textures) {
            gl.activeTexture(gl.TEXTURE0 + id);
            if (unit.texture_2d !== undefined) {
                gl.bindTexture(gl.TEXTURE_2D, unit.texture_2d.glObject);
            }
            if (unit.texture_3d !== undefined) {
                gl.bindTexture(gl.TEXTURE_3D, unit.texture_3d.glObject);
            }
            if (unit.texture_cube !== undefined) {
                gl.bindTexture(gl.TEXTURE_CUBE_MAP, unit.texture_cube.glObject);
            }
            if (unit.texture_2d_array !== undefined) {
                gl.bindTexture(gl.TEXTURE_2D_ARRAY, unit.texture_2d_array.glObject);
            }
        }

        // Perform the draw call.
        gl.drawElements(
            gl.TRIANGLES,
            drawCall.count,
            drawCall.vao.ibo.type,
            drawCall.offset
        );
    }

    // Always restore the WebGL state.
    finally {
        gl.depthFunc(gl.ALWAYS);
        gl.disable(gl.DEPTH_TEST);
        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
        gl.useProgram(null);
        gl.bindVertexArray(null);
    }
};


// =============================================================================
// Shader Code
// =============================================================================


const phongVertexShader = `#version 300 es
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
`;


const phongFragmentShader = `#version 300 es
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
`;


const skyVertexShader = `#version 300 es
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
`;


const skyFragmentShader = `#version 300 es
    precision mediump float;

    uniform samplerCube u_skybox;

    in vec3 f_texCoord;

    out vec4 FragColor;

    void main() {
        // The fragment color is simply the color of the skybox at the given
        // texture coordinate (local coordinate) of the fragment on the cube.
        FragColor = texture(u_skybox, f_texCoord);
    }
`;


// =============================================================================
// Constants
// =============================================================================

const projectionMatrix = mat4.perspective(Math.PI / 4, 1, 0.1, 14);

const rocketScale = 0.05;
const rocketDistance = 1.5;
const rocketSpeed = 0.0003;
const rocketCount = 40;

const phongShader = glance.buildShaderProgram(gl, "phong-shader", phongVertexShader, phongFragmentShader, {
    u_ambient: 0.1,
    u_specular: 0.6,
    u_shininess: 64,
    u_lightPos: [0, 0, 5],
    u_lightColor: [1, 1, 1],
    u_projectionMatrix: projectionMatrix,
    u_texAmbient: 0,
    u_texDiffuse: 1,
    u_texSpecular: 2,
});

// Earth -----------------------------------------------------------------------

const earthIBO = glance.createIndexBuffer(gl, glance.createSphereIndices(64, 64));

const earthABO = glance.createAttributeBuffer(gl, "earth-abo", glance.createSphereAttributes(.9, 64, 64), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
});

const earthVAO = createVAO(
    gl,
    "earth-vao",
    earthIBO,
    glance.buildAttributeMap(phongShader, earthABO)
);
const earthTextureAmbient = await glance.loadTextureNow(gl, "./img/Earth_Ambient.avif");
const earthTextureDiffuse = await glance.loadTextureNow(gl, "./img/Earth_Diffuse.avif");
const earthTextureSpecular = await glance.loadTextureNow(gl, "./img/Earth_Specular.avif");

// Rockets ---------------------------------------------------------------------

const { attributes: rocketAttr, indices: rocketIdx } = await glance.loadObj("./obj/rocket.obj");

const rocketIBO = glance.createIndexBuffer(gl, rocketIdx);

const rocketABO = glance.createAttributeBuffer(gl, "rocket-abo", rocketAttr, {
    a_pos: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
});

const rocketVAO = createVAO(
    gl,
    "rocket-vao",
    rocketIBO,
    glance.buildAttributeMap(phongShader, rocketABO)
);
const rocketTextureAmbient = await glance.loadTextureNow(gl, "./img/Rocket_Ambient.avif");
const rocketTextureDiffuse = await glance.loadTextureNow(gl, "./img/Rocket_Diffuse.avif");
const rocketTextureSpecular = await glance.loadTextureNow(gl, "./img/Rocket_Specular.avif");

const rocketInstanceAttributes = new Float32Array(rocketCount * 25); // 16 + 9

function updateRocketInstanceAttributes(time)
{
    for (let i = 0; i < rocketCount; i++) {
        const modelMatrix = mat4.multiply(
            mat4.fromRotation(i * (Math.PI / rocketCount), [0, 1, 0]),
            mat4.multiply(
                mat4.multiply(
                    mat4.fromRotation(i + rocketSpeed * time, [0, 0, -1]),
                    mat4.fromTranslation([-rocketDistance, 0, 0]),
                ),
                mat4.fromScaling(rocketScale),
            ),
        );

        const arrayOffset = i * 25;
        rocketInstanceAttributes.set(modelMatrix, arrayOffset);
        const normalMatrix = mat3.fromMat4(mat4.transpose(mat4.invert(modelMatrix)));
        rocketInstanceAttributes.set(normalMatrix, arrayOffset + 16);
    }
}

// Skybox ----------------------------------------------------------------------

const skyShader = glance.buildShaderProgram(gl, "sky-shader", skyVertexShader, skyFragmentShader, {
    u_projectionMatrix: projectionMatrix,
    u_skybox: 0,
});

const skyIBO = glance.createIndexBuffer(gl, glance.createSkyBoxIndices());

const skyABO = glance.createAttributeBuffer(gl, "sky-abo", glance.createSkyBoxAttributes(), {
    a_pos: { size: 3, type: gl.FLOAT },
});

const skyVAO = createVAO(gl, "sky-vao", skyIBO, glance.buildAttributeMap(skyShader, skyABO));

const skyCubemap = await glance.loadCubemapNow(gl, "sky-texture", [
    "./img/Skybox_Right.avif",
    "./img/Skybox_Left.avif",
    "./img/Skybox_Top.avif",
    "./img/Skybox_Bottom.avif",
    "./img/Skybox_Front.avif",
    "./img/Skybox_Back.avif",
]);


// =============================================================================
// Draw Calls
// =============================================================================


// Scene State
let viewDist = 4.5;
let viewPan = 0;
let viewTilt = 0;
let panDelta = 0;
let tiltDelta = 0;
let rocketId = 0;

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

const earthModelMatrix = new glance.TimeSensitive(
    (time) => mat4.multiply(mat4.identity(), mat4.fromRotation(0.0002 * time, [0, 1, 0]))
);

const earthDrawCall = glance.createDrawCall(
    gl,
    phongShader,
    earthVAO,
    {
        uniforms: {
            u_modelMatrix: (time) => earthModelMatrix.getAt(time),
            u_normalMatrix: (time) => mat3.fromMat4(mat4.transpose(mat4.invert(earthModelMatrix.getAt(time)))),
            u_viewMatrix: () => mat4.invert(viewMatrix.get()),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewMatrix.get()),
        },
        textures: [
            [0, earthTextureAmbient],
            [1, earthTextureDiffuse],
            [2, earthTextureSpecular],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

const rocketDrawCall = glance.createDrawCall(
    gl,
    phongShader,
    rocketVAO,
    {
        uniforms: {
            u_modelMatrix: () => rocketInstanceAttributes.slice(rocketId * 25, rocketId * 25 + 16),
            u_normalMatrix: () => rocketInstanceAttributes.slice(rocketId * 25 + 16, (rocketId + 1) * 25),
            u_viewMatrix: () => mat4.invert(viewMatrix.get()),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewMatrix.get()),
        },
        textures: [
            [0, rocketTextureAmbient],
            [1, rocketTextureDiffuse],
            [2, rocketTextureSpecular],
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
            u_viewRotationMatrix: () => mat3.fromMat4(viewRotationMatrix.get()),
        },
        textures: [
            [0, skyCubemap],
        ],
        cullFace: gl.NONE,
        depthTest: gl.LEQUAL,
    }
);


// =============================================================================
// System Integration
// =============================================================================

let lastTime = 0;
let deltas = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let deltaPtr = 0;

setRenderLoop((time) =>
{
    const deltaTime = time - lastTime;
    lastTime = time;
    deltas[deltaPtr] = deltaTime;
    deltaPtr = (deltaPtr + 1) % deltas.length;
    const avgDeltaTime = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    if (deltaPtr == 0) console.log(avgDeltaTime);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    if (panDelta != 0 || tiltDelta != 0) {
        viewPan += panDelta * .02;
        viewTilt += tiltDelta * .02;
        viewRotationMatrix.setDirty();
    }

    updateRocketInstanceAttributes(time);

    performDrawCall(gl, earthDrawCall, time);
    for (rocketId = 0; rocketId < rocketCount; rocketId++) {
        performDrawCall(gl, rocketDrawCall, time);
    }
    performDrawCall(gl, skyDrawCall, time);
});

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