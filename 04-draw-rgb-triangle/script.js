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
        label: "rgb triangle shader",
        code: `
            struct shaderOutput {
                @builtin(position) position:vec4f,
                @location(0) color:vec4f,
            };

            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
            ) -> shaderOutput {

                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5),
                );

                var color = array<vec4f, 3>(
                    vec4f(1, 0, 0, 1),
                    vec4f(0, 1, 0, 1),
                    vec4f(0, 0, 1, 1),
                );

                var vsOutput: shaderOutput;
                vsOutput.position = vec4f(pos[vertexIndex], 0, 1);
                vsOutput.color = color[vertexIndex];
                return vsOutput;
            }

            @fragment fn fs(fsInput: shaderOutput) -> @location(0) vec4f {
                return fsInput.color;
            }
        `,
    });

    // Render pipeline
    const pipeline = device.createRenderPipeline({
        label: "red triangle pipeline",
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
        pass.draw(3);
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