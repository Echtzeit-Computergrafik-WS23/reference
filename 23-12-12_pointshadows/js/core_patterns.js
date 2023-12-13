export { buildShaderProgram, buildAttributeMap, combineAttributeMaps, loadTexture, loadTextureNow, loadCubemap, loadCubemapNow, Cached, TimeSensitive, FramebufferStack, };
import { TextureDataTarget, TextureTarget, } from "./types.js";
import { throwError, shallowCopy, } from "./dev.js";
import { createFragmentShader, createShaderProgram, createTexture, createVertexShader, updateTexture, deleteShader, } from "./core.js";
// Attribute ================================================================= //
/**
 * Inspects the given shader and attribute buffer to build a mapping between
 * the shader's attribute locations and the buffer's attributes.
 * @param shader Shader to inspect.
 * @param abo Attribute buffer object to inspect.
 * @param mapping Explicit mapping between shader attributes and buffer attributes.
 * If an array, the attribute names in the shader and the buffer are assumed to be the same.
 * If null, the mapping is built automatically.
 * @returns A map from attribute locations to attribute references.
 */
function buildAttributeMap(shader, abo, mapping = null) {
    // If the given buffer is an array, build the attribute map for each buffer
    // and combine them into one.
    if (Array.isArray(abo)) {
        if (mapping !== null) {
            // TODO: Support explicit mapping for multiple buffers
            throwError(() => "Cannot specify mapping for multiple buffers");
        }
        return abo.reduce((acc, cur) => {
            const map = buildAttributeMap(shader, cur);
            for (const [location, reference] of map.entries()) {
                if (acc.has(location)) {
                    throwError(() => `Attribute map collision of location ${location}`);
                }
                acc.set(location, reference);
            }
            return acc;
        }, new Map());
    }
    // If the given mapping is null, inspect the shader and buffer to find
    // matching attributes automatically.
    if (mapping === null) {
        mapping = {};
        for (const attributName of abo.attributes.keys()) {
            if (shader.attributes.has(attributName)) {
                mapping[attributName] = attributName;
            }
        }
    }
    // If the given mapping is just a list of attribute names, we assume
    // that the attribute names in the shader and the buffer are the same.
    else if (Array.isArray(mapping)) {
        mapping = mapping.reduce((acc, cur) => {
            acc[cur] = cur;
            return acc;
        }, {});
    }
    // Build the mapping
    const result = new Map();
    for (const [shaderAttribute, bufferAttribute] of Object.entries(mapping)) {
        const location = shader.attributes.get(shaderAttribute)?.location;
        if (location === undefined) {
            throwError(() => `Attribute ${shaderAttribute} not found in shader ${shader.name}`);
        }
        const description = abo.attributes.get(bufferAttribute);
        if (description === undefined) {
            throwError(() => `Attribute ${bufferAttribute} not found in buffer ${abo.name}`);
        }
        result.set(location, { buffer: abo, name: bufferAttribute });
    }
    return result;
}
/**
 * Combines multiple attribute maps into one, checking for collisions.
 * @param maps Attribute maps to combine.
 * @returns The combined attribute map.
 */
function combineAttributeMaps(...maps) {
    const result = new Map();
    for (const map of maps) {
        for (const [location, reference] of map.entries()) {
            if (result.has(location)) {
                throwError(() => `Attribute map collision of location ${location}`);
            }
            result.set(location, reference);
        }
    }
    return result;
}
// Texture ================================================================== //
function getNameFromURL(url) {
    const segments = url.split("/");
    const filename = segments[segments.length - 1];
    return filename.split(".")[0];
}
/**
 * Helper class to keep track of the completion status of a cubemap.
 */
