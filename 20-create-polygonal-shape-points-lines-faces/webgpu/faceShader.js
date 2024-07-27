
function createVertices(polygon) {
    
    const vertexData = new Float32Array(polygon.vertices.length * 2); // 2 coordinates per vertex
    for( let i = 0; i < polygon.vertices.length; i++){        
        const vertex = polygon.vertices[i];
        vertexData[i * 2] = vertex.x;
        vertexData[i * 2 + 1] = vertex.y;
    }

    // Offset
    for (let i = 0; i < vertexData.length;){
        let xOffset = 400;
        let yOffset = 300;
        vertexData[i++] += xOffset;
        vertexData[i++] += yOffset;
    }

    const indexData = new Uint32Array(polygon.faces.length * 3); // 3 triangles per face
    for (let i = 0; i < polygon.faces.length; i++){
        const face = polygon.faces[i];
        const vertex1 = face.vertex1;
        const vertex2 = face.vertex2;
        const vertex3 = face.vertex3;
        
        const vert = polygon.vertices 
        const index1 = vert.indexOf(vertex1);
        const index2 = vert.indexOf(vertex2);
        const index3 = vert.indexOf(vertex3);

        indexData[i * 3] = index1;
        indexData[i * 3 + 1] = index2;
        indexData[i * 3 + 2] = index3;
    }

    return {
        vertexData,
        indexData,
    };
}

async function faceShader(device, canvas, context, canvasFormat, polygon){

    // Shader module
    const module = device.createShaderModule({
        label: "Simple polygonal shape",
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
                vsOut.color = vec4f(0.5, 0.5, 0.5, 1);
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
export { faceShader };