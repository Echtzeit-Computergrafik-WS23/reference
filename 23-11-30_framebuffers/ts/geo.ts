/**
 * @module glance/geo
 * @desc The geo module provides functions to load or create geometry.
 * @license MIT
 * @version 0.2
 */
export
{
    createPlaneAttributes,
    createPlaneIndices,
    createBoxAttributes,
    createBoxIndices,
    createSkyBoxAttributes,
    createSkyBoxIndices,
    createSphereAttributes,
    createSphereIndices,
    createTorusKnotAttributes,
    createTorusKnotIndices,
    createQuadAttributes,
    createQuadIndices,
    loadObj,
};
import
{
    logWarning,
    throwError,
} from "./dev.js";
import
{
    vec3,
    type Vec3,
} from "./math.js";


// =============================================================================
// Module functions
// =============================================================================


function createPlaneAttributes(width: number = 1, height: number = 1, options: {
    widthSegments?: number,
    heightSegments?: number,
    normals?: boolean,
    uvs?: boolean,
    uvScale?: number | [number, number],
} = {}): Array<number>
{
    // Validate the arguments.
    width = Math.abs(width);
    height = Math.abs(height);
    const widthSegments = Math.ceil(options.widthSegments ?? 1);
    const heightSegments = Math.ceil(options.heightSegments ?? 1);
    if (options.uvs !== true && options.uvScale !== undefined) {
        logWarning(() => "Ignoring `uvScale` parameter for a plane without UVs.");
    }
    let uScale: number;
    let vScale: number;
    if (options.uvScale === undefined) {
        uScale = 1;
        vScale = 1;
    }
    else if (Array.isArray(options.uvScale)) {
        uScale = options.uvScale[0];
        vScale = options.uvScale[1];
    }
    else {
        uScale = options.uvScale;
        vScale = options.uvScale;
    }

    // Create values for all arrays of the plane.
    // They are easier to create and then discard if unused.
    const positions: Array<number> = [];
    const normals: Array<number> = [];
    const texCoords: Array<number> = [];
    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;

        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;

            positions.push(2 * u - 1 * width, 2 * v - 1 * height, 0);
            normals.push(0, 0, 1);
            texCoords.push(u * uScale, v * vScale);
        }
    }

    // Create the interleaved vertex array.
    const interleaved: Array<Array<number>> = [positions];
    const quantities: Array<number> = [3];
    if (options.normals ?? true) {
        interleaved.push(normals);
        quantities.push(3);
    }
    if (options.uvs ?? true) {
        interleaved.push(texCoords);
        quantities.push(2);
    }
    return interleaveArrays(interleaved, quantities);
}

function createPlaneIndices(widthSegments: number = 1, depthSegments: number = 1): Array<number>
{
    const indices = [];
    for (let y = 0; y < depthSegments; y++) {
        for (let x = 0; x < widthSegments; x++) {
            const a = (widthSegments + 1) * (y + 0) + (x + 0);
            const b = (widthSegments + 1) * (y + 0) + (x + 1);
            const c = (widthSegments + 1) * (y + 1) + (x + 1);
            const d = (widthSegments + 1) * (y + 1) + (x + 0);
            indices.push(
                a, b, d,
                b, c, d
            );
        }
    }
    return indices;
}

// TODO: I think the box UVs are flipped vertically
// TODO: I want my mega-capsule primitive that can do everything

/**
 * Creates attributes for a box with the given options.
 * @param width The width of the box. Defaults to 1.
 * @param options Additional options:
 * - height: The height of the box. Defaults to width.
 * - depth: The depth of the box. Defaults to width.
 * - normals: Whether or not to generate normals. Defaults to true.
 * - texCoords: Whether or not to generate texture coordinates. Defaults to true.
 * - sharedVertices: Whether or not to share vertices. Defaults to false.
 * @returns An array of interleaved vertex attributes.
 */
