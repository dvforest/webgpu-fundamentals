// Rand function
const rand = (min, max) => {
    if (min == undefined){
        min = 0;
        max = 1;
    } else if (min == undefined){
        max = min;
        min = 0;
    } 
        return min + Math.random() * (max - min);
};

// Circle function
// The function is declared with a single parameter: an object {}
// The part at the end with = {} means the function will not throw an error if no object is provided
// Each variable of the object is declared with a default value if none is provided (radius = 1).
// You can call this function by passing a new object containing only the arguments you need, for example:
//      createCircleVertices({
//            radius: 5,
//            numSubdivisions: 10,
//      })
function createCircleVertices({
    radius = 1,
    numSubdivisions = 24,
    innerRadius = 0,
    startAngle = 0,
    endAngle = Math.PI * 2,
    } = {}) {
        // 2 vertices per subdivisions + 1 to wrap around the circle (here we don't reuse the first and last vertices)
        const numVertices = (numSubdivisions + 1) * 2;
        const vertexData = new Float32Array(numVertices * (2 + 1)); // 2 f32 for position + 1 f32 for color (will be read as 4 8-bit values)
        const colorData = new Uint8Array(vertexData.buffer); // create a 8-bit view of the same array

        let offset = 0;
        let colorOffset = 8; // skip 8 bytes (the first position data)
        const addVertex = (x, y, r, g, b) => {
            vertexData[offset++] = x;
            vertexData[offset++] = y;
            offset += 1; // skip the color (4 bytes)
            colorData[colorOffset++] = r * 255; // 1 byte
            colorData[colorOffset++] = g * 255; // 1 byte
            colorData[colorOffset++] = b * 255; // 1 byte
            colorOffset += 9; // skip extra byte and the position
        };

        const innerColor = [1, 1, 1];
        const outerColor = [0.1, 0.1, 0.1];

        // 2 triangles per subdivision
        //
        // 0  2  4  6  8 ...
        //
        // 1  3  5  7  9 ...

        for (let i = 0; i <= numSubdivisions; i++) { // we use <= here to count the extra subdivision we used above so that the circle wraps           
            const angle = startAngle + (i + 0) * (endAngle - startAngle) / numSubdivisions;
            
            const c1 = Math.cos(angle);
            const s1 = Math.sin(angle);

            // First triangle
            addVertex(c1 * radius, s1 * radius, ...outerColor); // triple dots is a spread operator which will expand the array values into three arguments
            addVertex(c1 * innerRadius, s1 * innerRadius, ...innerColor);
        }

        const indexData = new Uint32Array(numSubdivisions * 6); // Holds the total number of vertex index. 2 triangle per subdivision with 3 vertices index each
        let ndx = 0;

        // 0---2---4---...
        // | //| //|
        // |// |// |//
        // 1---3-- 5---...

        for (let i = 0; i < numSubdivisions; ++i) {
            const ndxOffset = i * 2;

            // First triangle
            indexData[ndx++] = ndxOffset;
            indexData[ndx++] = ndxOffset + 1;
            indexData[ndx++] = ndxOffset + 2;

            // Second triangle
            indexData[ndx++] = ndxOffset + 2;
            indexData[ndx++] = ndxOffset + 1;
            indexData[ndx++] = ndxOffset + 3;
        }

        return {
            vertexData,
            indexData,
            numVertices : indexData.length,
        };
    }  

