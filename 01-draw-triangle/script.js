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
        label: "red triangle shader",
        code: `
            @vertex fn vs(
                @builtin(vertex_index) vertexIndex : u32
            ) -> @builtin(position) vec4f {

                let pos = array(
                    vec2f( 0.0,  0.5),
                    vec2f(-0.5, -0.5),
                    vec2f( 0.5, -0.5)
                );

                return vec4f(pos[vertexIndex], 0, 1);
            }

            @fragment fn fs() -> @location(0) vec4f {
                return vec4f(1, 0, 0, 1);
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

    render();
}
main();