class CubeMapStatus {
    _counter = 0;
    increment() {
        this._counter++;
    }
    isComplete() {
        return this._counter >= 6;
    }
}
/**
 * Loads a texture asynchronously from the given URL.
 * @param gl WebGL2 context.
 * @param width Width of the texture.
 * @param height Height of the texture.
 * @param url URL of the texture image.
 * @param options Additional texture options:
 * - `name`: Name of the texture, defaults to the filename of the URL.
 * - `target`: Texture target, defaults to `TextureTarget.TEXTURE_2D`.
 * - `useAnisotropy`: Whether to use anisotropic filtering, defaults to `true`.
 * - `createMipMaps`: Whether to create mipmaps.
 * - `filter`: Texture (min/mag) filter(s), defaults to (tri-)linear filtering.
 * - `wrap`: Texture wrap mode(s), defaults to `TextureWrap.CLAMP_TO_EDGE`.
 * - `flipY`: Whether to flip the image vertically, defaults to `true`.
 * @returns The created texture.
 */
function loadTexture(gl, width, height, url, options = {}) {
    const name = options.name ?? getNameFromURL(url);
    const target = options.target ?? TextureTarget.TEXTURE_2D;
    const texture = createTexture(gl, name, width, height, target, null, {
        levels: options.createMipMaps ? undefined : 1,
        useAnisotropy: options.useAnisotropy,
        filter: options.filter,
        wrap: options.wrap,
    });
    let image = new Image();
    image.onload = () => {
        updateTexture(gl, texture, image, {
            flipY: options.flipY ?? true,
        });
        image = null;
    };
    image.src = url;
    return texture;
}
/**
 * Loads a texture synchronously from the given URL.
 * The advantage over loadTexture() is that the texture is immediately available
 * after the function returns and that you do not need to specify the texture size.
 * The disadvantage is that the caller is blocked until the texture is loaded.
 * @param gl WebGL2 context.
 * @param url URL of the texture image.
 * @param options Additional texture options:
 * - `name`: Name of the texture, defaults to the filename of the URL.
 * - `target`: Texture target, defaults to `TextureTarget.TEXTURE_2D`.
 * - `useAnisotropy`: Whether to use anisotropic filtering, defaults to `true`.
 * - `createMipMaps`: Whether to create mipmaps.
 * - `filter`: Texture (min/mag) filter(s), defaults to (tri-)linear filtering.
 * - `wrap`: Texture wrap mode(s), defaults to `TextureWrap.CLAMP_TO_EDGE`.
 * - `flipY`: Whether to flip the image vertically, defaults to `true`.
 * @returns The created texture.
 */
function loadTextureNow(gl, url, options = {}) {
    const name = options.name ?? getNameFromURL(url);
    const target = options.target ?? TextureTarget.TEXTURE_2D;
    return new Promise((resolve, reject) => {
        let image = new Image();
        image.onload = () => {
            const texture = createTexture(gl, name, image.naturalWidth, image.naturalHeight, target, null, {
                levels: options.createMipMaps ? undefined : 1,
                useAnisotropy: options.useAnisotropy,
                filter: options.filter,
                wrap: options.wrap,
            });
            updateTexture(gl, texture, image, {
                flipY: options.flipY ?? true,
            });
            resolve(texture);
            image = null;
        };
        image.onerror = reject;
        image.src = url;
    });
}
/**
 * Loads a cubemap from the given URLs.
 * @param gl WebGL2 context.
 * @param width Width of the texture.
 * @param height Height of the texture.
 * @param name Name of the texture.
 * @param urls URL of the texture image.
 * @param options Additional texture options:
 * - `flipY`: Whether to flip the images vertically, defaults to `false`.
 * @returns The created cubemap, and a completion sentinel.
 */
