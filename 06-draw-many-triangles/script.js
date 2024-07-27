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
        label: "triangle shader with uniforms",
        code: `
            struct OurStruct {
                color: vec4f,
                scale: vec2f,
                offset: vec2f,
            };

            @group(0) @binding(0) var<uniform> ourStruct: OurStruct;

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {

                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );

                return vec4f(
                    pos[vertexIndex] * ourStruct.scale + ourStruct.offset, 0, 1
                );
            }

            @fragment fn fs() -> @location(0) vec4f {
                return ourStruct.color;
            }
        `,
    });

    // Render pipeline
    const pipeline = device.createRenderPipeline({
        label: "triangle with uniform pipeline",
        layout: "auto", // no layout data for now
        vertex:{
            module,
            entryPoint: "vs",
        },
        fragment:{
            module,
            entryPoint: "fs",
            targets: [{ format:canvasFormat }], // the texture we render to
        },
    });

    // Variables for our buffer
    const uniformBufferSize = 
    4 * 4 + // color is 4 32bit floats (4 bytes each)
    2 * 4 + // scale is 2 32bit floats (4 bytes each)
    2 * 4;  // offset is 2 32bit floats (4 bytes each)
    const kNumObjects = 400;
    const objectInfos = []; // Each entry will be a dictionnary
    const kColorOffset = 0; // All the offsets are in float32 indices!
    const kScaleOffset = 4; // This means you have to multiply by 4 (bytes)
    const kOffsetOffset = 6; // if you want the buffer offset

    // Create multiple buffers (one for each triangle)
    for (let i = 0; i < kNumObjects; ++i){
        
        // Buffer
        const uniformBuffer = device.createBuffer({
            label: `uniforms for obj ${i}`,
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Values
        const uniformValues = new Float32Array(uniformBufferSize / 4); // Divide by 4 bytes to get array length
        uniformValues.set([rand(), rand(), rand(), 1], kColorOffset); // We set the values in the single array using the offsets 
        uniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset);
        
        // Bind group
        const bindGroup = device.createBindGroup({
            label: `bind group for obj ${i}`,
            layout: pipeline.getBindGroupLayout(0),
            entries : [
                {binding: 0, resource: { buffer: uniformBuffer }},
            ]
        });

        // Object infos
        objectInfos.push({
            scale: rand(0.2, 0.2),
            uniformBuffer,
            uniformValues,
            bindGroup,
        });
    }

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

        const aspect = canvas.width / canvas.height;
        
        // Set values for each entry of objectInfos and call the vertex shader 3 times
        for (const {scale, bindGroup, uniformBuffer, uniformValues} of objectInfos){
            uniformValues.set([scale / aspect, scale], kScaleOffset);
            device.queue.writeBuffer(uniformBuffer, 0, uniformValues);
            pass.setBindGroup(0, bindGroup);
            pass.draw(3);
        }

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