async function main(){

    // Get GPU device.
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
        alert("Need a browser that supports WebGPU");
        return;
    }

    // Configure canvas
    const canvas = document.querySelector("canvas");
    const context = canvas.getContext("webgpu");
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device,
        format: canvasFormat,
    });

    // Shader module
    const module = device.createShaderModule({
        label: "triangle shader with vertex buffers",
        code: `
            struct VSOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @vertex fn vs(
                @location(0) position: vec2f,
                @location(1) color: vec4f,
                @location(2) offset: vec2f,
                @location(3) scale: vec2f,
                @location(4) perVertexColor: vec3f,
                @builtin(instance_index) instanceIndex: u32
            ) -> VSOutput {

                var vsOut: VSOutput;
                vsOut.position = vec4f(
                    position * scale + offset, 0, 1);
                vsOut.color = color * vec4f(perVertexColor, 1);
                return vsOut;
            }

            @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                return vsOut.color;
            }
        `,
    }); // here above, we moved all the location(1), location(2) variable declarations to the fn vs(arguments). If you check previous versions, you can see it's also possible to make a struct called Vertex, put the variable declarations there, and only declared vert: Vertex in the fn vs(arguments). You can then access the values inside the function by using vert.position, vert.color etc

    // Render pipeline
    const pipeline = device.createRenderPipeline({
        label: "triangle with uniform pipeline",
        layout: "auto", // no layout data for now
        vertex:{
            module,
            entryPoint: "vs",
            buffers: [
                {
                    arrayStride: 2 * 4 + 4, // 2 floats, 4 bytes each + 4 bytes for color
                    attributes: [
                        {shaderLocation: 0, offset: 0, format: 'float32x2'}, // vertex position 
                        {shaderLocation: 4, offset: 8, format: 'unorm8x4'}, // perVertex color
                    ],
                },
                {
                    arrayStride: 4 + 2 * 4, // 4 bytes for color + 2 floats, 4 bytes each
                    stepMode: "instance", // default is vertex. instance means it will only advance to next value once per instance (triangle)
                    attributes: [
                        {shaderLocation: 1, offset: 0, format: 'unorm8x4'}, // color
                        {shaderLocation: 2, offset: 4, format: 'float32x2'}, // offset
                    ],
                },
                {
                    arrayStride: 2 * 4, // 2 floats, 4 bytes each
                    stepMode: "instance",
                    attributes: [
                        {shaderLocation: 3, offset: 0, format: 'float32x2'}, // scale
                    ],
                },
            ],
        },
        fragment:{
            module,
            entryPoint: "fs",
            targets: [{ format:canvasFormat }], // the texture we render to
        },
    });

    // Variables for our buffer
    const kNumObjects = 1000;
    const objectInfos = [];

    // Byte size PER TRIANGLE (vertex shader call)
    const staticUnitSize = 
    4 + // color is 4 bytes
    2 * 4; // offset is 2 32bit floats (4 bytes each). No padding required for vertex buffers
    const changingUnitSize = 
    2 * 4; // scale is 2 32bit floats (4 bytes each)

    //Buffer size (triangle byte size multiplied by number of calls)
    const staticVertexBufferSize = staticUnitSize * kNumObjects;
    const changingVertexBufferSize = changingUnitSize * kNumObjects;

    // Static Buffer
    const staticVertexBuffer = device.createBuffer({
        label: `static vertex buffer`,
        size: staticVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // Scale Buffer
    const changingVertexBuffer = device.createBuffer({
        label: `changing vertex buffer`,
        size: changingVertexBufferSize,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    
    // Offsets (in f32 indices)
    const kColorOffset = 0; 
    const kOffsetOffset = 1; // this is one-f32-length (4 bytes) because color is now 4 x 8-bits
    const kScaleOffset = 0; // scale has zero offset because it is contained in another buffer
    
    // Create a single array containing the values for all triangles 
    const staticVertexValuesU8 = new Uint8Array(staticVertexBufferSize);
    const staticVertexValuesF32 = new Float32Array(staticVertexValuesU8.buffer); // make a f32 view of the previous buffer

    // Set array values for each triangle
    for (let i = 0; i < kNumObjects; ++i){

        //Switches to the next triangle view in the array every iteration
        const staticOffsetU8 = i * staticUnitSize; // array stride between each triangle in u8 format
        const staticOffsetF32 = staticOffsetU8 / 4; // instead of using 8 bit for one value, we use 32 bits for 1 value, so the stride for the f32 view of the array is divided by 4
        
        // Values (Static)
        staticVertexValuesU8.set(
            [rand() * 255, rand() * 255, rand() * 255, 255],
            staticOffsetU8 + kColorOffset); // color

        staticVertexValuesF32.set(
            [rand(-0.9, 0.9), rand(-0.9, 0.9)],
            staticOffsetF32 + kOffsetOffset); // offset
        
        // Object infos
        objectInfos.push({
            scale: rand(0.2, 0.5), // set a default scale for now, we'll multiply it later by canvas aspect 
        });
    }

    device.queue.writeBuffer(staticVertexBuffer, 0, staticVertexValuesF32); // write the values now, they don't depend on canvas aspect    

    const vertexValues = new Float32Array(changingVertexBufferSize / 4);

    // Vertex buffer for circle with vertexData
    const { vertexData, indexData, numVertices} = createCircleVertices({
        radius: 0.5,
        innerRadius: 0.25,
    });
    const vertexBuffer = device.createBuffer({
        label: "vertex buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    const indexBuffer = device.createBuffer({
        label: "index buffer",
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indexData);

    // Render pass
    function render(){

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                loadOp: "clear",
                clearValue: [0.3, 0.3, 0.3, 1],
                storeOp: "store",
            }]
        });
        pass.setPipeline(pipeline);
        pass.setVertexBuffer(0, vertexBuffer); // Using only vertex buffers means there's no bind groups. But we do need to set each vertex buffers.
        pass.setVertexBuffer(1, staticVertexBuffer); // the number (0,1,2) corresponds to the elements of the "buffers" array in the render pipeline
        pass.setVertexBuffer(2, changingVertexBuffer);
        pass.setIndexBuffer(indexBuffer, 'uint32');

        const aspect = canvas.width / canvas.height;
    
        // Set the scale for each triangle
        objectInfos.forEach(({scale}, ndx) => { //ndx is the variable name we give for the forEach iteration index
            const offset = ndx * (changingUnitSize / 4); // array stride between each scale value
            vertexValues.set([scale / aspect, scale], offset + kScaleOffset) // set the scale in the array so we can write it to the buffer after
        })

        // Write all scale values at once
        device.queue.writeBuffer(changingVertexBuffer, 0, vertexValues);

        pass.drawIndexed(numVertices, kNumObjects); // drawIndexed can be used because we did pass.setIndexBuffer above. We call the vertex shader x number of times, where is is the number of vertices;

        pass.end();
        device.queue.submit( [encoder.finish()] );
    }

    // Observe window resizing and adjust canvas
    const observer = new ResizeObserver(entries => {
            const entry = entries[0];
            const canvas = entry.target;
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D)); // minimum 1 pixel, max device limits
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
            
            render();
    });
    observer.observe(canvas); // the function above is executed everytime the canvas is observed to change size
}
main();