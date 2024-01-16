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

// User Input
const panAcceleration = 0.008;
const tiltAcceleration = 0.008;
const zoomAcceleration = 0.2;
const cameraMinDistance = 1.2;
const cameraMaxDistance = 5;

// Camera
const cameraFov = Math.PI / 4;       // field of view of the camera in radians
const nearPlane = 0.1;               // near clipping plane
const farPlane = 6;                  // far clipping plane
const projectionMatrix = mat4.perspective(cameraFov, 1, nearPlane, farPlane);

// Light
const lightPositions = [
    -10, 10, 10,
    10, 10, 10,
    -10, -10, 10,
    10, -10, 10,
];
let lightColors = [
    120, 120, 120,
    320, 320, 320,
    120, 120, 120,
    40, 40, 40,
];
const ambient = 0.003;

// =============================================================================
// Shader Code
// =============================================================================

const vertexShaderSource = `#version 300 es
precision highp float;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat3 u_normalMatrix;

in vec3 a_pos;
in vec3 a_normal;
in vec3 a_tangent;
in vec2 a_texCoord;

out vec3 f_worldPos;
out vec2 f_texCoord;
out mat3 f_tbn;

void main() {
    vec4 worldPos = u_modelMatrix * vec4(a_pos, 1.0);

    vec3 normal = u_normalMatrix * a_normal;
    vec3 tangent = u_normalMatrix * a_tangent;
    vec3 bitangent = cross(normal, tangent);

    f_worldPos = worldPos.xyz;
    f_texCoord = a_texCoord;
    f_tbn = mat3(tangent, bitangent, normal);

    gl_Position = u_projectionMatrix * u_viewMatrix * worldPos;
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

// Material parameters.
uniform float u_ambient;
uniform vec3 u_viewPos;
uniform vec3 u_lightPos[4];
uniform vec3 u_lightColor[4];
uniform sampler2D u_texAlbedo;
uniform sampler2D u_texNormal;
uniform sampler2D u_texRoughness;
uniform sampler2D u_texMetalness;

// Varying inputs from the vertex shader.
in vec3 f_worldPos;
in vec2 f_texCoord;
in mat3 f_tbn;

// Output fragment color.
out vec4 o_FragColor;

// Constants
const float gamma = 2.2;
const float pi = 3.14159265359;

// Forward declarations.
vec3 brdf(vec3, vec3, vec3, vec3, vec3, float, float);

// =============================================================================
// Main
// =============================================================================

void main()
{
    // Sample the textures.
    vec3 albedo = pow(texture(u_texAlbedo, f_texCoord).rgb, vec3(gamma)); // linearize
    vec3 texNormal = texture(u_texNormal, f_texCoord).rgb;
    float roughness = texture(u_texRoughness, f_texCoord).r;
    float metalness = texture(u_texMetalness, f_texCoord).r;

    // Apply the normal map to the surface normal.
    vec3 surfaceNormal = normalize(f_tbn * (texNormal * (255./128.) - 1.0));

    // A normal vector pointing from the world position of the fragment towards
    // the camera.
    vec3 viewNormal = normalize(u_viewPos - f_worldPos);

    // The base reflectivity is how much light is reflected by the surface when
    // looking straight at it. This is also known as F0 (F-Zero) or the
    // Fresnel reflectance at normal incidence.
    // For dielectric materials, this is a constant value of 0.04.
    // For metals, this is the albedo color of the material.
    vec3 baseReflectivity = mix(vec3(0.04), albedo, metalness);

    // Ambient light is the light that is always present, no matter how much
    // direct light is hitting the surface.
    vec3 ambient = u_ambient * albedo;

    // The total radiance is the sum of the radiance from each light source.
    vec3 totalRadiance = vec3(0.0);

    // Calculate the radiance from each light source.
    for(int i = 0; i < 4; ++i)
    {
        // A vector pointing from the world position of the fragment towards the
        // light source.
        vec3 lightVector = u_lightPos[i] - f_worldPos;
        vec3 lightNormal = normalize(lightVector);

        // Calculate the radiance from this light source.
        vec3 radiance;
        {
            // We require the distance to the light source to calculate the
            // attenuation factor.
            // Actually, we need the squared distance, which is cheaper to
            // calculate anyway.
            float lightDistanceSq = dot(lightVector, lightVector);

            // Light attenuation is the inverse square of the distance.
            float attenuation = 1.0 / lightDistanceSq;

            // The radiance from a light is the product of the light color and
            // the attenuation factor.
            radiance = u_lightColor[i] * attenuation;
        }

        // The incident angle is the angle between the surface normal and the
        // light normal. The light is strongest if it is pointed directly at the
        // surface and weakest if it is pointed perpendicular or away from the
        // surface, in which case the light is not hitting the surface at all.
        // We clamp the factor to the range [0, 1] to prevent negative light.
        float incidenceFactor = clamp(dot(surfaceNormal, lightNormal), 0.0, 1.0);

        // The BRDF, or bidirectional reflective distribution function, is a
        // function that approximates how much each individual light ray
        // contributes to the final reflected light of an opaque surface given
        // its material properties.
        vec3 brdfResult = brdf(
            lightNormal,
            viewNormal,
            surfaceNormal,
            baseReflectivity,
            albedo,
            roughness,
            metalness
        );

        // Add the radiance from this light source to the total radiance.
        totalRadiance += radiance * incidenceFactor * brdfResult;
    }

    // The combined color is the sum of the ambient light and the total radiance.
    vec3 color = ambient + totalRadiance;

    // Reinhard HDR tone mapping.
    // Tone mapping is the process of mapping the high dynamic range of the
    // lighting calculations to the low dynamic range of the display by
    // squeezing the floating point color values into the range [0, 1].
    color = color / (color + vec3(1.0));

    // Apply gamma correction.
    color = pow(color, vec3(1.0/gamma));

    // Output the final color.
    o_FragColor = vec4(color, 1.0);
}

// =============================================================================
// BRDF
// =============================================================================

// Forward declarations.
float DistributionGGX(vec3, vec3, float);
float GeometrySmith(vec3, vec3, vec3, float);
vec3 fresnelSchlick(vec3, vec3, vec3);

/// The Cook-Torrance BRDF is a physically based BRDF that is based on the
/// microfacet theory of light reflection. It is a more accurate BRDF than the
/// Blinn-Phong BRDF, but it is also more expensive to calculate.
vec3 brdf(
    vec3 lightNormal,
    vec3 viewNormal,
    vec3 surfaceNormal,
    vec3 baseReflectivity,
    vec3 albedo,
    float roughness,
    float metalness)
{
    // The halfway vector is a normal vector pointing halfway between the view
    // vector and the light vector. The closer this halfway vector aligns with
    // the surface's (microfacet's) normal vector, the higher the specular
    // contribution of the light.
    vec3 halfwayNormal = normalize(viewNormal + lightNormal);

    // The Normal Distribution Function, is a function that describes the
    // distribution of theoretical microfacets on a surface. Microfacets are
    // small, flat areas that together make up the surface. The NDF describes
    // how many microfacets are aligned with the halfway vector.
    float normalDistribution = DistributionGGX(surfaceNormal, halfwayNormal, roughness);

    // The Geometry Function, describes the self-shadowing property of the
    // microfacets. When a surface is relatively rough, the surface's microfacets
    // can overshadow other microfacets reducing the light the surface reflects.
    // Generally speaking, the occlusion of microfacets tends to increase as the
    // angle between the surface normal and the halfway vector increases.
    float geometryTerm = GeometrySmith(surfaceNormal, viewNormal, lightNormal, roughness);

    // The fresnel term describes the reflectivity of the surface based on the
    // angle of incidence of the light. Here we use the Schlick approximation
    // of the Fresnel equation.
    vec3 fresnel = fresnelSchlick(halfwayNormal, viewNormal, baseReflectivity);

    // Calculate the Cook-Torrance BRDF.
    vec3 specular;
    {
        float viewAngle = max(dot(surfaceNormal, viewNormal), 0.0);
        float lightAngle = max(dot(surfaceNormal, lightNormal), 0.0);
        specular = (normalDistribution * geometryTerm * fresnel) /
                    (4.0 * viewAngle * lightAngle + 0.0001); // Prevent division by zero.
    }

    // For energy conservation, the sum of the diffuse and specular light cannot
    // be above 1.0 (unless the surface emits light). To preserve this, we define
    // the diffuse light as the remaining light not reflected by the specular.
    // Since the reflected light is defined by the fresnel term (not the complete
    // specular term), we can calculate the diffuse light as 1.0 - fresnel.
    vec3 diffuse = (vec3(1.0) - fresnel) * (albedo / pi);

    // Only dielectric materials have diffuse light - metals have none.
    // Decrease the diffuse light as the material becomes more metallic.
    diffuse *= 1.0 - metalness;

    // The final BRDF is the sum of the diffuse and specular light.
    return diffuse + specular;
}


float DistributionGGX(vec3 surfaceNormal, vec3 halfwayNormal, float roughness)
{
    float a = roughness*roughness;
    float NdotH = max(dot(surfaceNormal, halfwayNormal), 0.0);
    float NdotH2 = NdotH*NdotH;

    float nom   = a*a;
    float denom = (NdotH2 * (nom - 1.0) + 1.0);
    denom = pi * denom * denom;

    return nom / denom;
}

float GeometrySchlickGGX(float cosAngle, float roughness)
{
    float r = roughness + 1.0;
    float k = (r*r) / 8.0;
    return cosAngle / (cosAngle * (1.0 - k) + k);
}
float GeometrySmith(vec3 surfaceNormal, vec3 viewNormal, vec3 lightNormal, float roughness)
{
    float ggx1 = GeometrySchlickGGX(max(dot(surfaceNormal, lightNormal), 0.0), roughness);
    float ggx2 = GeometrySchlickGGX(max(dot(surfaceNormal, viewNormal), 0.0), roughness);
    return ggx1 * ggx2;
}

vec3 fresnelSchlick(vec3 halfwayNormal, vec3 viewNormal, vec3 baseReflectivity)
{
    float cosAngle = clamp(dot(halfwayNormal, viewNormal), 0.0, 1.0);
    return baseReflectivity + (1.0 - baseReflectivity) * pow(1.0 - cosAngle, 5.0);
}
`;

