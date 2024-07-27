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
        label: "triangle shader with 2 structs",
        code: `
            struct OurStruct {
                color: vec4f,
                offset: vec2f,
            };

            struct OtherStruct {
                scale: vec2f,
            }

            @group(0) @binding(0) var<uniform> ourStruct: OurStruct;
            @group(0) @binding(1) var<uniform> otherStruct: OtherStruct;

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {

                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );

                return vec4f(
                    pos[vertexIndex] * otherStruct.scale + ourStruct.offset, 0, 1
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
    const staticUniformBufferSize = 
    4 * 4 + // color is 4 32bit floats (4 bytes each)
    2 * 4 + // offset is 2 32bit floats (4 bytes each)
    2 * 4;  // padding
    // In this version (2 Structs), we have a uniform that is set once with color and offset
    // The scale changes every time we change the canvas size, so we place it in a second buffer for optimization
    const uniformBufferSize = 
    2 * 4; // scale is 2 32bit floats (4 bytes each)
    const kNumObjects = 400;
    const objectInfos = []; // Each entry in this array will be a dictionnary
    const kColorOffset = 0; // All the offsets are in float32 indices!
    const kOffsetOffset = 4; // This means you have to multiply by 4 (bytes) if you want the buffer offset
    
    const kScaleOffset = 0; // In this version using 2 Structs, the scale has zero offset because it is contained in another uniform
    

    // Create multiple buffers (one for each triangle)
    for (let i = 0; i < kNumObjects; ++i){
        
        // Static Buffer
        const staticUniformBuffer = device.createBuffer({
            label: `static uniforms for obj ${i}`,
            size: staticUniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Values (Static Uniform)
        const staticUniformValues = new Float32Array(staticUniformBufferSize / 4); // Divide by 4 bytes to get array length
        staticUniformValues.set([rand(), rand(), rand(), 1], kColorOffset); // We set the values in the single array using the offsets 
        staticUniformValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], kOffsetOffset);
        device.queue.writeBuffer(staticUniformBuffer, 0, staticUniformValues); // In this version we write the buffers right away, since they don't depend on the canvas aspect ratio.

        // Values (Scale)
        const uniformValues = new Float32Array(uniformBufferSize / 4); // We can overwrite the array, because it has already been written to the GPU Buffer
        
        // Scale Buffer
        const uniformBuffer = device.createBuffer({
            label: `changing uniforms for obj ${i}`,
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Bind group
        const bindGroup = device.createBindGroup({
            label: `bind group for obj ${i}`,
            layout: pipeline.getBindGroupLayout(0),
            entries : [
                {binding: 0, resource: { buffer: staticUniformBuffer }},
                {binding: 1, resource: { buffer: uniformBuffer }},
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