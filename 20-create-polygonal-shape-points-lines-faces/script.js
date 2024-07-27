import { faceShader, lineShader, pointShader, Polygon } from "./classes.js";

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

    const polygon = new Polygon(6, 100);

    // Observe window resizing and adjust canvas
    const observer = new ResizeObserver(entries => {
        const entry = entries[0];
        const canvas = entry.target;
        const width = entry.contentBoxSize[0].inlineSize;
        const height = entry.contentBoxSize[0].blockSize;
        canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D)); // minimum 1 pixel, max device limits
        canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        
        faceShader(device, canvas, context, canvasFormat, polygon);
        lineShader(device, canvas, context, canvasFormat, polygon);
        pointShader(device, canvas, context, canvasFormat, polygon);
    });

    observer.observe(canvas); // the function above is executed everytime the canvas is observed to change size
}
main()