function createBoxAttributes(width: number = 1, options: {
    height?: number,
    depth?: number;
    normals?: boolean;
    texCoords?: boolean;
    sharedVertices?: boolean;
} = {})
{
    width = Math.abs(width);
    const height = options.height ?? width;
    const depth = options.depth ?? width;
    const normals = options.normals ?? true;
    const texCoords = options.texCoords ?? true;
    const sharedVertices = options.sharedVertices ?? false;

    // Create an array of positions for the cube.
    const halfWidth = width / 2.;
    const halfHeight = height / 2.;
    const halfDepth = depth / 2.;
    const positionAttributes: number[] = sharedVertices ? [
        -halfWidth, -halfHeight, -halfDepth,
        +halfWidth, -halfHeight, -halfDepth,
        +halfWidth, +halfHeight, -halfDepth,
        -halfWidth, +halfHeight, -halfDepth,
        -halfWidth, -halfHeight, +halfDepth,
        +halfWidth, -halfHeight, +halfDepth,
        +halfWidth, +halfHeight, +halfDepth,
        -halfWidth, +halfHeight, +halfDepth,
    ] : [
        -halfWidth, -halfHeight, +halfDepth, // front
        +halfWidth, -halfHeight, +halfDepth,
        +halfWidth, +halfHeight, +halfDepth,
        -halfWidth, +halfHeight, +halfDepth,
        +halfWidth, -halfHeight, -halfDepth, // back
        -halfWidth, -halfHeight, -halfDepth,
        -halfWidth, +halfHeight, -halfDepth,
        +halfWidth, +halfHeight, -halfDepth,
        -halfWidth, +halfHeight, +halfDepth, // top
        +halfWidth, +halfHeight, +halfDepth,
        +halfWidth, +halfHeight, -halfDepth,
        -halfWidth, +halfHeight, -halfDepth,
        -halfWidth, -halfHeight, -halfDepth, // bottom
        +halfWidth, -halfHeight, -halfDepth,
        +halfWidth, -halfHeight, +halfDepth,
        -halfWidth, -halfHeight, +halfDepth,
        +halfWidth, -halfHeight, +halfDepth, // right
        +halfWidth, -halfHeight, -halfDepth,
        +halfWidth, +halfHeight, -halfDepth,
        +halfWidth, +halfHeight, +halfDepth,
        -halfWidth, -halfHeight, -halfDepth, // left
        -halfWidth, -halfHeight, +halfDepth,
        -halfWidth, +halfHeight, +halfDepth,
        -halfWidth, +halfHeight, -halfDepth,
    ];

    // The position attribute is always required.
    const interleavedArrays: Array<Array<number>> = [positionAttributes];
    const interleavedWidths: Array<number> = [3];

    // Create the normal attributes if requested
    let normalAttributes: Array<number> = [];
    if (normals) {
        if (sharedVertices) {
            for (let i = 0; i < positionAttributes.length; i += 3) {
                normalAttributes.push(...vec3.normalize([positionAttributes[i], positionAttributes[i + 1], positionAttributes[i + 2]]));
            }
        }
        else {
            normalAttributes = [
                repeat([0, 0, 1], 4),   // front
                repeat([0, 0, -1], 4),  // back
                repeat([0, 1, 0], 4),   // top
                repeat([0, -1, 0], 4),  // bottom
                repeat([1, 0, 0], 4),   // right
                repeat([-1, 0, 0], 4),  // left
            ].flat();
        }

        // Add the normal attributes to the interleaved arrays.
        interleavedArrays.push(normalAttributes);
        interleavedWidths.push(3);
    }

    // Create the UV attributes if requested
    let uvAttributes: Array<number> = [];
    if (texCoords) {
        if (sharedVertices) {
            // TODO: implement UVs for boxes with shared vertices
            throwError(() => "UVs are not yet supported for boxes with shared vertices.");
        }
        else {
            uvAttributes = repeat([
                0, 0, // bottom left
                1, 0, // bottom right
                1, 1, // top right
                0, 1, // top left
            ], 6);
        }

        // Add the UV attributes to the interleaved arrays.
        interleavedArrays.push(uvAttributes);
        interleavedWidths.push(2);
    }

    return interleaveArrays(interleavedArrays, interleavedWidths);
}

/**
 * Creates indices for a box with the given options.
 * @param sharedVertices Whether or not to share vertices. Defaults to false.
 * @returns
 */