function loadCubemap(gl, name, width, height, urls, options = {}) {
    // TODO: what about the other `createTexture` options?
    const texture = createTexture(gl, name, width, height, TextureTarget.TEXTURE_CUBE_MAP);
    const completion = new CubeMapStatus();
    urls.forEach((url, index) => {
        let image = new Image();
        if (image === null) {
            throwError(() => "Failed to create empty Image");
        }
        image.onload = () => {
            completion.increment();
            updateTexture(gl, texture, image, {
                target: TextureDataTarget.TEXTURE_CUBE_MAP_POSITIVE_X + index,
                createMipMaps: completion.isComplete(),
                flipY: options.flipY ?? false,
            });
            image = null;
        };
        image.src = url;
    });
    return [texture, completion];
}
/**
 * Loads a cubemap from the given URLs.
 * The advantage over loadCubemap() is that the texture is immediately available
 * after the function returns and that you do not need to specify the texture size.
 * The disadvantage is that the caller is blocked until all faces of the texture
 * are loaded.
 * @param gl WebGL2 context.
 * @param name Name of the texture.
 * @param urls URL of the texture image.
 * @param options Additional texture options:
 * - `flipY`: Whether to flip the images vertically, defaults to `false`.
 * @returns The created cubemap, and a completion sentinel.
 */
function loadCubemapNow(gl, name, urls, options = {}) {
    return new Promise((resolve, reject) => {
        let facesLoaded = 0;
        let images = [null, null, null, null, null, null];
        urls.forEach((url, index) => {
            let image = new Image();
            image.onload = () => {
                images[index] = image;
                if (++facesLoaded === 6) {
                    const width = images[0].naturalWidth;
                    const height = images[0].naturalHeight;
                    for (let i = 1; i < 6; i++) {
                        if (images[i].naturalWidth !== width || images[i].naturalHeight !== height) {
                            reject(`Images for faces of cubemap "${name}" have different sizes`);
                        }
                    }
                    const texture = createTexture(gl, name, width, height, TextureTarget.TEXTURE_CUBE_MAP);
                    for (let i = 0; i < 6; i++) {
                        updateTexture(gl, texture, images[i], {
                            target: TextureDataTarget.TEXTURE_CUBE_MAP_POSITIVE_X + i,
                            createMipMaps: i === 5,
                            flipY: options.flipY ?? false,
                        });
                    }
                    resolve(texture);
                    images = [];
                }
                image = null;
            };
            image.onerror = reject;
            image.src = url;
        });
    });
}
// Shader =================================================================== //
/**
 * Builds a shader program from the given vertex and fragment shader sources.
 * @param gl WebGL2 context.
 * @param name Name of the shader program.
 * @param vertexSource Source code of the vertex shader.
 * @param fragmentSource Source code of the fragment shader.
 * @param uniforms The initial values of the uniforms.
 * Unspecified non-sampler uniforms are initialized to a default value based on its type (zero or identity matrix).
 * Unspecified sampler uniforms will cause an error.
 * @param attributes Manual locations for the attributes.
 * If an attribute is not specified, the location is determined automatically.
 * @returns The created shader program.
 */
function buildShaderProgram(gl, name, vertexSource, fragmentSource, uniforms = {}, attributes = {}) {
    let vertexShader = null;
    let fragmentShader = null;
    try {
        vertexShader = createVertexShader(gl, vertexSource);
        fragmentShader = createFragmentShader(gl, fragmentSource);
        return createShaderProgram(gl, name, vertexShader, fragmentShader, uniforms, attributes);
    }
    finally {
        if (vertexShader !== null) {
            deleteShader(gl, vertexShader);
        }
        if (fragmentShader !== null) {
            deleteShader(gl, fragmentShader);
        }
    }
}
// Framebuffer =============================================================== //
function getFramebufferSize(framebuffer) {
    if (framebuffer.color.length > 0) {
        const attachment = framebuffer.color[0].attachment;
        return [attachment.width, attachment.height];
    }
    else if (framebuffer.depth !== null) {
        const attachment = framebuffer.depth.attachment;
        return [attachment.width, attachment.height];
    }
    else if (framebuffer.stencil !== null) {
        const attachment = framebuffer.stencil.attachment;
        return [attachment.width, attachment.height];
    }
    else {
        throwError(() => `Framebuffer ${framebuffer.name} has no attachments`);
    }
}
/**
 * Helper class to manage a stack of framebuffers.
 * When a framebuffer is pushed onto the stack, it is bound and the viewport is set.
 * When a framebuffer is popped from the stack, the previous framebuffer is bound
 * and the viewport is set.
 * If the stack is empty, the default framebuffer is bound.
 */
