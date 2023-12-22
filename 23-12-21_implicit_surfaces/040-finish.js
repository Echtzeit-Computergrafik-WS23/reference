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

gl.getExtension("EXT_color_buffer_float");

// =============================================================================
// Constants
// =============================================================================

// Camera
const cameraFov = Math.PI / 4;       // field of view of the camera in radians
const nearPlane = .1;                // near clipping plane
const farPlane = 10;                 // far clipping plane
const viewProjection = mat4.perspective(cameraFov, 1, nearPlane, farPlane);

// Scene
const volumeSize = 1;
const volumeResolution = 512;

// Light
const lightPos = [0, 2, 3];
const lightColor = [1, 1, 1];

// =============================================================================
// Shader Code
// =============================================================================

// Debug -----------------------------------------------------------------------

const debugVertexShader = `#version 300 es
precision highp float;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjection;

in vec3 a_pos;

void main()
{
    gl_Position = u_viewProjection * u_viewMatrix * u_modelMatrix * vec4(a_pos, 1.0);
}`;

const debugFragmentShader = `#version 300 es
precision mediump float;

uniform vec3 u_color;

out vec4 FragColor;

void main() {
    FragColor = vec4(u_color, 1.0);
}`;

const debugShader = glance.buildShaderProgram(gl,
    "debug-shader",
    debugVertexShader,
    debugFragmentShader,
    {
        u_viewProjection: viewProjection,
    },
);

// Volume Rendering ------------------------------------------------------------

const volumeRenderingVertexShader = `#version 300 es
precision highp float;

in vec3 a_pos;

out vec3 f_worldPos;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_viewProjection;

void main()
{
    vec4 worldPos = u_modelMatrix * vec4(a_pos, 1.0);
    f_worldPos = worldPos.xyz;
    gl_Position = u_viewProjection * u_viewMatrix * worldPos;
}`;