function createBoxIndices(sharedVertices: boolean = false)
{
    return sharedVertices ? [
        4, 5, 6, 4, 6, 7, // front
        1, 0, 3, 1, 3, 2, // back
        7, 6, 2, 7, 2, 3, // top
        0, 1, 5, 0, 5, 4, // bottom
        5, 1, 2, 5, 2, 6, // right
        0, 4, 7, 0, 7, 3, // left
    ] : [
        0, 1, 2, 0, 2, 3,       // front
        4, 5, 6, 4, 6, 7,       // back
        8, 9, 10, 8, 10, 11,    // top
        12, 13, 14, 12, 14, 15, // bottom
        16, 17, 18, 16, 18, 19, // right
        20, 21, 22, 20, 22, 23, // left
    ];
}


/**
 * Creates a skybox of unit size around the origin with shared vertices.
 */
function createSkyBoxAttributes() // TODO: is the createSkybox now obsolete?
{
    return [
        -1, -1, -1, // 0
        +1, -1, -1, // 1
        +1, +1, -1, // 2
        -1, +1, -1, // 3
        -1, -1, +1, // 4
        +1, -1, +1, // 5
        +1, +1, +1, // 6
        -1, +1, +1, // 7
    ];
}

/**
 * Creates indices for a skybox.
 */
function createSkyBoxIndices()
{
    return [
        4, 5, 6, 4, 6, 7, // front
        1, 0, 3, 1, 3, 2, // back
        7, 6, 2, 7, 2, 3, // top
        0, 1, 5, 0, 5, 4, // bottom
        5, 1, 2, 5, 2, 6, // right
        0, 4, 7, 0, 7, 3, // left
    ];
}

// TODO: spheres with longitude bands < 8 are broken?

/** Creates a sphere around the origin with the given options.
 * @param radius The radius of the sphere.
 * @param latitudeBands The number of bands around the sphere from top to bottom.
 * @param longitudeBands The number of bands around the sphere from left to right.
 * @param options Options to control which vertex attributes to create.
 * @returns An array of interleaved vertex data.
 */
function createSphereAttributes(
    radius: number, latitudeBands: number, longitudeBands: number, options: {
        normals?: boolean,
        uvs?: boolean,
    } = {}): Array<number>
{
    // Create values for all arrays of the sphere.
    // They are easier to create and then discard if unused.
    const positions: number[] = [];
    const normals: number[] = [];
    const texCoords: number[] = [];
    for (let lat = 0; lat <= latitudeBands; lat++) {
        const theta = lat * Math.PI / latitudeBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= longitudeBands; lon++) {
            const phi = lon * 2 * Math.PI / longitudeBands;

            const x = Math.cos(phi) * sinTheta;
            const y = cosTheta;
            const z = Math.sin(phi) * sinTheta;
            const u = 1. - (lon / longitudeBands);
            const v = 1. - (lat / latitudeBands);

            positions.push(radius * x, radius * y, radius * z);
            normals.push(x, y, z);
            texCoords.push(u, v);
        }
    }

    // Create the interleaved vertex array.
    const interleaved: Array<Array<number>> = [positions];
    const quantities: Array<number> = [3];
    if (options.normals ?? true) {
        interleaved.push(normals);
        quantities.push(3);
    }
    if (options.uvs ?? true) {
        interleaved.push(texCoords);
        quantities.push(2);
    }
    return interleaveArrays(interleaved, quantities);
}

/**
 * Create indices for a sphere with the given options.
 * @param latitudeBands The number of bands around the sphere from top to bottom.
 * @param longitudeBands The number of bands around the sphere from left to right.
 * @returns The indices of the sphere.
 */
function createSphereIndices(latitudeBands: number, longitudeBands: number)
{
    const buffer = [];
    for (let lat = 0; lat < latitudeBands; lat++) {
        for (let lon = 0; lon < longitudeBands; lon++) {
            const first = lat * (longitudeBands + 1) + lon;
            const second = first + longitudeBands + 1;
            buffer.push(first, first + 1, second);
            buffer.push(second, first + 1, second + 1);
        }
    }
    return buffer;
}

