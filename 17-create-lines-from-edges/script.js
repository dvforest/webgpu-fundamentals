import { Polygon, Vector2 } from "./classes.js";

function createVertices(polygon, lineWidth = 1){
    const vertexData = new Float32Array(polygon.edges.length * 4 * 2); // 4 vertices per edge, 2 coordinates per vertex
    let ndx = 0;

    for( let i = 0; i < polygon.edges.length; i++){        
        // Find normal
        const edge = polygon.edges[i];
        const vector = new Vector2(edge.vertex2.x - edge.vertex1.x, edge.vertex2.y - edge.vertex1.y);
        const angle = Math.acos(vector.x / vector.magnitude()); // find edge's angle in radians
        const normal = angle + Math.PI / 2; // add 90 degrees in radians
        

        // Create scaled vector using normal
        const scaledVector = new Vector2(
            lineWidth * 0.5 * Math.cos(normal), // x
            lineWidth * 0.5 * Math.sin(normal) * (Math.sign(vector.y) < 0 ? -1: 1) // y (check if flipped)
        );

        // First vertex
        vertexData[ndx++] = edge.vertex1.x + scaledVector.x;
        vertexData[ndx++] = edge.vertex1.y + scaledVector.y;

        // Second vertex
        vertexData[ndx++] = edge.vertex1.x - scaledVector.x;
        vertexData[ndx++] = edge.vertex1.y - scaledVector.y;

        // Third vertex
        vertexData[ndx++] = edge.vertex2.x + scaledVector.x;
        vertexData[ndx++] = edge.vertex2.y + scaledVector.y;

        // Fourth vertex
        vertexData[ndx++] = edge.vertex2.x - scaledVector.x;
        vertexData[ndx++] = edge.vertex2.y - scaledVector.y;
    }

    const indexData = new Uint32Array(polygon.edges.length * 3 * 2); // 2 triangles per edge, 3 vertices per triangle
    let offset = 0;

    for (let i = 0; i < indexData.length;) {
        indexData[i++] = 0 + offset;
        indexData[i++] = 1 + offset;
        indexData[i++] = 2 + offset;
        indexData[i++] = 2 + offset;
        indexData[i++] = 1 + offset;
        indexData[i++] = 3 + offset;
        offset += 4;
    }

    // Offset
    for (let i = 0; i < vertexData.length;){
        let xOffset = 400;
        let yOffset = 300;
        vertexData[i++] += xOffset;
        vertexData[i++] += yOffset;
    }

    console.log(vertexData.length);

    return {
        indexData, vertexData
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
        label: "Wireframe",
        code: `
            struct Uniforms {
                resolution: vec2f,
            }

            struct VSOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @group(0) @binding(0) var<uniform> uni: Uniforms; 

            @vertex fn vs(
                @location(0) position: vec2f,
            ) -> VSOutput {
                var vsOut: VSOutput;
                
                // convert from pixel space to 0 <-> 1
                let zeroToOne = position / uni.resolution;

                // convert to 0 <-> 2
                let zeroToTwo = zeroToOne * 2;

                // convert to -1 <-> +1
                let flipped = zeroToTwo - 1;

                // flip y
                let clipSpace = flipped * vec2f(1, -1);

                vsOut.position = vec4f(clipSpace, 0, 1);
                vsOut.color = vec4f(0, 0, 0, 1);
                return vsOut;
            }

            @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                return vsOut.color;
            }
        `,
    });

    // Render pipeline
    const pipeline = device.createRenderPipeline({
        label: "render pipeline",
        layout: "auto",
        vertex:{
            module,
            entryPoint: "vs",
            buffers: [
                {
                    arrayStride: 2 * 4,
                    attributes: [
                        {shaderLocation: 0, offset: 0, format: "float32x2"},
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

    // Data for buffers
    const polygon = new Polygon(20, 100);
    const {vertexData, indexData} = createVertices(polygon);
    
    // Create empty buffers and copy data
    const vertexBuffer = device.createBuffer({
        label: "Vertex Buffer",
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertexData);
    const indexBuffer = device.createBuffer({
        label: "Index Buffer",
        size : indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(indexBuffer, 0, indexData);

    // Uniform buffer.
    // Contains Resolution array view which is set at render time.
    const uniformBufferSize = 2 * 4;
    const uniformBuffer = device.createBuffer({
        label: "Uniform Buffer",
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const uniformValues = new Float32Array(uniformBufferSize / 4);
    const resolution = uniformValues.subarray(0, 2);

    // Bind Groups
    const bindGroup = device.createBindGroup({
        label: "Bind Group",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
        { binding: 0, resource: { buffer: uniformBuffer }},
        ],  
    });

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
        pass.setBindGroup(0, bindGroup);

        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, "uint32");
        
        resolution.set([canvas.width, canvas.height]);
        device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
        
        pass.drawIndexed(indexData.length);
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