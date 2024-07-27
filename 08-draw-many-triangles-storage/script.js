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
        label: "triangle shader with storage buffers",
        code: `
            struct OurStruct {
                color: vec4f,
                offset: vec2f,
            };

            struct OtherStruct {
                scale: vec2f,
            }

            struct VSOutput {
                @builtin(position) position: vec4f,
                @location(0) color: vec4f,
            }

            @group(0) @binding(0) var<storage, read> ourStructs: array<OurStruct>;
            @group(0) @binding(1) var<storage, read> otherStructs: array<OtherStruct>;

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32,
                @builtin(instance_index) instanceIndex: u32
            ) -> VSOutput {

                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );

                let otherStruct = otherStructs[instanceIndex];
                let ourStruct = ourStructs[instanceIndex];

                var vsOut: VSOutput;
                vsOut.position = vec4f(
                    pos[vertexIndex] * otherStruct.scale + ourStruct.offset, 0, 1);
                vsOut.color = ourStruct.color;
                return vsOut;
            }

            @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
                return vsOut.color;
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
    const kNumObjects = 400;
    const objectInfos = [];

    // Buffer size PER TRIANGLE (vertex shader call)
    const staticUnitSize = 
    4 * 4 + // color is 4 32bit floats (4 bytes each)
    2 * 4 + // offset is 2 32bit floats (4 bytes each)
    2 * 4;  // padding
    const changingUnitSize = 
    2 * 4; // scale is 2 32bit floats (4 bytes each)

    //Buffer size (multiplied by number of calls)
    const staticStorageBufferSize = staticUnitSize * kNumObjects;
    const changingStorageBufferSize = changingUnitSize * kNumObjects;

    // Static Buffer
    const staticStorageBuffer = device.createBuffer({
        label: `static storage`,
        size: staticStorageBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Scale Buffer
    const changingStorageBuffer = device.createBuffer({
        label: `changing storage`,
        size: changingStorageBufferSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    
    const kColorOffset = 0; // All the offsets are in float32 indices!
    const kOffsetOffset = 4; // This means you have to multiply by 4 (bytes) if you want the buffer offset
    
    const kScaleOffset = 0; // scale has zero offset because it is contained in another buffer
    
    // Create a single array containing the values for all triangles 
    const staticStorageValues = new Float32Array(staticStorageBufferSize / 4);

    // Set array values for each triangle
    for (let i = 0; i < kNumObjects; ++i){

        //Switches to the next triangle view in the array every iteration
        const staticOffset = i * (staticUnitSize / 4); // divide by 4 to get array stride between each triangle (every f32 is equal to 4 bytes)
        
        // Values (Static Storage)
        staticStorageValues.set([rand(), rand(), rand(), 1], staticOffset + kColorOffset); // We set the values in the single array using the offsets 
        staticStorageValues.set([rand(-0.9, 0.9), rand(-0.9, 0.9)], staticOffset + kOffsetOffset);

        // Object infos
        objectInfos.push({
            scale: rand(0.2, 0.5), // set a default scale for now, we'll multiply it later by canvas aspect 
        });
    }

    device.queue.writeBuffer(staticStorageBuffer, 0, staticStorageValues); // write the values now, they don't depend on canvas aspect

    const storageValues = new Float32Array(changingStorageBufferSize / 4);

    // Bind group
    const bindGroup = device.createBindGroup({
        label: `bind group`,
        layout: pipeline.getBindGroupLayout(0),
        entries : [
            {binding: 0, resource: { buffer: staticStorageBuffer }},
            {binding: 1, resource: { buffer: changingStorageBuffer }},
        ]
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

        const aspect = canvas.width / canvas.height;
    
        // Set the scale for each triangle
        objectInfos.forEach(({scale}, ndx) => { //ndx is the variable name we give for the forEach iteration index
            const offset = ndx * (changingUnitSize / 4); // array stride between each scale value
            storageValues.set([scale / aspect, scale], offset + kScaleOffset) // set the scale in the array so we can write it to the buffer after
        })

        // Write all scale values at once
        device.queue.writeBuffer(changingStorageBuffer, 0, storageValues);

        pass.setBindGroup(0, bindGroup);
        pass.draw(3, kNumObjects); // call the vertex shader 3 times for each object;

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