const shaderProgram = glance.buildShaderProgram(gl,
    "shader",
    vertexShaderSource,
    fragmentShaderSource,
    {
        u_modelMatrix: mat4.fromTranslation([0, 0, 0]),
        u_normalMatrix: mat3.identity(),
        u_projectionMatrix: projectionMatrix,
        u_lightPos: lightPositions,
        u_lightColor: lightColors,
        u_ambient: ambient,
        u_texAlbedo: 0,
        u_texNormal: 1,
        u_texRoughness: 2,
        u_texMetalness: 3,
    },
);

// =============================================================================
// Geometry
// =============================================================================

const objectIBO = glance.createIndexBuffer(gl, glance.createSphereIndices(64, 64));

const objectABO = glance.createAttributeBuffer(gl, "object-abo", glance.createSphereAttributes(.9, 64, 64, {
    tangent: true,
    uvScale: [2.5, 1.5],
}), {
    a_pos: { size: 3, type: gl.FLOAT },
    a_normal: { size: 3, type: gl.FLOAT },
    a_texCoord: { size: 2, type: gl.FLOAT },
    a_tangent: { size: 3, type: gl.FLOAT },
});

const objectVAO = glance.createVAO(
    gl,
    "object-vao",
    objectIBO,
    glance.buildAttributeMap(shaderProgram, objectABO)
);

