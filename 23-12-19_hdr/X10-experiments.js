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
// Shader Code
// =============================================================================

// Quad ------------------------------------------------------------------------

const quadVertexShader = `#version 300 es
    precision highp float;

    in vec2 a_pos;

    void main() {
        gl_Position = vec4(a_pos, 0.0, 1.0);
    }
`;

const quadFragmentShader = `#version 300 es
    precision mediump float;

    uniform int u_mode;
    uniform sampler2D u_texture;

    out vec4 o_fragColor;

    // Exact conversion from sRGB activation to linear space.
    // See https://stackoverflow.com/a/56678483
    // and https://registry.khronos.org/OpenGL/extensions/EXT/EXT_sRGB.txt
    float sRGBtoLinear(float s) {
      if(s <= 0.04045) {
        return s / 12.92;
      }
      return pow((s + 0.055) / 1.055, 2.4);
    }

    // Exact conversion from linear to sRGB activation.
    // Is approximated by 'pow(c, 1.0/gamma)' with a gamma of 2.2
    // See https://registry.khronos.org/OpenGL/extensions/EXT/EXT_sRGB.txt
    float linearToSRGB(float c) {
      if(c <= 0.0) {
        return 0.0;
      } else if(c < 0.0031308) {
        return 12.92 * c;
      } else if(c < 1.0) {
        return 1.055 * pow(c, 0.41666) - 0.055;
      } else {
        return 1.0;
      }
    }

    // Send this function a luminance value between 0.0 and 1.0,
    // and it returns L* which is "perceptual lightness" in the same range.
    // See https://stackoverflow.com/a/56678483
    float YtoLstar(float Y) {
      if ( Y <= 216.0/24389.0) {
          return Y * (24389.0/2700.0);
      } else {
          return pow(Y, 1.0/3.0) * 1.16 - 0.16;
      }
    }

    void showTexture()
    {
      vec3 tex = texture(u_texture, gl_FragCoord.xy / vec2(512.0)).rgb;
      o_fragColor = vec4(tex, 1.0);
    }

    void showUnweightedGrayscaleTexture()
    {
      vec3 tex = texture(u_texture, gl_FragCoord.xy / vec2(512.0)).rgb;
      float luminance = (tex.x + tex.y + tex.z) / 3.0;
      o_fragColor = vec4(vec3(luminance), 1.0);
    }

    void showWeightedGrayscaleTexture()
    {
      vec3 tex = texture(u_texture, gl_FragCoord.xy / vec2(512.0)).rgb;
      float luminance = 0.2126 * tex.r + 0.7152 * tex.g + 0.0722 * tex.b;
      o_fragColor = vec4(vec3(luminance), 1.0);
    }

    void showCorrectedGrayscaleTexture()
    {
      vec3 tex = texture(u_texture, gl_FragCoord.xy / vec2(512.0)).rgb;
      float luminance = 0.2126 * sRGBtoLinear(tex.r) + 0.7152 * sRGBtoLinear(tex.g) + 0.0722 * sRGBtoLinear(tex.b);
      float perceptualLuminance = YtoLstar(luminance);
      o_fragColor = vec4(vec3(perceptualLuminance), 1.0);
    }

    void gammaCorrected()
    {
      vec3 tex = texture(u_texture, gl_FragCoord.xy / vec2(512.0)).rgb;
      tex = vec3(linearToSRGB(tex.r), linearToSRGB(tex.g), linearToSRGB(tex.b));
      o_fragColor = vec4(tex, 1.0);
    }

    void showLinear()
    {
      float t = gl_FragCoord.x / 512.0;
      o_fragColor = vec4(t, t, t, 1.0);
    }

    void showBands(int numBands)
    {
      float band = float(int(gl_FragCoord.x)/ (512 / numBands)) / float(numBands);
      o_fragColor = vec4(band, band, band, 1.0);
    }

    void showBandsPhysical(int numBands)
    {
        float band = float(int(gl_FragCoord.x)/ (512 / numBands)) / float(numBands);
        band = linearToSRGB(band);
        o_fragColor = vec4(band, band, band, 1.0);
    }

    // Experiment to show that a grey value of 0.5 is not actually half as much
    // light as a quick pattern of repeating white and black lines.
    // Clearly visible when expanding and shrinking the viewport.
    void brightnessComparison(bool showCorrected)
    {
        const float gamma = 2.2;
        if (gl_FragCoord.y < 256.0){
          float t;
          if(showCorrected) {
            t = linearToSRGB(0.5); // approx: pow(0.5, 1.0/gamma);
          } else {
            t = 0.5;
          }
          o_fragColor = vec4(t, t, t, 1.0);
        } else {
          if(int(mod(gl_FragCoord.x, 2.0)) == 0){
            o_fragColor = vec4(0.0, 0.0, 0.0, 1.0);
          } else {
            o_fragColor = vec4(1.0, 1.0, 1.0, 1.0);
          }
        }
    }

    void main() {
        // Grayscale Texture
        if(u_mode == 0){
          showTexture();
        } else if (u_mode == 1) {
          showUnweightedGrayscaleTexture();
        } else if (u_mode == 2) {
          showWeightedGrayscaleTexture();
        }

        // Linear Grayscale Texture
        else if (u_mode == 3) {
          showLinear();
        } else if (u_mode == 4) {
          showBands(16);
        } else if (u_mode == 5) {
          brightnessComparison(false);
        } else if (u_mode == 6) {
          showBandsPhysical(16);
        }

        else if (u_mode == 7) {
          brightnessComparison(true);
        }

        else if (u_mode == 8) {
          showCorrectedGrayscaleTexture();
        }

        else if (u_mode == 9) {
          gammaCorrected();
        }
    }
`;

// =============================================================================
// Geometry
// =============================================================================

// Quad ------------------------------------------------------------------------

const quadShader = glance.buildShaderProgram(gl, "quad-shader", quadVertexShader, quadFragmentShader, {
  u_texture: 0,
});
const quadTexture = await glance.loadTextureNow(gl, "./img/hfu.avif", {
  format:
    gl.RGB8
});

const quadIBO = glance.createIndexBuffer(gl, glance.createQuadIndices());
const quadABO = glance.createAttributeBuffer(gl, "quad-abo", glance.createQuadAttributes({ uvs: false }), {
  a_pos: { size: 2, type: gl.FLOAT },
});
const quadVAO = glance.createVAO(gl, "quad-vao", quadIBO, glance.buildAttributeMap(quadShader, quadABO));

// =============================================================================
// Draw Calls
// =============================================================================

let mode = 0;

// Quad ------------------------------------------------------------------------

const quadDrawCall = glance.createDrawCall(gl, quadShader, quadVAO, {
  textures: [
    [0, quadTexture],
  ],
  uniforms: {
    "u_mode": () => mode,
  },
});

// =============================================================================
// System Integration
// =============================================================================

onKeyDown((e) =>
{
  const ascii = e.key.charCodeAt(0);
  if (ascii >= 48 && ascii <= 57) {
    mode = ascii - 48;
  }
});

setRenderLoop((time) =>
{
  glance.performDrawCall(gl, quadDrawCall, time);
});
//