// TODO: enable/disable attributes for torus knot
function createTorusKnotAttributes(radius: number = 1, tube: number = 0.4, tubularSegments: number = 64, radialSegments: number = 8, p: number = 2, q: number = 3)
{
    // Ensure segments are integers.
    tubularSegments = Math.floor(tubularSegments);
    radialSegments = Math.floor(radialSegments);

    // buffers
    const buffer = [];

    // This function calculates the current position on the torus curve.
    const calculatePositionOnCurve = (u: number, p: number, q: number, radius: number, position: Vec3) =>
    {
        const cu = Math.cos(u);
        const su = Math.sin(u);
        const quOverP = q / p * u;
        const cs = Math.cos(quOverP);

        position[0] = radius * (2 + cs) * 0.5 * cu;
        position[1] = radius * (2 + cs) * su * 0.5;
        position[2] = radius * Math.sin(quOverP) * 0.5;
    };

    // helper variables
    const vertex = vec3.zero();
    const P1 = vec3.zero();
    let B = vec3.zero();
    let T = vec3.zero();
    let N = vec3.zero();

    // generate vertices, normals and uvs
    for (let i = 0; i <= tubularSegments; ++i) {

        // the radian "u" is used to calculate the position on the torus curve of the current tubular segment
        const u = i / tubularSegments * p * Math.PI * 2;

        // now we calculate two points. P1 is our current position on the curve, P2 is a little farther ahead.
        // these points are used to create a special "coordinate space", which is necessary to calculate the correct vertex positions
        calculatePositionOnCurve(u, p, q, radius, P1);
        calculatePositionOnCurve(u + 0.01, p, q, radius, N);

        // calculate orthonormal basis
        vec3.subtract(vec3.copy(T, N), P1);
        vec3.cross(vec3.copy(B, T), N);
        vec3.cross(vec3.copy(N, B), T);

        // normalize B and N. T can be ignored, we don't use it
        vec3.normalize(B);
        vec3.normalize(N);

        for (let j = 0; j <= radialSegments; ++j) {

            // now calculate the vertices. they are nothing more than an extrusion of the torus curve.
            // because we extrude a shape in the xy-plane, there is no need to calculate a z-value.
            const v = j / radialSegments * Math.PI * 2;
            const cx = - tube * Math.cos(v);
            const cy = tube * Math.sin(v);

            // now calculate the final vertex position.
            // first we orient the extrusion with our basis vectors, then we add it to the current position on the curve
            vertex[0] = P1[0] + (cx * N[0] + cy * B[0]);
            vertex[1] = P1[1] + (cx * N[1] + cy * B[1]);
            vertex[2] = P1[2] + (cx * N[2] + cy * B[2]);
            buffer.push(vertex[0], vertex[1], vertex[2]);

            // normal (P1 is always the center/origin of the extrusion, thus we can use it to calculate the normal)
            vec3.subtract(vertex, P1);
            vec3.normalize(vertex);
            buffer.push(vertex[0], vertex[1], vertex[2]);

            // uv
            buffer.push(i / tubularSegments);
            buffer.push(j / radialSegments);
        }
    }
    return buffer;
}

function createTorusKnotIndices(tubularSegments = 64, radialSegments = 8)
{
    const indices = [];
    for (let tubeIdx = 1; tubeIdx <= tubularSegments; tubeIdx++) {
        for (let radIdx = 1; radIdx <= radialSegments; radIdx++) {
            const a = (radialSegments + 1) * (tubeIdx - 1) + (radIdx - 1);
            const b = (radialSegments + 1) * tubeIdx + (radIdx - 1);
            const c = (radialSegments + 1) * tubeIdx + radIdx;
            const d = (radialSegments + 1) * (tubeIdx - 1) + radIdx;
            indices.push(
                a, b, d,
                b, c, d
            );
        }
    }
    return indices;
}

/**
 * Create 2D-position and texcoord attributes for a fullscreen quad.
 */
function createQuadAttributes()
{
    return [
        -1, -1, 0, 0,
        -1, +1, 0, 1,
        +1, +1, 1, 1,
        +1, -1, 1, 0,
    ];
}

/**
 * Create indices for a fullscreen quad.
 */
function createQuadIndices()
{
    return [
        0, 1, 2,
        0, 2, 3,
    ];
}


