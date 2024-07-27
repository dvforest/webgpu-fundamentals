async function main(){
    
    // Get GPU Device
    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device){
        alert("WebGPU not supported in browser")
        return;
    }

    // Shader module
    const module = device.createShaderModule({
        label: "doubling compute module",
        code: `
        @group(0) @binding(0) var<storage, read_write> data: array<f32>;

        @compute @workgroup_size(1) fn computeSomething(
            @builtin(global_invocation_id) id: vec3<u32>
        ) {
            let i = id.x;
            data[i] = data[i] * 2.0;
        }
        `,
    });

    // Compute pipeline
    const pipeline = device.createComputePipeline({
        label: "double compute pipeline",
        layout: "auto",
        compute: {
            module,
            entryPoint: "computeSomething",
        },
    });

    // Input array to put in the buffer
    const input = new Float32Array([1, 3, 5]);

    // Create buffer on the GPU to hold our computation
    const workBuffer = device.createBuffer({
        label: "workBuffer",
        size: input.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(workBuffer, 0, input);

    // Create buffer on the GPU to get a copy of the results
    const resultBuffer = device.createBuffer({
        label: "resultBuffer",
        size: input.byteLength,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });

    // Bind Group
    const bindGroup = device.createBindGroup({
        label: "bindGroup for work buffer",
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: workBuffer }}
        ],
    });

    // Encode commands
    const encoder = device.createCommandEncoder({
        label: "doubling encoder",
    });
    const pass = encoder.beginComputePass({ // start recording commands
        label: "doubling compute pass",
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(input.length);
    pass.end();
    encoder.copyBufferToBuffer(workBuffer, 0, resultBuffer, 0, resultBuffer.size); // transfer the buffers
    device.queue.submit([encoder.finish()]); // submit the commands into the queue

    // Read results
    await resultBuffer.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(resultBuffer.getMappedRange().slice()); // put buffer in new array
    resultBuffer.unmap(); //from here the resultBuffer is no longer accessible and will be set to zero

    console.log("input", input);
    console.log("result", result);

    
    
}
main();