// =============================================================================
// Camera
// =============================================================================

let viewDist = 3.;
let viewPan = 0;
let viewTilt = 0;

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

onMouseDrag((e) =>
{
    viewPan -= e.movementX * panAcceleration;
    viewTilt -= e.movementY * tiltAcceleration;
    viewRotation.setDirty();
});

onMouseWheel((e) =>
{
    viewDist = Math.max(cameraMinDistance,
        Math.min(cameraMaxDistance,
            viewDist * (1 + Math.sign(e.deltaY) * zoomAcceleration)));
    viewXform.setDirty();
});

// =============================================================================
// Rendering
// =============================================================================

// Textures by https://freepbr.com/materials/rusted-iron-pbr-metal-material-alt/
const texAlbedo = await glance.loadTextureNow(gl, "./img/rusted_albedo.avif", { wrap: gl.REPEAT });
const texNormal = await glance.loadTextureNow(gl, "./img/rusted_normal.avif", { wrap: gl.REPEAT });
const texRoughness = await glance.loadTextureNow(gl, "./img/rusted_roughness.avif", { wrap: gl.REPEAT });
const texMetalness = await glance.loadTextureNow(gl, "./img/rusted_metallic.avif", { wrap: gl.REPEAT });

const drawCall = glance.createDrawCall(
    gl,
    shaderProgram,
    objectVAO,
    {
        uniforms: {
            u_viewMatrix: () => mat4.invert(viewXform.get()),
            u_viewPos: () => vec3.transformMat4(vec3.zero(), viewXform.get()),
        },
        textures: [
            [0, texAlbedo],
            [1, texNormal],
            [2, texRoughness],
            [3, texMetalness],
        ],
        depthTest: gl.LESS,
    }
);

setRenderLoop((time) =>
{
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    glance.performDrawCall(gl, drawCall, time);
});