// =============================================================================
// OBJ loading
// =============================================================================


/**
 * The raw data loaded from an OBJ file.
 * In order to resolve it into an attribute buffer, we need to expand it first
 * using the `expandObj` function.
 */
type ObjData = {
    /** Name of the object */
    name: string;

    /** 3D vertex positions */
    positions: number[];

    /** 2D texture coordinates */
    texCoords: number[];

    /** 3D vertex normals */
    normals: number[];

    /** Face indices as [position, texcoord, normal] */
    splitIndices: [number, number, number][];
};


/**
 * Load and parse an OBJ file into a raw `ObjData` object.
 * For now, we only support OBJ files with a single object as exported by Blender,
 * with 3-D positions, 2-D UV coordiantes, normals and triangulated faces.
 * @param text The text contents of the OBJ file.
 * @returns A promise that resolves to the parsed OBJ data.
 */
function parseObj(text: string): ObjData
{
    // Ignore comments, materials, groups, lines and smooth shading
    const ignoredLines: Set<string> = new Set(["#", "mtllib", "usemtl", "g", "l", "s", ""]);

    // Parse the OBJ contents
    let name: string | undefined = undefined;
    const positions: ObjData["positions"] = [];
    const splitIndices: ObjData["splitIndices"] = [];
    const normals: ObjData["normals"] = [];
    const texCoords: ObjData["texCoords"] = [];
    const lines = text.split("\n");
    for (const [index, line] of lines.entries()) {
        const tokens = line.split(" ");
        const type = tokens[0];

        if (ignoredLines.has(type)) {
            continue;
        }
        else if (type === "o") {
            if (name === undefined) {
                name = tokens[1];
            }
            else {
                throwError(() => `Multiple object names defined in OBJ file (on line ${index})`);
            }
        }
        else if (type === "v") {
            positions.push(
                parseFloat(tokens[1]),
                parseFloat(tokens[2]),
                parseFloat(tokens[3]),
            );
        }
        else if (type === "vn") {
            normals.push(
                parseFloat(tokens[1]),
                parseFloat(tokens[2]),
                parseFloat(tokens[3]),
            );
        }
        else if (type === "vt") {
            texCoords.push(
                parseFloat(tokens[1]),
                parseFloat(tokens[2]),
            );
        }
        else if (type === "f") {
            for (let i = 1; i <= 3; i++) {
                const face = tokens[i].split("/");
                splitIndices.push([
                    parseInt(face[0]) - 1, // position
                    parseInt(face[1]) - 1, // tex coord
                    parseInt(face[2]) - 1, // normal
                ]);
            }
        }
        else {
            logWarning(() => `Unexpected OBJ token: '${type}' on line ${index}`);
        }
    }
    if (name === undefined) {
        throwError(() => "No object name defined in OBJ file");
    }

    return {
        name,
        positions,
        texCoords,
        normals,
        splitIndices,
    };
}

/**
 * Takes a raw OBJ data object and creates an attribute, and index buffer from it.
 * @param objData OBJ data to expand.
 * @returns [Attributes, Indices]
 */
function expandObj(objData: ObjData): [Array<number>, Array<number>]
{
    let positions: number[] = [];
    let texCoords: number[] = [];
    let normals: number[] = [];
    let indices: number[] = [];

    // Expand the raw OBJ data into arrays of vertex attributes and indices.
    let vertIdx = 0;
    const knownIndices: Map<string, number> = new Map();
    for (const splitIndex of objData.splitIndices) {
        const vertexKey = splitIndex.join("|");

        // Detect duplicate vertices
        const existingVertex = knownIndices.get(vertexKey);
        if (existingVertex !== undefined) {
            indices.push(existingVertex);
            continue;
        }
        const [posIdx, uvIdx, normIdx] = splitIndex;

        // Create a new vertex
        const positionIndex = posIdx * 3;
        positions.push(...objData.positions.slice(positionIndex, positionIndex + 3));

        const uvIndex = uvIdx * 2;
        texCoords.push(...objData.texCoords.slice(uvIndex, uvIndex + 2));

        const normalIndex = normIdx * 3;
        normals.push(...objData.normals.slice(normalIndex, normalIndex + 3));

        indices.push(vertIdx);
        knownIndices.set(vertexKey, vertIdx);
        vertIdx++;
    }

    // Interleave the vertex attributes.
    const attributes = interleaveArrays(
        [positions, texCoords, normals],
        [3, 2, 3],
    );

    return [attributes, indices];
}


