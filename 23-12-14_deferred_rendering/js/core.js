export { createAttributeBuffer, createDrawCall, createFragmentShader, createFramebuffer, createIndexBuffer, createRenderbuffer, createShaderProgram, createTexture, createVAO, createVertexShader, deleteShader, getContext, performDrawCall, updateFramebufferLayer, updateTexture, 
// TODO: these should not be part of the public API per-se, but I need them
// in the course to implement "manual" versions of the function
setUniform, calcOffset, calcStride, getAttributeSize, };
import { AttachmentType, AttributeDataType, CullFace, DepthTest, ShaderStage, TextureCompareFunc, TextureDataTarget, TextureFilter, TextureInternalFormat, TextureSrcDataType, TextureTarget, TextureWrap, } from "./types.js";
import { assert, DEBUG, logInfo, logWarning, throwError, } from "./dev.js";
import { isPowerOf2, } from './math.js';
// TODO: ensure that all exceptions leave the WebGL state unchanged (that includes the removal of created objects)
// TODO: use samplers? We'll need them in WebGPU anyway.
// Context ================================================================== //
/**
 * Get the WebGL2 context from a canvas element in the DOM.
 * @param canvasId The id of the canvas element.
 * @param options The WebGL2 context options:
 *  - `antialias`: Whether to enable antialiasing. Defaults to `true`.
 *  - `alpha`: Whether to enable alpha. Defaults to `true`.
 *  - `depth`: Whether to enable depth. Defaults to `true`.
 *  - `stencil`: Whether to enable stencil. Defaults to `false`.
 *  - `premultipliedAlpha`: Whether to enable premultiplied alpha. Defaults to `false`.
 *  - `desynchronized`: Whether to enable desynchronized. Defaults to `true`.
 *  - `preserveDrawingBuffer`: Whether to preserve the drawing buffer. Defaults to `true`.
 * @return The WebGL2 context.
 * @throws If the canvas element could not be found or if WebGL2 is not supported.
 *
 * The defaults followed by this call do not match the defaults of the WebGL2 context.
 * Instead, they reflect the best practices for WebGL2:
 *  - antialias is false by default, because it is expensive
 *  - alpha is true by default, because it is expensive to disable (see https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#avoid_alphafalse_which_can_be_expensive)
 *  - preserveDrawingBuffer is true by default, because it is useful for debugging and follows OpenGL's behavior
 */
function getContext(canvasId, options = {}) {
    const canvasElement = document.querySelector(`#${canvasId}`);
    if (canvasElement == null) {
        throwError(() => `Could not find canvas element with id "${canvasId}"`);
    }
    const gl = canvasElement.getContext('webgl2', {
        antialias: options.antialias ?? true,
        alpha: options.alpha ?? true,
        depth: options.depth ?? true,
        stencil: options.stencil ?? false,
        premultipliedAlpha: options.premultipliedAlpha ?? false,
        desynchronized: options.desynchronized ?? true,
        preserveDrawingBuffer: options.preserveDrawingBuffer ?? true,
    });
    if (gl == null) {
        throwError(() => `Could not acquire a WebGL2 context from canvas with id "${canvasId}"`);
    }
    // Test various WebGL2 extensions.
    if (gl.getExtension('EXT_color_buffer_float') == null) {
        logWarning(() => 'EXT_color_buffer_float is not supported.');
    }
    return gl;
}
// Vertex Buffers =========================================================== //
/**
 * @param type Attribute data type to inspect.
 * @returns Size of the given attribute data type in bytes.
 */
function getAttributeDataSize(type) {
    switch (type) {
        case (AttributeDataType.BYTE):
        case (AttributeDataType.UNSIGNED_BYTE):
            return 1;
        case (AttributeDataType.SHORT):
        case (AttributeDataType.UNSIGNED_SHORT):
        case (AttributeDataType.HALF_FLOAT):
            return 2;
        case (AttributeDataType.INT):
        case (AttributeDataType.UNSIGNED_INT):
        case (AttributeDataType.FLOAT):
        case (AttributeDataType.INT_2_10_10_10_REV):
        case (AttributeDataType.UNSIGNED_INT_2_10_10_10_REV):
            return 4;
        default:
            throwError(() => `Invalid attribute data type: ${type}.`);
    }
}
/**
 * @param description Description of the attribute to inspect.
 * @returns The size of one attribute location in bytes.
 */
function getAttributeSize(description) {
    return description.size * getAttributeDataSize(description.type);
}
/**
 * @param description Description of the attribute to inspect.
 * @returns The width of the attribute in bytes.
 */
function getAttributeWidth(description) {
    return getAttributeSize(description) * (description.width ?? 1);
}
/**
 * @param attributes A list of attributes in a buffer.
 * @returns The stride of the buffer in bytes.
 */
function calcStride(attributes) {
    let stride = 0;
    for (const description of attributes) {
        stride += getAttributeWidth(description);
    }
    return stride;
}
/**
 * @param attribute The attribute to inspect.
 * @returns The offset of the attribute in the buffer in bytes.
 */
function calcOffset(attribute) {
    let offset = 0;
    for (const [name, description] of attribute.buffer.attributes) {
        if (name === attribute.name) {
            return offset;
        }
        offset += getAttributeWidth(description);
    }
    return null;
}
/**
 * Create a new Attribute Buffer Object (ABO) from the given data.
 * @param gl The WebGL context.
 * @param name The name of the buffer.
 * @param attributes The Attributes to use.
 * @param data The data to store in the buffer.
 * @returns The buffer object.
 */
function createAttributeBuffer(gl, name, data, attributes, options = {}) {
    // Ensure that the buffer contents are plausible for the given attributes.
    assert(() => [data.length > 0, `The data for Attribute Buffer "${name}" must not be empty.`]);
    const attributeDescriptions = Object.values(attributes);
    assert(() => [attributeDescriptions.length > 0, `Attribute Buffer "${name}" must have at least one attribute.`]);
    const stride = calcStride(attributeDescriptions) / 4; // stride is in bytes, data is in floats
    assert(() => [data.length % stride === 0, `The size of the data for Attribute Buffer "${name}" must be a multiple of its stride. Size is ${data.length}, stride is ${stride}.`]);
    // Create the VBO.
    const vbo = gl.createBuffer();
    if (vbo === null) {
        throwError(() => `Failed to create a new WebGL buffer for attribute buffer "${name}".`);
    }
    // Bind the VBO and store the data.
    const dataArray = new Float32Array(data);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, dataArray, options.usage ?? gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    // Crate the Attribute Buffer Object.
    return {
        name: name,
        glObject: vbo,
        size: data.length / stride,
        attributes: new Map(Object.entries(attributes)),
    };
}
/** Create an index buffer from the given data.
 * Simplified version of the `createAttributeBuffer` function above, used for indices.
 * @param gl The WebGL context.
 * @param indices A JavaScript array containing the indices.
 * @returns The buffer object.
 */