const volumeRenderingFragmentShader = `#version 300 es
precision mediump float;
precision mediump sampler3D;

// Varying inputs from the vertex shader.
in highp vec3 f_worldPos;

// Output fragment color.
out vec4 FragColor;

// Uniforms.
uniform vec3 u_viewPos;
uniform vec3 u_lightPos;
uniform vec3 u_lightColor;
uniform float u_ambient;
uniform float u_bias;
uniform mat4 u_invModelMatrix;
uniform mat4 u_volumeMatrix;
uniform mat4 u_invVolumeMatrix;
uniform highp mat4 u_modelMatrix;
uniform highp mat4 u_viewMatrix;
uniform highp mat4 u_viewProjection;
uniform sampler3D u_texVolume;

// Constants.
const float EPSILON = 0.001;
const float MIN_STEP_LENGTH = 0.002;
const uint MAX_STEP_COUNT = 120u;

// Forward declarations.
bool marchRay(in vec3 rayDirection, out vec3 surfacePosition, out vec3 surfaceNormal);
float volumeCheckerboard(in vec3 p);

// =============================================================================
// Main
// =============================================================================

void main()
{
    // Direction (of length 1) from the view point to the fragment,
    // both in world space.
    vec3 viewDirection = normalize(u_viewPos - f_worldPos);

    // Use ray marching to find the surface position of the volume.
    vec3 surfacePos, surfaceNormal;
    if(!marchRay(viewDirection, surfacePos, surfaceNormal)) {
        // In case of failure, color the fragment a deep pink for debugging...
        FragColor = vec4(1.0, 0.0, 1.0, 1.0);
        // .. and place it at the near clipping plane.
        gl_FragDepth = 0.0;
        // This ends the execution of the fragment shader.
        return;
    }

    // Determine the depth of the fragment.
    // Manually transform the surface position from world space to clip space.
    vec4 clipPos = u_viewProjection * u_viewMatrix * vec4(surfacePos, 1.0);
    // The normalized device coordinate (NDC) depth value, in the range [-1, 1].
    float ndcDepth = clipPos.z / clipPos.w;
    // The depth value must be in the range defined by gl_DepthRange.
    gl_FragDepth = mix(gl_DepthRange.near, gl_DepthRange.far, (ndcDepth + 1.0) / 2.0);

    // Use Blinn shading to compute the color of the fragment.
    vec3 lightDir = normalize(u_lightPos - f_worldPos);
    vec3 halfwayDir = normalize(lightDir + viewDirection);
    vec3 ambient = vec3(u_ambient);
    vec3 diffuse =  u_lightColor * max(dot(lightDir, surfaceNormal), 0.0);
    vec3 specular = pow(max(dot(surfaceNormal, halfwayDir), 0.0), 64.0) * u_lightColor * 0.5;

    // Use a checkerboard texture to visualize the volume.
    float texture = mix(0.4, 1.0, volumeCheckerboard((u_volumeMatrix * u_invModelMatrix * vec4(surfacePos * 10.0, 1)).xyz));

    // Output the final color.
    FragColor = vec4((ambient + diffuse) * texture + specular, 1);
}

// =============================================================================
// Ray Marching
// =============================================================================

/// Returns false if p is outside the box (0,0,0) to (1,1,1)
bool notInUnitBox(in vec3 p) {
    vec3 v = step(vec3(0), p) * step(p, vec3(1));
    return v.x * v.y * v.z == 0.0;
}

/// Estimate the normal on the SDF surface at point p using the
/// tetrahedron technique from:
///  https://iquilezles.org/articles/normalsSDF/
vec3 volumeNormal(in vec3 p) {
    const float h = 0.1;
    const vec2 k = vec2(1,-1);
    return normalize(
            k.xyy * texture(u_texVolume, p + k.xyy * h).r +
            k.yyx * texture(u_texVolume, p + k.yyx * h).r +
            k.yxy * texture(u_texVolume, p + k.yxy * h).r +
            k.xxx * texture(u_texVolume, p + k.xxx * h).r);
}

bool marchRay(in vec3 rayDirection, out vec3 surfacePosition, out vec3 surfaceNormal)
{
    // Transform the ray direction from world space to model space.
    rayDirection = normalize((u_volumeMatrix * u_invModelMatrix * vec4(rayDirection, 0.0)).xyz);

    // The position of the fragment in normalized volume space.
    vec3 entryPos = (u_volumeMatrix * u_invModelMatrix * vec4(f_worldPos, 1)).xyz;

    // Start one step deep, otherwise we will get rounding errors
    // when sampling a surface that is right on the boundary of
    // the volume.
    float depth = MIN_STEP_LENGTH;

    // March along the ray until we find the surface or exit the volume.
    // We use a fixed number of steps to avoid infinite loops.
    for (uint stepCount = 0u; stepCount <= MAX_STEP_COUNT; stepCount++) {

        // Advance through the volume along the ray direction.
        vec3 samplePos = entryPos - rayDirection * depth;

        // If the ray has exited the normalized sample volume, we are done.
        if(notInUnitBox(samplePos)) {
            // Discarding the fragment means that it won't affect the color of
            // the pixel, nor will its depth be written to the depth buffer.
            // This immediately ends the execution of the fragment shader.
            discard;
        }

        // Sample the volume at the current position.
        // Since we only use the red component of the volume texture, we can
        // discard the others.
        float sampleValue = texture(u_texVolume, samplePos).r + u_bias;

        // If the sample is negative, the ray has crossed the surface
        if (sampleValue <= 0.0) {

            // Update the depth one last time, further approaching
            // the surface but now from within
            depth += sampleValue;

            // The surface position is the current sample position
            vec3 volumePos = entryPos - rayDirection * depth;

            // Transform the surface position from normalized volume space
            // to world space.
            surfacePosition = (u_modelMatrix * u_invVolumeMatrix * vec4(volumePos, 1)).xyz;

            // The normal is estimated using the tetrahedron technique.
            surfaceNormal = normalize((u_modelMatrix * u_invVolumeMatrix * vec4(volumeNormal(volumePos), 0)).xyz);

            // We have found the surface, so we are done.
            return true;
        }

        // If we did not find the surface yet, we know that we can advance
        // the ray by at least the sample value before we hit the surface.
        // However, no matter how small the smaple value is, we always increase
        // the depth at least by some small (but not tiny) amount, in case we
        // are asymptotically approaching the surface.
        depth += max(sampleValue, MIN_STEP_LENGTH);
    }

    // We did not find the surface within the maximum number of steps,
    // and neither did the ray exit the volume - this is a sign that
    // MAX_STEP_COUNT is too low.
    return false;
}

// =============================================================================
// Checkerboard
// =============================================================================

// https://iquilezles.org/articles/morecheckerfiltering/
vec3 pri( in vec3 x )
{
    vec3 h = fract(x/2.0)-0.5;
    return x*0.5 + h*(1.0-2.0*abs(h));
}

float volumeCheckerboard(in vec3 p)
{
    vec3 w = max(max(abs(dFdx(p)), abs(dFdy(p))), EPSILON); // filter kernel (never zero)
    vec3 i = (pri(p+w)-2.0*pri(p)+pri(p-w))/(w*w);          // analytical integral (box filter)
    return 0.5 - 0.5*i.x*i.y*i.z;                           // xor pattern
}
`;