class FramebufferStack {
    /** The stack of framebuffers. */
    _stack = [];
    /**
     * Pushes the given framebuffer onto the stack and binds it.
     * @param gl The WebGL2 context.
     * @param framebuffer The framebuffer to push.
     */
    push(gl, framebuffer) {
        // If the given framebuffer is already bound, do nothing.
        if (this._stack.at(-1) === framebuffer) {
            return;
        }
        // Push the given framebuffer onto the stack.
        this._stack.push(framebuffer);
        try {
            // Bind the new framebuffer and set the viewport.
            const [width, height] = getFramebufferSize(framebuffer);
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer.glObject);
            gl.viewport(0, 0, width, height);
        }
        catch (e) {
            // If an error occurs, pop the framebuffer from the stack and re-throw the error.
            this.pop(gl);
            throw e;
        }
    }
    /**
     * Pops the top framebuffer from the stack and binds the previous framebuffer.
     * If the stack is empty, the default framebuffer is bound.
     * @param gl The WebGL2 context.
     */
    pop(gl) {
        // Remove the top framebuffer from the stack.
        this._stack.pop();
        // Bind the previous framebuffer, or the default framebuffer if the stack is empty.
        // Any error doing so is not recoverable, so we do not try to handle it.
        const previousFramebuffer = this._stack.at(-1);
        if (previousFramebuffer) {
            const [width, height] = getFramebufferSize(previousFramebuffer);
            gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer.glObject);
            gl.viewport(0, 0, width, height);
        }
        else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }
    }
}
// Draw Call ================================================================ //
/**
 * A cached value, useful in render loops where the same value is needed
 * multiple times per frame.
 */
class Cached {
    _getter;
    _value = null;
    _isDirty = true;
    _dependents = new Set();
    /**
     * @param _getter Getter function that returns the value.
     * @param dependencies List of other cached values that this value depends on.
     * If any of the dependencies is dirty, this value will be re-evaluated.
     */
    constructor(_getter, dependencies = []) {
        this._getter = _getter;
        for (const dependency of dependencies) {
            dependency._dependents.add(this);
        }
    }
    /**
     * Returns the cached value, or re-evaluates the value if the value
     * is dirty.
     * @returns The cached value.
     */
    get() {
        if (this._isDirty) {
            this._value = this._getter();
            this._isDirty = false;
        }
        return shallowCopy(this._value);
    }
    /**
     * Forces a re-evaluation of the cached value at the next call to get().
     */
    setDirty() {
        this._isDirty = true;
        for (const dependent of this._dependents) {
            dependent.setDirty();
        }
    }
}
/**
 * A cached value that is only updated when the given time changes.
 * Does not require dependency management, because we assume that the time
 * is only changed once per frame.
 */
class TimeSensitive {
    _getter;
    _value = null;
    _timestamp = -1;
    /**
     * @param _getter Getter function that returns the value at the given time.
     */
    constructor(_getter) {
        this._getter = _getter;
    }
    /**
     * Returns the cached value at the given time, or re-evaluates the value
     * if the time has changed since the last call.
     * @param time Current time.
     * @returns The cached value.
     */
    getAt(time) {
        if (this._timestamp < time) {
            this._value = this._getter(time);
            this._timestamp = time;
        }
        return shallowCopy(this._value);
    }
    /**
     * Forces a re-evaluation of the cached value at the next call to getAt().
     */
    setDirty() {
        this._timestamp = -1;
    }
}
