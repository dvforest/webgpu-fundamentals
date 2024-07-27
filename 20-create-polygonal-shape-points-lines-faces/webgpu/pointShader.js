
function createVertices(polygon, pointWidth = 4){ // a square
    const vertexData = new Float32Array([
        pointWidth / -2, pointWidth / 2,
        pointWidth / 2, pointWidth / 2,
        pointWidth / -2, pointWidth / -2,
        pointWidth / 2, pointWidth / -2
    ]);

    const indexData = new Uint32Array([0, 1, 2, 2, 3, 1]);

    const instanceData = new Float32Array(polygon.vertices.length * 2); // 2 coordinates per vertex
    for( let i = 0; i < polygon.vertices.length; i++){        
        const vertex = polygon.vertices[i];
        instanceData[i * 2] = vertex.x;
        instanceData[i * 2 + 1] = vertex.y;
    }

    // Offset
    for (let i = 0; i < vertexData.length;){
        let xOffset = 400;
        let yOffset = 300;
        vertexData[i++] += xOffset;
        vertexData[i++] += yOffset;
    }

    return {
        vertexData, indexData, instanceData
    };
}

async function pointShader(device, canvas, context, canvasFormat, polygon){

    // Shader module
    const module = device.createShaderModule({
        label: "Points",
        code: `
            struct Uniforms {
                resolution: vec2f
            }

            struct VSOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @group(0) @binding(0) var<uniform> uni: Uniforms; 

            @vertex fn vs(
                @location(0) position: vec2f,
                @location(1) offset: vec2f,
                @builtin(instance_index) index: u32
            ) -> VSOutput {
                var vsOut: VSOutput;

                // offset to current instance position
                let offsetPos = position + offset;
                
                // convert from pixel space to 0 <-> 1
                let zeroToOne = offsetPos / uni.resolution;

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
                {
                    arrayStride: 2 * 4,
                    stepMode: "instance",
                    attributes: [
                        {shaderLocation: 1, offset: 0, format: "float32x2"},
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
    const {vertexData, indexData, instanceData} = createVertices(polygon);
    
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
    
    const instanceBuffer = device.createBuffer({
        label: "Instance Buffer",
        size: instanceData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(instanceBuffer, 0, instanceData);

    // Uniform buffers
    // Contains Resolution array view which is set at render time.
    const uniformBufferSize = 2 * 4;
    const uniformBuffer = device.createBuffer({
        label: "Uniform Buffer",
        size:   uniformBufferSize,
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

    // Render Pass
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            loadOp: "load",
            clearValue: [0, 0, 0, 0],
            storeOp: "store",
        }]
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);

    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, instanceBuffer);
    pass.setIndexBuffer(indexBuffer, "uint32");
    
    resolution.set([canvas.width, canvas.height]);
    device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
    
    pass.drawIndexed(indexData.length, instanceData.length / 2); // draw 2 triangles, once for each point in instanceData
    pass.end();
    device.queue.submit( [encoder.finish()] );

}
export { pointShader };