const volumeRenderingShader = glance.buildShaderProgram(gl,
    "volumeRendering-shader",
    volumeRenderingVertexShader,
    volumeRenderingFragmentShader,
    {
        u_viewProjection: viewProjection,
        u_lightPos: lightPos,
        u_lightColor: lightColor,
        u_ambient: 0.1,
        u_bias: 0.04,
        u_invModelMatrix: mat4.identity(),
        u_volumeMatrix: mat4.multiply(
            mat4.fromScaling([1 / volumeSize, 1 / volumeSize, 1 / volumeSize]),
            mat4.fromTranslation([volumeSize / 2, volumeSize / 2, volumeSize / 2])
        ),
        u_invVolumeMatrix: mat4.multiply(
            mat4.fromScaling([volumeSize, volumeSize, volumeSize]),
            mat4.fromTranslation([-.5, -.5, -.5])
        ),
        u_texVolume: 0,
    },
);

// Volume Definition -----------------------------------------------------------

const volumeDefVertexShader = `#version 300 es
precision highp float;

in vec2 a_pos;

void main()
{
    gl_Position = vec4(a_pos.xy, 0, 1);
}`;

const volumeDefFragmentShader = `#version 300 es
precision mediump float;

out vec4 FragColor;

uniform vec3 u_resolution;
uniform float u_depth;

// Simple SDF functions, from https://iquilezles.org/articles/distfunctions

float sphere(vec3 samplePos, vec3 center, float radius) {
    return length(samplePos - center) - radius;
}

float add(float a, float b) {
    return min(a, b);
}

float sub(float a, float b) {
    return max(a, -b);
}

const float SMOOTHING = 0.02;

float addSmooth( float a, float b ) {
    float h = clamp(0.5 + 0.5 * (b - a) / SMOOTHING, 0.0, 1.0);
    return mix(b, a, h) - SMOOTHING * h * (1.0 - h);
}

float subSmooth( float a, float b) {
    float h = clamp(0.5 - 0.5 * (a + b) / SMOOTHING, 0.0, 1.0);
    return mix(a, -b, h) + SMOOTHING * h * (1.0 - h);
}

void main() {

    // We derive the sample position from the position of the fragment
    // in the image plane (for the x/y coordinates) and the depth value,
    // which is passed in as a uniform.
    vec3 samplePos = vec3(gl_FragCoord.xy, u_depth);

    // All positions start at zero and go to 'u_resolution - 1' on their
    // respective axis. This means that the sample position is at the
    // corner of the voxel closest to zero. We instead want it to be at
    // the center of the voxel, so we add 0.5 to each component.
    samplePos += vec3(0.5);

    // Lastly, we divide by the resolution to get the sample position
    // in the range [0, 1].
    samplePos /= u_resolution;

    float sdf =
        subSmooth(
            addSmooth(
                sphere(samplePos, vec3(0.4, 0.4, 0.5), 0.3),
                sphere(samplePos, vec3(0.6, 0.6, 0.5), 0.3)
            ),
            sphere(samplePos, vec3(0.4, 0.7, 0.5), 0.25)
        );


    FragColor = vec4(sdf, 0, 0, 0);
}`;

const volumeDefShader = glance.buildShaderProgram(gl,
    "volumeDefinition-shader",
    volumeDefVertexShader,
    volumeDefFragmentShader,
    {
        u_resolution: [volumeResolution, volumeResolution, volumeResolution],
    },
);