function createIndexBuffer(gl, indices, options = {}) {
    // Ensure that the indicies are valid.
    assert(() => [indices.length > 0, "'indices' must not be empty."]);
    assert(() => [indices.length % 3 === 0, "The size of 'indices' must be a multiple of 3."]);
    // Find the highest index.
    let highestIndex = 0;
    for (const index of indices) {
        highestIndex = Math.max(highestIndex, index);
    }
    // Determine the best data type for the index buffer.
    let type;
    if (options.type !== undefined) {
        type = options.type;
    }
    else if (highestIndex < 256) {
        type = gl.UNSIGNED_BYTE;
    }
    else if (highestIndex < 65536) {
        type = gl.UNSIGNED_SHORT;
    }
    else if (highestIndex < 4294967296) {
        type = gl.UNSIGNED_INT;
    }
    else {
        throwError(() => `Index ${highestIndex} does not fit in a 32-bit unsigned integer.`);
    }
    // Create the data array.
    let data;
    switch (type) {
        case (gl.UNSIGNED_BYTE):
            data = new Uint8Array(indices);
            break;
        case (gl.UNSIGNED_SHORT):
            data = new Uint16Array(indices);
            break;
        case (gl.UNSIGNED_INT):
            data = new Uint32Array(indices);
            break;
        default:
            throwError(() => `Invalid index data type: ${type}.`);
    }
    // Create the buffer and store the data.
    const glBuffer = gl.createBuffer();
    if (glBuffer === null) {
        throwError(() => 'Failed to create a new WebGL index buffer.');
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, options.usage ?? gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    // Return the buffer information.
    return {
        glObject: glBuffer,
        type,
        size: indices.length,
    };
}
/**
 * Creates a new Vertex Array Object (VAO) from the given IBO and attributes.
 * @param gl The WebGL context.
 * @param name The name of the VAO.
 * @param ibo The Index Buffer Object (IBO) to use.
 * @param attributes The Attributes to use.
 * @returns The VAO object.
 */
function createVAO(gl, name, ibo, attributes) {
    // Create and bind the VAO.
    const vao = gl.createVertexArray();
    if (vao === null) {
        throwError(() => `Failed to create a new VAO object for "${name}".`);
    }
    gl.bindVertexArray(vao);
    // Bind the index buffer to the VAO.
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo.glObject);
    // Bind the attribute buffers to the VAO.
    for (const [location, attrRef] of attributes.entries()) {
        const offset = calcOffset(attrRef);
        if (offset === null) {
            throwError(() => `Could not find VAO attribute for location ${location} in Attribute Buffer "${attrRef.buffer.name}".`);
        }
        const attributeName = attrRef.name;
        const attributeBuffer = attrRef.buffer;
        const bufferStride = calcStride(attributeBuffer.attributes.values());
        const definition = attributeBuffer.attributes.get(attributeName);
        if (definition === undefined) {
            throwError(() => `Could not find VAO attribute for location ${location} in Attribute Buffer "${attributeBuffer.name}".`);
        }
        const attributeSize = getAttributeSize(definition);
        gl.bindBuffer(gl.ARRAY_BUFFER, attributeBuffer.glObject);
        for (let locationOffset = 0; locationOffset < (definition.width ?? 1); ++locationOffset) {
            gl.enableVertexAttribArray(location + locationOffset);
            gl.vertexAttribPointer(location + locationOffset, definition.size, definition.type, definition.normalized ?? false, bufferStride, offset + (locationOffset * attributeSize));
            gl.vertexAttribDivisor(location + locationOffset, definition.divisor ?? 0);
        }
        logInfo(() => `Attribute "${attributeName}" of VAO "${name}" bound to location: ${location}`);
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
/**
 * Determines the WIP texture unit.
 * By default, we are using the highest texture unit available, in order to
 * avoid conflicts with user-defined textures.
 * If an explicit texture unit is given, it is validated and returned.
 */
function getWIPTextureUnit(gl, givenUnit) {
    const textureUnitCount = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    if (givenUnit === undefined) {
        return textureUnitCount - 1;
    }
    else {
        if (givenUnit < 0) {
            throwError(() => `WIP texture unit cannot be negative, got: ${givenUnit}.`);
        }
        if (givenUnit >= textureUnitCount) {
            throwError(() => `Invalid WIP texture unit: ${givenUnit}, maximal texture unit available is ${textureUnitCount - 1}.`);
        }
        return givenUnit;
    }
}
/**
 * Given a TypedArray, this function returns the corresponding default texture source data type.
 */
function getDefaultSrcDataType(data) {
    if (data instanceof Uint8Array) {
        return TextureSrcDataType.UNSIGNED_BYTE;
    }
    else if (data instanceof Uint16Array) {
        return TextureSrcDataType.UNSIGNED_SHORT;
    }
    else if (data instanceof Uint32Array) {
        return TextureSrcDataType.UNSIGNED_INT;
    }
    else if (data instanceof Float32Array) {
        return TextureSrcDataType.FLOAT;
    }
    else if (data instanceof Int8Array || data instanceof Int16Array || data instanceof Int32Array) {
        throwError(() => `Signed integer buffers are not supported when defining a texture.`);
    }
    else {
        throwError(() => `Invalid data type: ${data.constructor.name}.`);
    }
}
/**
 * There exist a strict set of rules for which source data types are allowed for which internal formats.
 * See https://registry.khronos.org/webgl/specs/latest/2.0/#3.7.6
 * @param data Data to define the texture with.
 * @param srcDataType Explicitly given source data type.
 */
function validateSrcDataType(data, srcDataType) {
    if (data instanceof Uint8Array) {
        if (srcDataType !== TextureSrcDataType.UNSIGNED_BYTE) {
            throwError(() => `When defining a texture with a 'Uint8Array', the source data type must be 'UNSIGNED_BYTE'`);
        }
    }
    else if (data instanceof Uint8ClampedArray) {
        if (srcDataType !== TextureSrcDataType.UNSIGNED_BYTE) {
            throwError(() => `When defining a texture with a 'Uint8ClampedArray'source data type must be 'UNSIGNED_BYTE'`);
        }
    }
    else if (data instanceof Float32Array) {
        if (srcDataType !== TextureSrcDataType.FLOAT) {
            throwError(() => `When defining a texture with a 'Float32Array', the source data type must be 'FLOAT'`);
        }
    }
    else if (data instanceof Uint16Array) {
        if (![
            TextureSrcDataType.UNSIGNED_SHORT,
            TextureSrcDataType.UNSIGNED_SHORT_5_6_5,
            TextureSrcDataType.UNSIGNED_SHORT_5_5_5_1,
            TextureSrcDataType.UNSIGNED_SHORT_4_4_4_4,
            TextureSrcDataType.HALF_FLOAT,
        ].includes(srcDataType)) {
            throwError(() => `When defining a texture with a 'Uint16Array', the source data type must be one of 'UNSIGNED_SHORT', 'UNSIGNED_SHORT_5_6_5', 'UNSIGNED_SHORT_5_5_5_1', 'UNSIGNED_SHORT_4_4_4_4', or 'HALF_FLOAT'`);
        }
    }
    else if (data instanceof Uint32Array) {
        if (![
            TextureSrcDataType.UNSIGNED_INT,
            TextureSrcDataType.UNSIGNED_INT_5_9_9_9_REV,
            TextureSrcDataType.UNSIGNED_INT_2_10_10_10_REV,
            TextureSrcDataType.UNSIGNED_INT_10F_11F_11F_REV,
            TextureSrcDataType.UNSIGNED_INT_24_8,
        ].includes(srcDataType)) {
            throwError(() => `When defining a texture with a 'Uint32Array', the source data type must be one of 'UNSIGNED_INT', 'UNSIGNED_INT_5_9_9_9_REV', 'UNSIGNED_INT_2_10_10_10_REV', 'UNSIGNED_INT_10F_11F_11F_REV', or'UNSIGNED_INT_24_8'`);
        }
    }
    else if (data instanceof Int8Array || data instanceof Int16Array || data instanceof Int32Array) {
        throwError(() => `Signed integer buffers are not supported when defining a texture.`);
    }
    else {
        throwError(() => `Invalid data type for texture: ${data.constructor.name}`);
    }
}
/**
 * Given the internal format of a texture, and a source data type, this function returns whether the combination is valid, based on the WebGL specification.
 * See https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
 */
function matchInternalFormatAndDataType(internalFormat, dataType) {
    switch (internalFormat) {
        case TextureInternalFormat.R8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.R16F:
            return [TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.R32F:
            return dataType == TextureSrcDataType.FLOAT;
        case TextureInternalFormat.R8UI:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RG8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RG16F:
            return [TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.RG32F:
            return dataType == TextureSrcDataType.FLOAT;
        case TextureInternalFormat.RG8UI:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RGB8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.SRGB8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RGB565:
            return [TextureSrcDataType.UNSIGNED_BYTE, TextureSrcDataType.UNSIGNED_SHORT_5_6_5].includes(dataType);
        case TextureInternalFormat.R11F_G11F_B10F:
            return [TextureSrcDataType.UNSIGNED_INT_10F_11F_11F_REV, TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.RGB9_E5:
            return [TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.RGB16F:
            return [TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.RGB32F:
            return dataType == TextureSrcDataType.FLOAT;
        case TextureInternalFormat.RGB8UI:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RGBA8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.SRGB8_ALPHA8:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.RGB5_A1:
            return [TextureSrcDataType.UNSIGNED_BYTE, TextureSrcDataType.UNSIGNED_SHORT_5_5_5_1].includes(dataType);
        case TextureInternalFormat.RGB10_A2:
            return dataType === TextureSrcDataType.UNSIGNED_INT_2_10_10_10_REV;
        case TextureInternalFormat.RGBA4:
            return [TextureSrcDataType.UNSIGNED_BYTE, TextureSrcDataType.UNSIGNED_SHORT_4_4_4_4].includes(dataType);
        case TextureInternalFormat.RGBA16F:
            return [TextureSrcDataType.HALF_FLOAT, TextureSrcDataType.FLOAT].includes(dataType);
        case TextureInternalFormat.RGBA32F:
            return dataType == TextureSrcDataType.FLOAT;
        case TextureInternalFormat.RGBA8UI:
            return dataType === TextureSrcDataType.UNSIGNED_BYTE;
        case TextureInternalFormat.DEPTH_COMPONENT16:
            return dataType === TextureSrcDataType.UNSIGNED_SHORT;
        case TextureInternalFormat.DEPTH_COMPONENT24:
            return dataType === TextureSrcDataType.UNSIGNED_INT;
        case TextureInternalFormat.DEPTH_COMPONENT32F:
            return dataType === TextureSrcDataType.FLOAT;
    }
    return false;
}
/**
 * Determine the `format` argument for `texImage2D` based on the given internal format.
 * See https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE
 */
function getTextureFormat(gl, internalFormat) {
    switch (internalFormat) {
        case TextureInternalFormat.R8:
            return gl.RED;
        case TextureInternalFormat.R16F:
            return gl.RED;
        case TextureInternalFormat.R32F:
            return gl.RED;
        case TextureInternalFormat.R8UI:
            return gl.RED_INTEGER;
        case TextureInternalFormat.RG8:
            return gl.RG;
        case TextureInternalFormat.RG16F:
            return gl.RG;
        case TextureInternalFormat.RG32F:
            return gl.RG;
        case TextureInternalFormat.RG8UI:
            return gl.RG_INTEGER;
        case TextureInternalFormat.RGB8:
            return gl.RGB;
        case TextureInternalFormat.SRGB8:
            return gl.RGB;
        case TextureInternalFormat.RGB565:
            return gl.RGB;
        case TextureInternalFormat.R11F_G11F_B10F:
            return gl.RGB;
        case TextureInternalFormat.RGB9_E5:
            return gl.RGB;
        case TextureInternalFormat.RGB16F:
            return gl.RGB;
        case TextureInternalFormat.RGB32F:
            return gl.RGB;
        case TextureInternalFormat.RGB8UI:
            return gl.RGB_INTEGER;
        case TextureInternalFormat.RGBA8:
            return gl.RGBA;
        case TextureInternalFormat.SRGB8_ALPHA8:
            return gl.RGBA;
        case TextureInternalFormat.RGB5_A1:
            return gl.RGBA;
        case TextureInternalFormat.RGB10_A2:
            return gl.RGBA;
        case TextureInternalFormat.RGBA4:
            return gl.RGBA;
        case TextureInternalFormat.RGBA16F:
            return gl.RGBA;
        case TextureInternalFormat.RGBA32F:
            return gl.RGBA;
        case TextureInternalFormat.RGBA8UI:
            return gl.RGBA_INTEGER;
        case TextureInternalFormat.DEPTH_COMPONENT16:
        case TextureInternalFormat.DEPTH_COMPONENT24:
        case TextureInternalFormat.DEPTH_COMPONENT32F:
            return gl.DEPTH_COMPONENT;
        default:
            throwError(() => `Invalid internal format: ${internalFormat}.`);
    }
}
/** Get the name of the texture kind for logging. */
function getTextureKind(target) {
    switch (target) {
        case TextureTarget.TEXTURE_2D: return "2D";
        case TextureTarget.TEXTURE_3D: return "3D";
        case TextureTarget.TEXTURE_CUBE_MAP: return "cubemap";
        case TextureTarget.TEXTURE_2D_ARRAY: return "2D array";
    }
}
/**
 * Tests if the given internal Format is a Depth format.
 * As per https://registry.khronos.org/OpenGL-Refpages/gl4/html/glTexParameter.xhtml
 * (under GL_TEXTURE_COMPARE_MODE), this includes any format beginning with
 * `DEPTH_COMPONENT_`.
 */
function isDepthFormat(internalFormat) {
    switch (internalFormat) {
        case TextureInternalFormat.DEPTH_COMPONENT16:
        case TextureInternalFormat.DEPTH_COMPONENT24:
        case TextureInternalFormat.DEPTH_COMPONENT32F:
            return true;
        default:
            return false;
    }
}
/**
 * Checks, if a given internal format is a floating point format.
 */
function isFloatFormat(internalFormat) {
    switch (internalFormat) {
        case TextureInternalFormat.R16F:
        case TextureInternalFormat.R32F:
        case TextureInternalFormat.RG16F:
        case TextureInternalFormat.RG32F:
        case TextureInternalFormat.RGB16F:
        case TextureInternalFormat.RGB32F:
        case TextureInternalFormat.RGBA16F:
        case TextureInternalFormat.RGBA32F:
        case TextureInternalFormat.DEPTH_COMPONENT32F:
            return true;
        default:
            return false;
    }
}
/**
 * Creates a new (empty) texture object.
 * Afterwards, you will need to call `updateTexture` to fill it with data.
 * @param gl The WebGL context.
 * @param name The name of the texture.
 * @param width The width of the texture, must be larger than zero.
 * @param height The height of the texture, must be larger than zero.
 * @param target The texture target, defaults to `TEXTURE_2D`.
 * @param depth The depth of the texture, defaults to `null` for 2D and cubemap textures.
 * @param options Additional options for the texture:
 * - `useAnisotropy`: Whether to enable anisotropic filtering. Defaults to `false`.
 * - `wipTextureUnit`: The texture unit to use for the WIP texture. Defaults to the highest texture unit available.
 * - `internalFormat`: The internal format of the texture. Defaults to `RGBA8`.
 * - `levels`: The number of mipmap levels to create. Defaults to the maximum possible number of levels.
 * - `filter`: The texture (min/mag) filter(s) to use. Defaults to (tri-)linear filtering.
 * - `wrap`: The texture wrap mode(s) to use. Defaults to `CLAMP_TO_EDGE`.
 * - `compareFunc`: The comparison function to use for depth textures. Defaults to `NONE`.
 * @returns The texture object.
 */
function createTexture(gl, name, width, height, target = TextureTarget.TEXTURE_2D, depth = null, options = {}) {
    const kind = getTextureKind(target);
    // Validate the dimensions of the texture.
    if (target == TextureTarget.TEXTURE_2D || target == TextureTarget.TEXTURE_CUBE_MAP) {
        if (depth !== null) {
            logWarning(() => `Ignoring given depth ${depth} of ${kind} texture "${name}".`);
            depth = null;
        }
        if (width < 1 || height < 1 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
            throwError(() => `Invalid texture dimensions: ${width}x${height} of ${kind} texture "${name}".`);
        }
    }
    else {
        if (depth === null) {
            throwError(() => `Missing depth for ${kind} texture "${name}".`);
        }
        if (width < 1 || height < 1 || depth < 1 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || !Number.isSafeInteger(depth)) {
            throwError(() => `Invalid texture dimensions: ${width}x${height}x${depth} of ${kind} texture "${name}".`);
        }
    }
    // Use the highest texture unit as the WIP unit by default.
    options.wipTextureUnit = getWIPTextureUnit(gl, options.wipTextureUnit);
    // Determine the number of levels to create.
    if (!isPowerOf2(width)) {
        if (options.levels !== undefined) {
            logWarning(() => `Ignoring given number of levels for ${kind} texture "${name}" because its width is not a power of two.`);
        }
        options.levels = 1;
    }
    else if (!isPowerOf2(height)) {
        if (options.levels !== undefined) {
            logWarning(() => `Ignoring given number of levels for ${kind} texture "${name}" because its height is not a power of two.`);
        }
        options.levels = 1;
    }
    else if (depth !== null && !isPowerOf2(depth)) {
        if (options.levels !== undefined) {
            logWarning(() => `Ignoring given number of levels for ${kind} texture "${name}" because its depth is not a power of two.`);
        }
        // TODO: I thought WebGL2 can handle non-power-of-two MIP maps?
        options.levels = 1;
    }
    else {
        const maxLevelCount = Math.floor(Math.log2(Math.max(width, height, depth ?? 1))) + 1;
        if (options.levels === undefined) {
            options.levels = maxLevelCount;
        }
        else {
            if (options.levels < 1 || !Number.isSafeInteger(options.levels)) {
                throwError(() => `Invalid number of levels for ${kind} texture "${name}": ${options.levels}.`);
            }
            else if (options.levels > maxLevelCount) {
                logWarning(() => `Ignoring given number of levels for ${kind} texture "${name}" because ${options.levels} is larger than the maximum possible number of levels ${maxLevelCount}.`);
                options.levels = maxLevelCount;
            }
        }
    }
    // Determine the internal format of the texture.
    options.internalFormat = options.internalFormat ?? gl.RGBA8;
    // Check if anisotropic filtering is supported.
    const anisotropyExtension = options.useAnisotropy ? gl.getExtension("EXT_texture_filter_anisotropic") : null;
    if (options.useAnisotropy === true && anisotropyExtension === null) {
        logWarning(() => 'Anisotropic filtering is not supported.');
    }
    // Comparison functions are only supported for depth textures.
    if (options.compareFunc ?? TextureCompareFunc.NONE !== TextureCompareFunc.NONE) {
        if (!isDepthFormat(options.internalFormat)) {
            logWarning(() => `Ignoring given comparison function for ${kind} texture "${name}" because it is not a depth texture.`);
            options.compareFunc = undefined;
        }
    }
    // Create the new texture
    const glTexture = gl.createTexture();
    if (glTexture === null) {
        throwError(() => `Failed to create WebGL texture for ${kind} texture "${name}"`);
    }
    // Define the texture
    try {
        gl.activeTexture(gl.TEXTURE0 + options.wipTextureUnit);
        gl.bindTexture(target, glTexture);
        // 2D and Cube Map textures
        if (depth === null) {
            gl.texStorage2D(target, options.levels, options.internalFormat, width, height);
            // It is perfectly valid to create a texture with a non-zero size but without any data.
            // Firefox however produces a warning: "Tex ... is incurring lazy initialization." when doing so.
            // Which, apparently, is correct but not actually an issue because the "fix" would be worse
            // than the problem. See:
            //  https://stackoverflow.com/a/57734917
            // Still, I am developing on Firefox and I don't want to see warnings in the console, so glance
            // will create a zeroed-out data array explicitly - but only in debug mode.
            if (DEBUG) { // TODO: test that this code is properly removed in production builds
                if (options.internalFormat === TextureInternalFormat.RGBA8) {
                    if (target === TextureTarget.TEXTURE_2D) {
                        gl.texSubImage2D(target, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(width * height * 4));
                    }
                    else {
                        for (let i = 0; i < 6; ++i) {
                            gl.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(width * height * 4));
                        }
                    }
                    if (options.levels > 1) {
                        gl.generateMipmap(target);
                    }
                }
            }
            // Enable depth texture comparison if requested.
            if (options.compareFunc ?? TextureCompareFunc.NONE !== TextureCompareFunc.NONE) {
                gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
                gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, options.compareFunc);
            }
        }
        // 3D and 2D Array textures
        else {
            gl.texStorage3D(target, options.levels, options.internalFormat, width, height, depth);
        }
        logInfo(() => `Created ${kind} texture "${name}".`);
        // Define the min- and magnification filter.
        let minFilter;
        let magFilter;
        if (options.filter === undefined) {
            if (options.levels > 1) {
                minFilter = TextureFilter.LINEAR_MIPMAP_LINEAR;
            }
            else {
                minFilter = TextureFilter.LINEAR;
            }
            magFilter = TextureFilter.LINEAR;
        }
        else if (Array.isArray(options.filter)) {
            minFilter = options.filter[0];
            magFilter = options.filter[1];
        }
        else {
            minFilter = options.filter;
            magFilter = options.filter;
        }
        if (options.levels === 1) {
            if (![TextureFilter.NEAREST, TextureFilter.LINEAR].includes(minFilter)) {
                logWarning(() => `Ignoring given minification filter for ${kind} texture "${name}" because it has only one level.`);
                if ([TextureFilter.NEAREST_MIPMAP_NEAREST, TextureFilter.NEAREST_MIPMAP_LINEAR].includes(minFilter)) {
                    minFilter = TextureFilter.NEAREST;
                }
                else {
                    minFilter = TextureFilter.LINEAR;
                }
            }
        }
        if (![TextureFilter.NEAREST, TextureFilter.LINEAR].includes(magFilter)) {
            logWarning(() => `Ignoring given magnification filter for ${kind} texture "${name}".`);
            if ([TextureFilter.NEAREST_MIPMAP_NEAREST, TextureFilter.NEAREST_MIPMAP_LINEAR].includes(magFilter)) {
                magFilter = TextureFilter.NEAREST;
            }
            else {
                magFilter = TextureFilter.LINEAR;
            }
        }
        if (isFloatFormat(options.internalFormat)) {
            if (![TextureFilter.NEAREST, TextureFilter.NEAREST_MIPMAP_NEAREST].includes(minFilter)
                || magFilter !== TextureFilter.NEAREST) {
                const extension = gl.getExtension("OES_texture_float_linear");
                if (extension === null) {
                    logWarning(() => `Linear filtering for floating point textures is not supported on this system.`);
                    minFilter = TextureFilter.NEAREST;
                    magFilter = TextureFilter.NEAREST;
                }
            }
        }
        gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, minFilter);
        gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, magFilter);
        // Define wrapping behavior.
        let wrapS;
        let wrapT;
        let wrapR;
        if (options.wrap === undefined) {
            wrapS = TextureWrap.CLAMP_TO_EDGE;
            wrapT = TextureWrap.CLAMP_TO_EDGE;
            wrapR = TextureWrap.CLAMP_TO_EDGE;
        }
        else if (Array.isArray(options.wrap)) {
            wrapS = options.wrap[0];
            wrapT = options.wrap[1];
            wrapR = options.wrap[2] ?? TextureWrap.CLAMP_TO_EDGE;
            if (target === TextureTarget.TEXTURE_2D && options.wrap.length > 2) {
                logWarning(() => `Ignoring given wrap R mode for ${kind} texture "${name}" because it has only two dimensions.`);
            }
        }
        else {
            wrapS = options.wrap;
            wrapT = options.wrap;
            wrapR = options.wrap;
        }
        gl.texParameteri(target, gl.TEXTURE_WRAP_S, wrapS);
        gl.texParameteri(target, gl.TEXTURE_WRAP_T, wrapT);
        if (target !== TextureTarget.TEXTURE_2D) { // TODO: can I set the wrap mode for 2D Array Textures?
            gl.texParameteri(target, gl.TEXTURE_WRAP_R, wrapR);
        }
        // Enable anisotropic filtering if supported and requested.
        if (anisotropyExtension) {
            if (target === TextureTarget.TEXTURE_CUBE_MAP) {
                logWarning(() => 'Anisotropic filtering is not supported for cubemap textures.');
            }
            else {
                gl.texParameterf(gl.TEXTURE_2D, anisotropyExtension.TEXTURE_MAX_ANISOTROPY_EXT, gl.getParameter(anisotropyExtension.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
            }
        }
    }
    catch (error) {
        gl.deleteTexture(glTexture);
        error.message = `Failed to create texture "${name}": ${error.message}`;
        throw error;
    }
    finally {
        gl.bindTexture(target, null);
    }
    // Return the texture.
    return {
        name,
        glObject: glTexture,
        target,
        width,
        height,
        depth: depth ?? 1,
        levels: options.levels,
        internalFormat: options.internalFormat,
        compareFunc: options.compareFunc ?? TextureCompareFunc.NONE,
        attachmentType: AttachmentType.TEXTURE,
    };
}
/**
 * Updates the contents of an existing Texture object.
 * Since textures in glance are immutable, this cannot redefine the size or format of the texture.
 * @param gl The WebGL context.
 * @param texture The texture object to update.
 * @param source The pixel or image data.
 * @param options Additional options for the texture:
 * - `target`: The texture target, defaults to the texture's target.
 * - `level`: The mipmap level to update, defaults to 0.
 * - `createMipMaps`: Whether to generate mipmaps for the texture, defaults to `true`.
 * - `wipTextureUnit`: The texture unit to use for the WIP texture. Defaults to the highest texture unit available.
 * - `srcDataType`: The data type of the source data. Defaults to the data type of the given data.
 * - `flipY`: Whether to flip the image vertically, defaults to `false`.
 */
function updateTexture(gl, texture, data, options = {}) {
    // When updating cubemap faces, we must know which one.
    if (options.target === undefined) {
        if (texture.target === TextureTarget.TEXTURE_CUBE_MAP) {
            throwError(() => `You need to specify an explicit target for cube map textures.`);
        }
        options.target = texture.target;
    }
    else if (texture.target === TextureTarget.TEXTURE_CUBE_MAP) {
        if (!(options.target >= TextureDataTarget.TEXTURE_CUBE_MAP_POSITIVE_X
            && options.target <= TextureDataTarget.TEXTURE_CUBE_MAP_NEGATIVE_Z)) {
            throwError(() => `Invalid data target for cube map texture: ${options.target}.`);
        }
    }
    // The Mipmap level defaults to zero.
    if (options.level === undefined) {
        options.level = 0;
    }
    else if (options.level < 0 || !Number.isSafeInteger(options.level)) {
        throwError(() => `Invalid mipmap level: ${options.level}.`);
    }
    // Use the highest texture unit as the WIP unit by default.
    options.wipTextureUnit = getWIPTextureUnit(gl, options.wipTextureUnit);
    // Determine the source data type.
    if (options.srcDataType === undefined) {
        if (ArrayBuffer.isView(data)) {
            options.srcDataType = getDefaultSrcDataType(data);
        }
        else {
            options.srcDataType = TextureSrcDataType.UNSIGNED_BYTE;
        }
    }
    else {
        if (ArrayBuffer.isView(data)) {
            validateSrcDataType(data, options.srcDataType);
        }
        else {
            if (options.srcDataType !== TextureSrcDataType.UNSIGNED_BYTE) {
                throwError(() => `When defining a texture with a 'TexImageSource', the source data type must be 'UNSIGNED_BYTE'`);
            }
        }
    }
    if (!matchInternalFormatAndDataType(texture.internalFormat, options.srcDataType)) {
        throwError(() => `Invalid combination of internal format ${texture.internalFormat} and source data type ${options.srcDataType}. See https://registry.khronos.org/webgl/specs/latest/2.0/#TEXTURE_TYPES_FORMATS_FROM_DOM_ELEMENTS_TABLE`);
    }
    // Determine the `format` argument for `texImage2D` based on the given internal format.
    const format = getTextureFormat(gl, texture.internalFormat);
    // Define the texture
    try {
        gl.activeTexture(gl.TEXTURE0 + options.wipTextureUnit);
        gl.bindTexture(texture.target, texture.glObject);
        if (options.flipY ?? false) {
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        }
        // 3D and 2D Array textures
        if (texture.depth > 1) {
            gl.texSubImage3D(texture.target, options.level, 0, 0, 0, texture.width, texture.height, texture.depth, format, options.srcDataType, data);
        }
        // 2D and Cube Map textures
        else {
            gl.texSubImage2D(options.target, options.level, 0, // TODO: support partial texture updates
            0, texture.width, texture.height, format, options.srcDataType, data);
        }
        // Update the mipmaps if requested and possible.
        if (options.createMipMaps) {
            if (!isPowerOf2(texture.width) || !isPowerOf2(texture.height) || !isPowerOf2(texture.depth)) {
                logWarning(() => 'Mipmaps are only supported for textures with power-of-two dimensions.');
            }
            else {
                gl.generateMipmap(texture.target);
                gl.texParameteri(texture.target, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                console.log(`Generated Mipmaps for texture "${texture.name}".`);
            }
        }
    }
    catch (error) {
        error.message = `Failed to define texture "${texture.name}": ${error.message}`;
        throw error;
    }
    finally {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.bindTexture(texture.target, null);
    }
}
// Renderbuffer ============================================================= //
/**
 * Creates a new Renderbuffer object.
 * @param gl The WebGL context.
 * @param name The name of the Renderbuffer.
 * @param width The width of the Renderbuffer, must be larger than zero.
 * @param height The height of the Renderbuffer, must be larger than zero.
 * @param internalFormat The internal format of the Renderbuffer.
 * @returns The Renderbuffer object.
 */
function createRenderbuffer(gl, name, width, height, internalFormat) {
    // Validate the parameters.
    if (width < 1 || height < 1 || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
        throwError(() => `Invalid renderbuffer dimensions: ${width}x${height} of renderbuffer "${name}".`);
    }
    // TODO: check that the dimensions are less than or equal to the value of GL_MAX_RENDERBUFFER_SIZE
    // See https://registry.khronos.org/OpenGL-Refpages/es3.0/html/glRenderbufferStorageMultisample.xhtml
    // Create the Renderbuffer.
    const glRenderbuffer = gl.createRenderbuffer();
    if (glRenderbuffer === null) {
        throwError(() => `Failed to create a new WebGL renderbuffer object for "${name}".`);
    }
    // Define the Renderbuffer.
    try {
        gl.bindRenderbuffer(gl.RENDERBUFFER, glRenderbuffer);
        // TODO: Multisampled Renderbuffers
        gl.renderbufferStorage(gl.RENDERBUFFER, internalFormat, width, height);
    }
    // Delete the Renderbuffer again if anything goes wrong.
    catch (e) {
        gl.deleteRenderbuffer(glRenderbuffer);
        throw e;
    }
    // Always restore the WebGL state.
    finally {
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    }
    // Return the finished Renderbuffer object.
    return {
        name,
        glObject: glRenderbuffer,
        width,
        height,
        internalFormat,
        attachmentType: AttachmentType.RENDERBUFFER,
    };
}
// Framebuffer ============================================================== //
/** Tests if a given object is a Framebuffer attachment (Texture or Renderbuffer). */
function isFramebufferAttachment(obj) {
    return Object.hasOwn(obj, "attachmentType");
}
/**
 * Create and define a new Framebuffer object.
 * @param gl The WebGL context.
 * @param name The name of the Framebuffer.
 * @param color All color attachments.
 * @param depth The depth attachment.
 * @param stencil The stencil attachment.
 * @returns The Framebuffer object.
 */
function createFramebuffer(gl, name, color = null, depth = null, stencil = null) {
    // Ensure that the color attachments are valid.
    const colorAttachments = (Array.isArray(color) ? color : color === null ? [] : [color]).map((obj) => (isFramebufferAttachment(obj) ? { attachment: obj } : obj));
    const depthAttachment = depth === null ? null : isFramebufferAttachment(depth) ? { attachment: depth } : depth;
    const stencilAttachment = stencil === null ? null : isFramebufferAttachment(stencil) ? { attachment: stencil } : stencil;
    const maxColorAttachmentCount = gl.getParameter(gl.MAX_COLOR_ATTACHMENTS);
    if (colorAttachments.length > maxColorAttachmentCount) {
        throwError(() => `Framebuffer "${name}" has ${colorAttachments.length} color attachments, but the maximum is ${maxColorAttachmentCount}.`);
    }
    let framebufferSize = null; // [height, width]
    for (let i = 0; i < colorAttachments.length; ++i) {
        const attachment = colorAttachments[i].attachment;
        // Check that texture attachments are valid.
        if (attachment.attachmentType == AttachmentType.TEXTURE) {
            const texture = attachment;
            if (framebufferSize === null) {
                framebufferSize = [texture.width, texture.height];
            }
            else if (texture.width !== framebufferSize[0] || texture.height !== framebufferSize[1]) {
                throwError(() => `Framebuffer "${name}" has color attachments with different dimensions.`);
            }
        }
        // Check that renderbuffer attachments are valid.
        else {
            const renderbuffer = attachment;
            if (framebufferSize === null) {
                framebufferSize = [renderbuffer.width, renderbuffer.height];
            }
            else if (renderbuffer.width !== framebufferSize[0] || renderbuffer.height !== framebufferSize[1]) {
                throwError(() => `Framebuffer "${name}" has color attachments with different dimensions.`);
            }
        }
    }
    if (depthAttachment !== null) {
        const attachment = depthAttachment.attachment;
        if (framebufferSize === null) {
            framebufferSize = [attachment.width, attachment.height];
        }
        else if (attachment.width !== framebufferSize[0] || attachment.height !== framebufferSize[1]) {
            throwError(() => `Framebuffer "${name}" has color/depth attachments with different dimensions.`);
        }
    }
    // Create the Framebuffer.
    const glFramebuffer = gl.createFramebuffer();
    if (glFramebuffer === null) {
        throwError(() => `Failed to create a new WebGL framebuffer object for "${name}".`);
    }
    // Helper functions for creating attachments.
    function attach(attachment, location) {
        const kind = location === gl.DEPTH_ATTACHMENT ? "depth" : `color[${location - gl.COLOR_ATTACHMENT0}]`;
        // Attachment is a Texture.
        if (attachment.attachment.attachmentType === AttachmentType.TEXTURE) {
            const texture = attachment.attachment;
            // Attachment is a 2D Texture.
            if (texture.target === TextureTarget.TEXTURE_2D) {
                if ((attachment.target ?? TextureDataTarget.TEXTURE_2D) !== TextureDataTarget.TEXTURE_2D) {
                    logWarning(() => `Ignoring the target "${attachment.target}" for ${kind} attachment of framebuffer "${name}", using 'gl.TEXTURE_2D' instead.`);
                }
                gl.framebufferTexture2D(gl.FRAMEBUFFER, location, gl.TEXTURE_2D, texture.glObject, attachment.level ?? 0);
            }
            // Attachment is a Cube Map Texture.
            else if (texture.target === TextureTarget.TEXTURE_CUBE_MAP) {
                if (attachment.target === undefined) {
                    throwError(() => `Missing target for cubemap ${kind} attachment of framebuffer "${name}".`);
                }
                if (!(attachment.target >= TextureDataTarget.TEXTURE_CUBE_MAP_POSITIVE_X
                    && attachment.target <= TextureDataTarget.TEXTURE_CUBE_MAP_NEGATIVE_Z)) {
                    throwError(() => `Invalid data target for cube map texture: ${attachment.target}.`);
                }
                gl.framebufferTexture2D(gl.FRAMEBUFFER, location, attachment.target, texture.glObject, attachment.level ?? 0);
            }
            // Attachment is a 3D or 2D Array Texture.
            else {
                if (attachment.target ?? texture.target !== texture.target) {
                    const textureTarget = texture.target === TextureTarget.TEXTURE_2D_ARRAY ? 'gl.TEXTURE_2D_ARRAY' : 'gl.TEXTURE_3D';
                    logWarning(() => `Ignoring the target "${attachment.target}" for ${kind} attachment of framebuffer "${name}", using ${textureTarget} instead.`);
                }
                if (attachment.layer === undefined) {
                    const textureKind = texture.target === TextureTarget.TEXTURE_2D_ARRAY ? "2D array" : "3D";
                    logWarning(() => `Missing layer for ${kind} attachment (which is a ${textureKind} texture) of framebuffer "${name}", using layer 0 by default.`);
                }
                gl.framebufferTextureLayer(gl.FRAMEBUFFER, location, texture.glObject, attachment.level ?? 0, attachment.layer ?? 0);
            }
        }
        // Attachment is a Renderbuffer.
        else {
            const renderbuffer = attachment.attachment;
            if (attachment.level !== undefined) {
                logWarning(() => `Ignoring given level ${attachment.level} for renderbuffer ${kind} attachment of framebuffer "${name}".`);
            }
            if (attachment.target !== undefined) {
                logWarning(() => `Ignoring given target ${attachment.target} for renderbuffer ${kind} attachment of framebuffer "${name}".`);
            }
            gl.framebufferRenderbuffer(gl.FRAMEBUFFER, location, gl.RENDERBUFFER, renderbuffer.glObject);
        }
    }
    // Define the Framebuffer.
    try {
        gl.bindFramebuffer(gl.FRAMEBUFFER, glFramebuffer);
        // Attach the color attachments.
        if (colorAttachments.length === 0) {
            gl.drawBuffers([gl.NONE]);
            gl.readBuffer(gl.NONE);
        }
        else {
            const drawBuffers = [];
            for (let i = 0; i < colorAttachments.length; ++i) {
                const location = gl.COLOR_ATTACHMENT0 + i;
                attach(colorAttachments[i], location);
                drawBuffers.push(location);
            }
            gl.drawBuffers(drawBuffers);
        }
        // Attach the depth attachment.
        if (depthAttachment !== null) {
            attach(depthAttachment, gl.DEPTH_ATTACHMENT);
        }
        // TODO: support stencil (and depth/stencil combination) attachments
        if (stencilAttachment !== null) {
            throwError(() => `Stencil attachments are not supported yet.`);
        }
        // Check that the framebuffer is complete.
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throwError(() => {
                switch (status) {
                    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
                        return `Incomplete framebuffer '${name}'! One or more framebuffer attachment points are incomplete.`;
                    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
                        return `Incomplete framebuffer '${name}'! One or more of the framebuffer attachment's dimensions are not the same.`;
                    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
                        return `Incomplete framebuffer '${name}'! No images are attached to the framebuffer.`;
                    case gl.FRAMEBUFFER_UNSUPPORTED:
                        return `Incomplete framebuffer '${name}'! The combination of internal formats of the attached images violates an implementation-dependent set of restrictions.`;
                    case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
                        return `Incomplete framebuffer '${name}'! The value of GL_FRAMEBUFFER_ATTACHMENT_TEXTURE_SAMPLES is not the same for all attached textures.`;
                    default:
                        return `Incomplete framebuffer '${name}'! Unknown error code ${status}.`;
                }
            });
        }
    }
    // Delete the Framebuffer on error.
    catch (e) {
        gl.deleteFramebuffer(glFramebuffer);
        throw e;
    }
    // Always restore the WebGL state.
    finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    // Return the Framebuffer object
    return {
        name,
        glObject: glFramebuffer,
        color: colorAttachments,
        depth: depthAttachment,
        stencil: stencilAttachment,
    };
}
/**
 * Updates the layer of a 3D or 2D Array Texture attachment of a Framebuffer.
 * Use this to render slices into a volumetric texture.
 * @param gl The WebGL context.
 * @param framebuffer The Framebuffer to update.
 * @param location WebGL location constant of the attachment to update.
 * @param layer New layer to render into.
 * @param level (optional) Mipmap level to update, defaults to 0.
 */
function updateFramebufferLayer(gl, framebuffer, location, layer, level = 0) {
    // Find the attachment at the given location.
    let locationName;
    let attachment;
    switch (location) {
        case gl.DEPTH_ATTACHMENT:
            attachment = framebuffer.depth ?? throwError(() => `Framebuffer "${framebuffer.name}" has no depth attachment.`);
            locationName = "depth";
            break;
        case gl.STENCIL_ATTACHMENT:
            attachment = framebuffer.stencil ?? throwError(() => `Framebuffer "${framebuffer.name}" has no stencil attachment.`);
            locationName = "stencil";
            break;
        default:
            attachment = framebuffer.color[location - gl.COLOR_ATTACHMENT0] ?? throwError(() => `Framebuffer "${framebuffer.name}" has no color attachment at location ${location}.`);
            locationName = `color[${location - gl.COLOR_ATTACHMENT0}]`;
    }
    // Maybe the attachment is already correct.
    if (attachment.layer === layer && attachment.level === (level ?? attachment.level)) {
        return;
    }
    // Check that the attachment is a 3D or 2D Array Texture with the correct depth.
    if (attachment.attachment.attachmentType !== AttachmentType.TEXTURE) {
        throwError(() => `Framebuffer "${framebuffer.name}" has no texture as its ${locationName} attachment, but a renderbuffer.`);
    }
    const texture = attachment.attachment;
    if (texture.target !== TextureTarget.TEXTURE_2D_ARRAY && texture.target !== TextureTarget.TEXTURE_3D) {
        const textureKind = texture.target === TextureTarget.TEXTURE_2D ? "2D" : "cubemap";
        throwError(() => `Framebuffer "${framebuffer.name}" has no 3D or 2D array texture as its ${locationName} attachment, but a ${textureKind} texture.`);
    }
    if (layer < 0 || layer >= texture.depth) {
        throwError(() => `Invalid layer ${layer} for ${locationName} attachment of framebuffer "${framebuffer.name}", which has a depth of ${texture.depth}.`);
    }
    // Keep track of the current WebGL state.
    const currentFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    // Update the framebuffer.
    try {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.glObject);
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, location, texture.glObject, level ?? attachment.level ?? 0, layer);
    }
    // Always restore the WebGL state.
    finally {
        gl.bindFramebuffer(gl.FRAMEBUFFER, currentFramebuffer);
    }
}
// Shader =================================================================== //
function compileWebGLShader(gl, source, stage) {
    const shader = gl.createShader(stage);
    if (shader === null) {
        throwError(() => {
            const stageName = stage === ShaderStage.VERTEX ? "vertex" : "fragment";
            return `Failed to create a new ${stageName} shader.`;
        });
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}
/**
 * Create a Vertex Shader program from the given source code.
 * @param gl The WebGL context.
 * @param source The source code of the vertex shader.
 * @returns The Vertex Shader object.
 */
function createVertexShader(gl, source) {
    return {
        glObject: compileWebGLShader(gl, source, gl.VERTEX_SHADER),
        stage: ShaderStage.VERTEX,
        source,
    };
}
/**
 * Create a Fragment Shader program from the given source code.
 * @param gl The WebGL context.
 * @param source The source code of the fragment shader.
 * @returns The Fragment Shader object.
 */
function createFragmentShader(gl, source) {
    return {
        glObject: compileWebGLShader(gl, source, gl.FRAGMENT_SHADER),
        stage: ShaderStage.FRAGMENT,
        source,
    };
}
/**
 * Deletes the given Shader.
 * Does nothing if the Shader has already been deleted.
 * @param gl The WebGL context.
 * @param shader The shader to delete.
 */
function deleteShader(gl, shader) {
    if (shader.glObject === null) {
        return;
    }
    gl.deleteShader(shader.glObject);
    shader.glObject = null;
}
function findAttributes(source) {
    const regex = /(?:layout\s*\(location\s*=\s*(?<loc>\d+)\)\s*)?in\s+(?:(?<prec>lowp|mediump|highp)\s+)?(?<type>\w+)\s+(?<name>\w+)\s*;/g;
    const attributes = {};
    let match;
    while ((match = regex.exec(source)) !== null) {
        const { name, type, loc, prec } = match.groups;
        // TODO: check that the type is valid
        attributes[name] = { type };
        if (loc) {
            attributes[name].location = parseInt(loc);
        }
        if (prec) {
            attributes[name].precision = prec;
        }
    }
    return attributes;
}
function findUniforms(vertexSource, fragmentSource) {
    // TODO: uniforms are still found even if they are commented out (attributes probably too)
    const regex = /uniform\s+(?<prec>lowp|mediump|highp)?\s*(?<type>\w+)\s+(?<name>\w+)(?:\s*\[\s*(?<size>\d+)\s*\])?;/g;
    const uniforms = {};
    let match;
    for (let source of [vertexSource, fragmentSource]) {
        while ((match = regex.exec(source)) !== null) {
            const { name, type, prec, size } = match.groups;
            if (name in uniforms) {
                continue; // Ignore known uniforms, their info won't change (or the shader won't compile).
            }
            uniforms[name] = { type };
            if (prec) {
                uniforms[name].precision = prec;
            }
            if (size) {
                uniforms[name].size = parseInt(size);
            }
        }
    }
    return uniforms;
}
/**
 * Helper function to call the corret gl.uniform* function based on the uniform type.
 * @param gl The WebGL context.
 * @param uniform The uniform info with the value to set.
 */
function setUniform(gl, uniform) {
    // Debug checks (are compiled out in release builds).
    const isNumber = (val) => typeof val === 'number';
    const isInt = (val) => Number.isSafeInteger(val);
    const isUint = (val) => isInt(val) && val >= 0;
    const isBool = (val) => typeof val === 'boolean' || (isInt(val) && (val === 0 || val === 1));
    const isArray = (val) => Array.isArray(val) || ArrayBuffer.isView(val);
    const isArrayOfNumbers = (size) => isArray(uniform.value) && uniform.value.length == size * uniform.size && uniform.value.every(val => isNumber(val));
    const isArrayOfBools = (size) => isArray(uniform.value) && uniform.value.length == size * uniform.size && uniform.value.every(val => isBool(val));
    const isArrayOfInts = (size) => isArray(uniform.value) && uniform.value.length == size * uniform.size && uniform.value.every(val => isInt(val));
    const isArrayOfUints = (size) => isArray(uniform.value) && uniform.value.length == size * uniform.size && uniform.value.every(val => isUint(val));
    const errorMessage = (size, type) => `Value of uniform must be an array of ${size * uniform.size} ${type}s!`;
    // Assign non-sampler uniforms.
    switch (uniform.type) {
        case 'float':
            assert(() => [isNumber(uniform.value), `Value of uniform must be a number!`]);
            return gl.uniform1f(uniform.location, uniform.value);
        case 'vec2':
            assert(() => [isArrayOfNumbers(2), errorMessage(2, 'number')]);
            return gl.uniform2fv(uniform.location, uniform.value);
        case 'vec3':
            assert(() => [isArrayOfNumbers(3), errorMessage(3, 'number')]);
            return gl.uniform3fv(uniform.location, uniform.value);
        case 'vec4':
            assert(() => [isArrayOfNumbers(4), errorMessage(4, 'number')]);
            return gl.uniform4fv(uniform.location, uniform.value);
        case 'mat2':
        case 'mat2x2':
            assert(() => [isArrayOfNumbers(4), errorMessage(4, 'number')]);
            return gl.uniformMatrix2fv(uniform.location, false, uniform.value);
        case 'mat3':
        case 'mat3x3':
            assert(() => [isArrayOfNumbers(9), errorMessage(9, 'number')]);
            return gl.uniformMatrix3fv(uniform.location, false, uniform.value);
        case 'mat4':
        case 'mat4x4':
            assert(() => [isArrayOfNumbers(16), errorMessage(16, 'number')]);
            return gl.uniformMatrix4fv(uniform.location, false, uniform.value);
        case 'int':
        case 'sampler2D':
        case 'sampler2DArray':
        case 'samplerCube':
        case 'sampler3D':
        case 'isampler2D':
        case 'isampler2DArray':
        case 'isamplerCube':
        case 'isampler3D':
        case 'usampler2D':
        case 'usampler2DArray':
        case 'usamplerCube':
        case 'usampler3D':
        case 'sampler2DShadow':
        case 'sampler2DArrayShadow':
        case 'samplerCubeShadow':
            assert(() => [isInt(uniform.value), `Value of uniform must be an integer!`]);
            return gl.uniform1i(uniform.location, uniform.value);
        case 'uint':
            assert(() => [isUint(uniform.value), `Value of uniform must be a positive integer!`]);
            return gl.uniform1ui(uniform.location, uniform.value);
        case 'bool':
            assert(() => [isBool(uniform.value), `Value of uniform must be a boolean, zero or one!`]);
            return gl.uniform1i(uniform.location, uniform.value ? 1 : 0);
        case 'mat2x3':
            assert(() => [isArrayOfNumbers(6), errorMessage(6, 'number')]);
            return gl.uniformMatrix2x3fv(uniform.location, false, uniform.value);
        case 'mat3x2':
            assert(() => [isArrayOfNumbers(6), errorMessage(6, 'number')]);
            return gl.uniformMatrix3x2fv(uniform.location, false, uniform.value);
        case 'mat2x4':
            assert(() => [isArrayOfNumbers(8), errorMessage(8, 'number')]);
            return gl.uniformMatrix2x4fv(uniform.location, false, uniform.value);
        case 'mat4x2':
            assert(() => [isArrayOfNumbers(8), errorMessage(8, 'number')]);
            return gl.uniformMatrix4x2fv(uniform.location, false, uniform.value);
        case 'mat3x4':
            assert(() => [isArrayOfNumbers(12), errorMessage(12, 'number')]);
            return gl.uniformMatrix3x4fv(uniform.location, false, uniform.value);
        case 'mat4x3':
            assert(() => [isArrayOfNumbers(12), errorMessage(12, 'number')]);
            return gl.uniformMatrix4x3fv(uniform.location, false, uniform.value);
        case 'ivec2':
            assert(() => [isArrayOfInts(2), errorMessage(2, 'integer')]);
            return gl.uniform2iv(uniform.location, uniform.value);
        case 'ivec3':
            assert(() => [isArrayOfInts(3), errorMessage(3, 'integer')]);
            return gl.uniform3iv(uniform.location, uniform.value);
        case 'ivec4':
            assert(() => [isArrayOfInts(4), errorMessage(4, 'integer')]);
            return gl.uniform4iv(uniform.location, uniform.value);
        case 'uvec2':
            assert(() => [isArrayOfUints(2), errorMessage(2, 'positive integer')]);
            return gl.uniform2uiv(uniform.location, uniform.value);
        case 'uvec3':
            assert(() => [isArrayOfUints(3), errorMessage(3, 'positive integer')]);
            return gl.uniform3uiv(uniform.location, uniform.value);
        case 'uvec4':
            assert(() => [isArrayOfUints(4), errorMessage(4, 'positive integer')]);
            return gl.uniform4uiv(uniform.location, uniform.value);
        case 'bvec2':
            assert(() => [isArrayOfBools(2), errorMessage(2, 'boolean')]);
            return gl.uniform2iv(uniform.location, uniform.value);
        case 'bvec3':
            assert(() => [isArrayOfBools(3), errorMessage(3, 'boolean')]);
            return gl.uniform3iv(uniform.location, uniform.value);
        case 'bvec4':
            assert(() => [isArrayOfBools(4), errorMessage(4, 'boolean')]);
            return gl.uniform4iv(uniform.location, uniform.value);
        default:
            throwError(() => `Unsupported uniform type "${uniform.type}"`);
    }
}
/** Produce a default value for a uniform based on its type.
 * @param type GLSL type of the uniform.
 * @param size Size of the uniform (for arrays).
 * @returns A default value for the uniform or null if no default value is known.
 */
function getDefaultUniformValue(type, size) {
    assert(() => [size >= 1, `Uniform size must be at least 1, not ${size}.`]);
    let result;
    switch (type) {
        case 'float':
        case 'int':
        case 'uint':
        case 'bool':
            result = 0;
            break;
        case 'vec2':
        case 'ivec2':
        case 'uvec2':
        case 'bvec2':
            result = [0, 0];
            break;
        case 'vec3':
        case 'ivec3':
        case 'uvec3':
        case 'bvec3':
            result = [0, 0, 0];
            break;
        case 'vec4':
        case 'ivec4':
        case 'uvec4':
        case 'bvec4':
            result = [0, 0, 0, 0];
            break;
        case 'mat2':
        case 'mat2x2':
            result = [
                1, 0,
                0, 1
            ];
            break;
        case 'mat3':
        case 'mat3x3':
            result = [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1
            ];
            break;
        case 'mat4':
        case 'mat4x4':
            result = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                0, 0, 0, 1
            ];
            break;
        case 'mat2x3':
            result = [
                1, 0,
                0, 1,
                0, 0
            ];
            break;
        case 'mat2x4':
            result = [
                1, 0,
                0, 1,
                0, 0,
                0, 0
            ];
            break;
        case 'mat3x2':
            result = [
                1, 0, 0,
                0, 1, 0
            ];
            break;
        case 'mat3x4':
            result = [
                1, 0, 0,
                0, 1, 0,
                0, 0, 1,
                0, 0, 0
            ];
            break;
        case 'mat4x2':
            result = [
                1, 0, 0, 0,
                0, 1, 0, 0
            ];
            break;
        case 'mat4x3':
            result = [
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0
            ];
            break;
        default:
            // Samplers have no meaningful default value. Instead they default
            // to zero which is a valid texture unit but might not be what
            // the user wants.
            return null;
    }
    if (size === 1) {
        return result;
    }
    else {
        return Array(size).fill(result).flat();
    }
}
/**
 * By default, all Uniforms are initialized to zero, which is not always what
 * the user wants. This function returns true if the given uniform type requires
 * an explicit default value (even i)
 * @param type
 * @returns
 */
function uniformHasNonZeroDefault(type) {
    switch (type) {
        case 'float':
        case 'int':
        case 'uint':
        case 'bool':
        case 'vec2':
        case 'ivec2':
        case 'uvec2':
        case 'bvec2':
        case 'vec3':
        case 'ivec3':
        case 'uvec3':
        case 'bvec3':
        case 'vec4':
        case 'ivec4':
        case 'uvec4':
        case 'bvec4':
            return false;
        default:
            return true;
    }
}
/**
 * Create a new Shader Program from the given Vertex and Fragment Shaders.
 * @param gl The WebGL context.
 * @param name The name of the shader program.
 * @param vertexShader The vertex shader.
 * @param fragmentShader The fragment shader.
 * @param uniforms The initial values of the uniforms.
 * Unspecified non-sampler uniforms are initialized to a default value based on its type (zero or identity matrix).
 * Unspecified sampler uniforms will cause an error.
 * @param attributes Manual locations for the attributes.
 * If an attribute is not specified, the location is determined automatically.
 * @returns The Shader Program object.
 */
function createShaderProgram(gl, name, vertexShader, fragmentShader, uniforms = {}, attributes = {}) {
    // Check that the shaders are valid.
    if (vertexShader.glObject === null) {
        throwError(() => `Cannot create shader program "${name}" because the vertex shader has been deleted.`);
    }
    if (fragmentShader.glObject === null) {
        throwError(() => `Cannot create shader program "${name}" because the fragment shader has been deleted.`);
    }
    // Create the shader program.
    const glProgram = gl.createProgram();
    if (glProgram === null) {
        throwError(() => `Failed to create a new WebGL shader program for "${name}".`);
    }
    gl.attachShader(glProgram, vertexShader.glObject);
    gl.attachShader(glProgram, fragmentShader.glObject);
    // Find all attributes in the vertex shader.
    // If the user specified locations for the attributes, bind them now.
    const foundAttributes = findAttributes(vertexShader.source);
    // TODO: warn about reserved attributes starting with "webgl_" or "_webgl_", see https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/bindAttribLocation#name
    if (Object.keys(attributes).length > 0) {
        for (const [attributeName, attributeLocation] of Object.entries(attributes)) {
            const attributeInfo = foundAttributes[attributeName];
            if (attributeInfo === undefined) {
                logWarning(() => `Attribute "${attributeName}" not found in vertex shader of shader program "${name}".`);
                continue;
            }
            if (attributeInfo.location !== undefined && attributeInfo.location !== attributeLocation) {
                logWarning(() => `Vertex shader of shader program "${name}" specifies the location of attribute "${attributeName}" to be ${attributeInfo.location}, not ${attributeLocation}.`);
                continue;
            }
            attributeInfo.location = attributeLocation; // update the info as well
            gl.bindAttribLocation(glProgram, attributeLocation, attributeName);
        }
    }
    // Link the program and check for errors
    gl.linkProgram(glProgram);
    if (!gl.getProgramParameter(glProgram, gl.LINK_STATUS)) {
        throwError(() => `Failed to link shader program "${name}": ${gl.getProgramInfoLog(glProgram)}`
            + `\nVertex Shader log: ${gl.getShaderInfoLog(vertexShader.glObject)}`
            + `\nFragent Shader log: ${gl.getShaderInfoLog(fragmentShader.glObject)}`);
    }
    // Store the actual location of all attributes.
    const shaderAttributes = new Map();
    for (const [attributeName, attributeInfo] of Object.entries(foundAttributes)) {
        const location = gl.getAttribLocation(glProgram, attributeName);
        if (location === -1) {
            logWarning(() => `Attribute "${attributeName}" not found in linked shader program "${name}"!`);
            continue;
        }
        if (attributeInfo.location) {
            if (attributeInfo.location === location) {
                logInfo(() => `Attribute "${attributeName}" of shader "${name}" found at expected location ${location}.`);
            }
            else {
                logWarning(() => `Shader program "${name}" overrides the location of attribute "${attributeName}" to be ${location}, not ${attributeInfo.location}.`);
            }
        }
        else {
            logInfo(() => `Attribute "${attributeName}" of shader "${name}" found at automatic location ${location}.`);
        }
        shaderAttributes.set(attributeName, { location, type: attributeInfo.type });
    }
    // Detect missing uniforms
    const foundUniforms = findUniforms(vertexShader.source, fragmentShader.source);
    for (const uniformName of Object.keys(uniforms)) {
        if (!(uniformName in foundUniforms)) {
            logWarning(() => `Uniform "${uniformName}" not found in shader program '${name}'!`);
        }
    }
    // Create uniform objects.
    const shaderUniforms = new Map();
    gl.useProgram(glProgram);
    for (const [uniformName, foundUniform] of Object.entries(foundUniforms)) {
        // Find the uniform location.
        const location = gl.getUniformLocation(glProgram, uniformName);
        if (location === null) {
            logWarning(() => `Unused Uniform "${uniformName}" was removed from shader program "${name}"!`);
            continue;
        }
        // Determine the initial value of the uniform.
        const uniformSize = foundUniform.size ?? 1;
        const manualInitialValue = uniforms[uniformName];
        let initialValue;
        if (manualInitialValue !== undefined) {
            initialValue = manualInitialValue;
        }
        else {
            const maybeInitialValue = getDefaultUniformValue(foundUniform.type, uniformSize);
            if (maybeInitialValue === null) {
                throwError(() => `Uniform "${uniformName}" of type '${foundUniform.type}' requires an explicit default value in shader "${name}"`);
            }
            initialValue = maybeInitialValue;
        }
        // Create and store the uniform object.
        const shaderUniform = {
            type: foundUniform.type,
            location,
            size: uniformSize,
            value: initialValue,
        };
        shaderUniforms.set(uniformName, shaderUniform);
        // Upload the value.
        if (manualInitialValue !== undefined || uniformHasNonZeroDefault(foundUniform.type)) {
            try {
                setUniform(gl, shaderUniform);
            }
            catch (error) {
                throwError(() => `Failed to set initial value of uniform "${uniformName}" of shader "${name}": ${error}`);
            }
            logInfo(() => `Uniform "${uniformName}" of shader "${name}" initialized with: ${shaderUniform.value}.`);
        }
    }
    gl.useProgram(null);
    // Return the shader program.
    return {
        name,
        glObject: glProgram,
        vertexShader,
        fragmentShader,
        attributes: shaderAttributes,
        uniforms: shaderUniforms,
    };
}
// Draw Call ================================================================ //
function createTextureUnit(texture) {
    switch (texture.target) {
        case TextureTarget.TEXTURE_2D:
            return { texture_2d: texture };
        case TextureTarget.TEXTURE_3D:
            return { texture_3d: texture };
        case TextureTarget.TEXTURE_CUBE_MAP:
            return { texture_cube: texture };
        case TextureTarget.TEXTURE_2D_ARRAY:
            return { texture_2d_array: texture };
        default:
            throwError(() => `Unsupported texture target: ${texture.target}`);
    }
}
function insertIntoTextureUnit(textureUnit, texture, unitId) {
    switch (texture.target) {
        case TextureTarget.TEXTURE_2D:
            if (textureUnit.texture_2d !== undefined) {
                throwError(() => `Texture unit ${unitId} already contains a 2D texture!`);
            }
            textureUnit.texture_2d = texture;
            break;
        case TextureTarget.TEXTURE_3D:
            if (textureUnit.texture_3d !== undefined) {
                throwError(() => `Texture unit ${unitId} already contains a 3D texture!`);
            }
            textureUnit.texture_3d = texture;
            break;
        case TextureTarget.TEXTURE_CUBE_MAP:
            if (textureUnit.texture_cube !== undefined) {
                throwError(() => `Texture unit ${unitId} already contains a cube map!`);
            }
            textureUnit.texture_cube = texture;
            break;
        case TextureTarget.TEXTURE_2D_ARRAY:
            if (textureUnit.texture_2d_array !== undefined) {
                throwError(() => `Texture unit ${unitId} already contains a 2D array texture!`);
            }
            textureUnit.texture_2d_array = texture;
            break;
        default:
            throwError(() => `Unsupported texture target: ${texture.target}`);
    }
}
/**
 * Checks if the given attribute type matches the given GLSL type.
 * With matnxm types, the n signifies the number of columns and the m the number
 * of rows. See https://www.khronos.org/opengl/wiki/Data_Type_(GLSL)#Matrices
 * @param attr Attribute description.
 * @param glslType GLSL type name.
 * @returns True if the attribute type matches the GLSL type.
 */
function matchAttributeType(attr, glslType) {
    const attributeWidth = attr.width ?? 1;
    switch (attr.type) {
        case AttributeDataType.BYTE:
        case AttributeDataType.UNSIGNED_BYTE:
        case AttributeDataType.SHORT:
        case AttributeDataType.UNSIGNED_SHORT:
        case AttributeDataType.INT:
        case AttributeDataType.INT_2_10_10_10_REV:
        case AttributeDataType.UNSIGNED_INT:
        case AttributeDataType.UNSIGNED_INT_2_10_10_10_REV:
            switch (glslType) {
                case 'int':
                case 'uint':
                    return attr.size === 1 && attributeWidth === 1;
                case 'ivec2':
                case 'uvec2':
                    return attr.size === 2 && attributeWidth === 1;
                case 'ivec3':
                case 'uvec3':
                    return attr.size === 3 && attributeWidth === 1;
                case 'ivec4':
                case 'uvec4':
                    return attr.size === 4 && attributeWidth === 1;
                default:
                    return false;
            }
        case AttributeDataType.FLOAT:
        case AttributeDataType.HALF_FLOAT:
            switch (glslType) {
                case 'float':
                    return attr.size === 1 && attributeWidth === 1;
                case 'vec2':
                    return attr.size === 2 && attributeWidth === 1;
                case 'vec3':
                    return attr.size === 3 && attributeWidth === 1;
                case 'vec4':
                    return attr.size === 4 && attributeWidth === 1;
                case 'mat2':
                case 'mat2x2':
                    return attr.size === 2 && attributeWidth === 2;
                case 'mat2x3':
                    return attr.size === 3 && attributeWidth === 2;
                case 'mat2x4':
                    return attr.size === 4 && attributeWidth === 2;
                case 'mat3x2':
                    return attr.size === 2 && attributeWidth === 3;
                case 'mat3':
                case 'mat3x3':
                    return attr.size === 3 && attributeWidth === 3;
                case 'mat3x4':
                    return attr.size === 4 && attributeWidth === 3;
                case 'mat4x2':
                    return attr.size === 2 && attributeWidth === 4;
                case 'mat4x3':
                    return attr.size === 3 && attributeWidth === 4;
                case 'mat4':
                case 'mat4x4':
                    return attr.size === 4 && attributeWidth === 4;
                default:
                    return false;
            }
    }
}
/**
 * Produces the appropriate GLSL type for the given attribute.
 * @param attr Attribute description.
 * @returns The GLSL type name.
 * @throws If the attribute type is invalid.
 */
function attributeToGLSLType(attr) {
    switch (attr.type) {
        case AttributeDataType.BYTE:
        case AttributeDataType.SHORT:
        case AttributeDataType.INT:
        case AttributeDataType.INT_2_10_10_10_REV:
            switch (attr.width ?? 1) {
                case 1:
                    switch (attr.size) {
                        case 1: return 'int';
                        case 2: return 'ivec2';
                        case 3: return 'ivec3';
                        case 4: return 'ivec4';
                    }
            }
            break;
        case AttributeDataType.UNSIGNED_BYTE:
        case AttributeDataType.UNSIGNED_SHORT:
        case AttributeDataType.UNSIGNED_INT:
        case AttributeDataType.UNSIGNED_INT_2_10_10_10_REV:
            switch (attr.width ?? 1) {
                case 1:
                    switch (attr.size) {
                        case 1: return 'uint';
                        case 2: return 'uvec2';
                        case 3: return 'uvec3';
                        case 4: return 'uvec4';
                    }
            }
            break;
        case AttributeDataType.FLOAT:
        case AttributeDataType.HALF_FLOAT:
            switch (attr.width ?? 1) {
                case 1:
                    switch (attr.size) {
                        case 1: return 'float';
                        case 2: return 'vec2';
                        case 3: return 'vec3';
                        case 4: return 'vec4';
                    }
                    break;
                case 2:
                    switch (attr.size) {
                        case 2: return 'mat2';
                        case 3: return 'mat2x3';
                        case 4: return 'mat2x4';
                    }
                    break;
                case 3:
                    switch (attr.size) {
                        case 2: return 'mat3x2';
                        case 3: return 'mat3';
                        case 4: return 'mat3x4';
                    }
                    break;
                case 4:
                    switch (attr.size) {
                        case 2: return 'mat4x2';
                        case 3: return 'mat4x3';
                        case 4: return 'mat4';
                    }
                    break;
            }
    }
    throwError(() => `Invalid attribute type: ${attr.type} with a size of ${attr.size} and a width of ${attr.width}.`);
}
/**
 * Creates a new Draw Call.
 * @param program
 * @param vao
 * @param uniforms Uniform update callbacks to update uniforms before drawing.
 */
function createDrawCall(// TODO: add support for blending (see lecture on deferred rendering)
gl, program, vao, options = {}) {
    // Validate the arguments.
    const uniforms = options.uniforms ?? {};
    const textures = options.textures ?? [];
    const cullFace = options.cullFace ?? CullFace.NONE;
    const depthTest = options.depthTest ?? DepthTest.NONE;
    const indexCount = options.indexCount === undefined ? vao.ibo.size : Math.ceil(options.indexCount);
    const indexOffset = options.indexOffset === undefined ? 0 : Math.ceil(options.indexOffset);
    const instanceCount = options.instanceCount === undefined ? 1 : Math.ceil(options.instanceCount);
    const renderDepth = options.renderDepth ?? true;
    if (indexCount <= 0) {
        throwError(() => `Invalid index count: ${indexCount}.`);
    }
    if (indexOffset < 0) {
        throwError(() => `Invalid index offset: ${indexOffset}.`);
    }
    if (indexOffset + indexCount > vao.ibo.size) {
        throwError(() => `Index offset ${indexOffset} and count ${indexCount} exceed the size of the index buffer (${vao.ibo.size}).`);
    }
    if (instanceCount <= 0) {
        throwError(() => `Instance count cannot be <= 0, is: ${instanceCount}.`);
    }
    // Ensure that the attribute locations of the VAO match the shader program.
    for (const [attributeName, shaderAttribute] of program.attributes.entries()) {
        const vaoAttributeRef = vao.attributes.get(shaderAttribute.location);
        if (vaoAttributeRef === undefined) {
            throwError(() => `VAO "${vao.name}" does not provide an attribute for "${attributeName}" (at location ${shaderAttribute.location}) of shader program "${program.name}"!`);
        }
        const vaoAttribute = vaoAttributeRef.buffer.attributes.get(vaoAttributeRef.name);
        if (vaoAttribute === undefined) {
            throwError(() => `Missing attribute "${vaoAttributeRef.name}" in VBO "${vaoAttributeRef.buffer.name}"!`);
        }
        if (!matchAttributeType(vaoAttribute, shaderAttribute.type)) {
            throwError(() => {
                const attributeType = attributeToGLSLType(vaoAttribute);
                return `Attribute "${vaoAttributeRef.name}" in VBO "${vaoAttributeRef.buffer.name}" has type '${attributeType}' but shader program "${program.name}" expects type '${shaderAttribute.type} at location ${shaderAttribute.location}'!`;
            });
        }
        if (attributeName != vaoAttributeRef.name) {
            logWarning(() => `Attribute "${attributeName}" of shader program "${program.name}" at location ${shaderAttribute.location} is bound to attribute "${vaoAttributeRef.name}" in VBO "${vaoAttributeRef.buffer.name}"!`);
        }
    }
    // Ensure that all uniforms actually exist in the shader program
    for (const uniformName of Object.keys(uniforms)) {
        if (!program.uniforms.has(uniformName)) {
            logWarning(() => `Uniform "${uniformName}" not found in shader program "${program.name}"!`);
        }
    }
    // Create the texture unit mapping.
    const maxTextureUnits = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    const textureUnits = new Map();
    for (const [unitId, texture] of textures) {
        if (unitId < 0 || unitId >= maxTextureUnits) {
            throwError(() => `Invalid texture unit id: ${unitId}. Valid range is [0, ${maxTextureUnits}).`);
        }
        const usedUnit = textureUnits.get(unitId);
        if (usedUnit === undefined) {
            textureUnits.set(unitId, createTextureUnit(texture));
        }
        else {
            insertIntoTextureUnit(usedUnit, texture, unitId);
        }
    }
    // Create the draw call.
    return {
        program,
        vao,
        count: indexCount,
        offset: indexOffset,
        uniforms: new Map(Object.entries(uniforms)),
        textures: textureUnits,
        cullFace,
        depthTest,
        instanceCount,
        renderDepth,
        enabled: options.enabled,
    };
}
function performDrawCall(gl, drawCall, time) {
    // Return early if the draw call is disabled.
    if (drawCall.enabled !== undefined && !drawCall.enabled(time)) {
        return;
    }
    // Bind the VAO and shader program.
    gl.bindVertexArray(drawCall.vao.glObject);
    gl.useProgram(drawCall.program.glObject);
    // Set up the WebGL state for the draw call.
    if (drawCall.cullFace !== CullFace.NONE) {
        gl.enable(gl.CULL_FACE);
        gl.cullFace(drawCall.cullFace);
    }
    if (drawCall.depthTest !== DepthTest.NONE) {
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(drawCall.depthTest);
    }
    gl.depthMask(drawCall.renderDepth);
    try {
        // Update the uniforms.
        for (const [uniformName, updateCallback] of drawCall.uniforms) {
            const uniform = drawCall.program.uniforms.get(uniformName);
            if (uniform === undefined) {
                // logWarning(() => `Uniform "${uniformName}" from update callback not found in shader program "${drawCall.program.name}"!`);
                // TODO: a logWarning(once) would be nice
                continue;
            }
            const newValue = updateCallback(time);
            if (newValue === undefined) {
                throwError(() => `Uniform update callback for "${uniformName}" returned undefined!`);
            }
            if (newValue == uniform.value) { // TODO: this does not seem to work for comparing matrices
                continue; // no need to update
            }
            uniform.value = newValue;
            try {
                setUniform(gl, uniform);
            }
            catch (error) {
                throwError(() => `Failed to update uniform "${uniformName}" of shader "${drawCall.program.name}": ${error}`);
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
        if (drawCall.instanceCount == 1) {
            gl.drawElements(gl.TRIANGLES, drawCall.count, drawCall.vao.ibo.type, drawCall.offset);
        }
        else if (drawCall.instanceCount > 1) {
            gl.drawElementsInstanced(gl.TRIANGLES, drawCall.count, drawCall.vao.ibo.type, drawCall.offset, drawCall.instanceCount);
        }
        else {
            throwError(() => `Invalid instance count: ${drawCall.instanceCount}.`);
        }
    }
    // Always restore the WebGL state.
    finally {
        gl.depthMask(true);
        gl.depthFunc(gl.ALWAYS);
        gl.disable(gl.DEPTH_TEST);
        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);
        gl.useProgram(null);
        gl.bindVertexArray(null);
    }
}
// TODO: function to perform a sequence of draw calls, which can be optimized with fewer state changes
