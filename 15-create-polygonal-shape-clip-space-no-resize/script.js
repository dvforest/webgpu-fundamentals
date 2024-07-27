function createVertices() {
    const vertexData = new Float32Array([
        0, 0.3,
        0.1, 0,
        0.4, 0.1,
        0.3, 0,
        0.4, 0.2,
        0.5, 0.1
    ]);

    const indexData = new Uint32Array([
        0, 1, 2,
        2, 1, 3,
        3, 4, 2,
        2, 4, 5
    ]);

    return {
        vertexData,
        indexData,
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
        label: "Simple polygonal shape",
        code: `
            struct VSOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @vertex fn vs(
                @location(0) position: vec2f,
            ) -> VSOutput {
                var vsOut: VSOutput;
                vsOut.position = vec4f(position, 0, 1);
                vsOut.color = vec4f(1, 1, 1, 1);
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
    const {vertexData, indexData} = createVertices();
    
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
        pass.setVertexBuffer(0, vertexBuffer);
        pass.setIndexBuffer(indexBuffer, "uint32");
        const aspect = canvas.width / canvas.height;
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