// =============================================================================
// Volume Definition
// =============================================================================

// The 3D Texture containing the signed distance field.
const volumeTexture = glance.createTexture(gl, "volume-texture", 512, 512, gl.TEXTURE_3D, 512, {
    internalFormat: gl.R16F,
    levels: 1,
    wrap: gl.CLAMP_TO_EDGE,
    filter: gl.LINEAR,
});

// Render the volume definition into the volume texture.
// This happens only once, outside of the main render loop.
{
    const volumeDefABO = glance.createAttributeBuffer(gl,
        "screen-quad-abo",
        glance.createQuadAttributes({
            uvs: false,
        }), {
        a_pos: { size: 2, type: gl.FLOAT },
    });
    const screenQuadVAO = glance.createVAO(gl,
        "screen-quad",
        glance.createIndexBuffer(gl, glance.createQuadIndices()),
        glance.buildAttributeMap(volumeDefShader, volumeDefABO),
    );

    let slice = 0;
    const volumeSliceDrawCall = glance.createDrawCall(gl,
        volumeDefShader,
        screenQuadVAO,
        {
            uniforms: {
                u_depth: () => slice,
            },
        }
    );

    const framebuffer = glance.createFramebuffer(gl, "volume-framebuffer", {
        attachment: volumeTexture,
        layer: 0,
    });
    const framebufferStack = new glance.FramebufferStack();
    framebufferStack.push(gl, framebuffer);
    for (; slice < volumeResolution; slice++) {
        glance.updateFramebufferLayer(gl, framebuffer, gl.COLOR_ATTACHMENT0, slice);
        glance.performDrawCall(gl, volumeSliceDrawCall, 0);
    }
    framebufferStack.pop(gl);
}

// =============================================================================
// Geometry
// =============================================================================

// Ground ----------------------------------------------------------------------

const groundABO = glance.createAttributeBuffer(gl,
    "ground-abo",
    glance.createBoxAttributes(2, {
        height: 0.01,
        depth: 2,
    }),
    {
        a_pos: { size: 3, type: gl.FLOAT },
        a_normal: { size: 3, type: gl.FLOAT },
        a_texCoord: { size: 2, type: gl.FLOAT },
    },
);
const groundVAO = glance.createVAO(gl,
    "ground-vao",
    glance.createIndexBuffer(gl, glance.createBoxIndices()),
    glance.buildAttributeMap(debugShader, groundABO),
);

const groundDrawCall = glance.createDrawCall(
    gl,
    debugShader,
    groundVAO,
    {
        uniforms: {
            u_color: () => [.19, .19, .19],
            u_modelMatrix: () => mat4.fromTranslation([0, -.5, 0]),
            u_viewMatrix: () => invViewXform.get(),
        },
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

// Volume ----------------------------------------------------------------------

const volumeBoxABO = glance.createAttributeBuffer(gl,
    "volume-box-abo",
    glance.createBoxAttributes(),
    {
        a_pos: { size: 3, type: gl.FLOAT },
        a_normal: { size: 3, type: gl.FLOAT },
        a_texCoord: { size: 2, type: gl.FLOAT },
    },
);
const volumeBoxVAO = glance.createVAO(gl,
    "volume-box-vao",
    glance.createIndexBuffer(gl, glance.createBoxIndices()),
    glance.buildAttributeMap(volumeRenderingShader, volumeBoxABO),
);

const volumeBoxDrawCall = glance.createDrawCall(
    gl,
    volumeRenderingShader,
    volumeBoxVAO,
    {
        uniforms: {
            u_color: () => [.5, .5, .5],
            u_modelMatrix: () => mat4.identity(),
            u_viewMatrix: () => invViewXform.get(),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, volumeTexture],
        ],
        cullFace: gl.BACK,
        depthTest: gl.LESS,
    }
);

// =============================================================================
// Scene
// =============================================================================

let viewDist = 2.3;
let viewPan = 0;
let viewTilt = Math.PI / -10;

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

setRenderLoop((time) =>
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, volumeBoxDrawCall, time);
    glance.performDrawCall(gl, groundDrawCall, time);
});