/**
 * Data buffers loaded from an OBJ file.
 */
type LoadedObj = {
    /** Name of the object as loaded from the OBJ file */
    name: string;

    /** Attribute buffer with [position(3), texcoord(2), normal(3)] */
    attributes: number[];

    /** Index buffer */
    indices: number[];
};
// TODO: maybe the idea of returning a single object with attributes and indices would be a good idea for _all_ geo functions?

/**
 * Load an OBJ file and return the vertex attributes and indices.
 * The attributes are interleaved as [position(3), texcoord(2), normal(3)].
 * @param path Location of the OBJ file.
 * @returns [Attributes, Indices]
 */
async function loadObj(path: string): Promise<LoadedObj>
{
    // Load the OBJ file
    const response = await fetch(path);
    const text = await response.text();

    // Parse the OBJ file
    const objData = parseObj(text);

    // Expand the OBJ data
    const [attributes, indices] = expandObj(objData);
    return {
        name: objData.name,
        attributes,
        indices,
    };
}


// =============================================================================
// Private Functions
// =============================================================================


/** Creates a new array with the given pattern repeated the given number of times. */
function repeat(pattern: any[], times: number): any[]
{
    return Array.from({ length: times }, () => pattern).flat();
}


/** Interleave the given arrays, taking a number of elements (quantity) from each array in turn.
 * @param arrays An array of arrays to interleave.
 * @param quantities Either an array of quantities to take from each array,
 * or a single quantity to take from each array. Defaults to 1.
 * @returns A new array with the interleaved values.
 */
function interleaveArrays(arrays: any[][], quantities: number | number[] = 1): any[]
{
    // Ensure that all arrays are the same size.
    if (arrays.length === 0) {
        return [];
    }

    // If there is only one array, return it.
    if (arrays.length === 1) {
        return arrays[0];
    }

    // Ensure that quantities is an array of the correct size.
    if (!Array.isArray(quantities)) {
        quantities = repeat([quantities], arrays.length);
    } else if (quantities.length !== arrays.length) {
        throwError(() => `'quantities' must be either a number or an array with the same length as 'arrays'.\n` +
            `    'quantities' length: ${(quantities as number[]).length}\n` +
            `    'arrays' length: ${arrays.length}`
        );
    }

    // Ensure that the every quantity is valid.
    const bandCount = arrays[0].length / quantities[0];
    for (let i = 0; i < arrays.length; i++) {
        const quantity = quantities[i];
        if (quantity < 1) {
            throwError(() => `'quantity' must be greater than 0, but the value at index ${i} is ${quantity}`);
        }
        if (quantity % 1 !== 0) {
            throwError(() => `'quantity' must be an integer, but the value at index ${i} is ${quantity}`);
        }
        if (arrays[i].length % quantity !== 0) {
            throwError(() => `The length of the corresponding array must be a multiple of 'quantity'\n` +
                `    but the quantity at index ${i} is ${quantity}\n` +
                `    whereas the length of the corresponding array is ${arrays[i].length}`
            );
        }
        if (arrays[i].length / quantity !== bandCount) {
            throwError(() => `All arrays must have the same number of quantities,\n` +
                `    but array ${i} of size ${arrays[i].length} contains ${arrays[i].length / quantity} times ${quantity} quantities,\n` +
                `    whereas the first array conttains ${arrays[0].length / quantity} times ${(quantities as number[])[0]} quantities.`
            );
        }
    }

    // Interleave the arrays.
    const interleaved: any[] = [];
    for (let band = 0; band < bandCount; band++) {
        for (let arrayIndex = 0; arrayIndex < arrays.length; arrayIndex++) {
            const array = arrays[arrayIndex];
            const quantity = quantities[arrayIndex];
            interleaved.push(...array.slice(band * quantity, (band + 1) * quantity));
        }
    }

    return interleaved;
}
