// Use WASM backend for smooth performance
tf.wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/');

const video = document.getElementById('video');
const canvas = document.getElementById('output');
const ctx = canvas.getContext('2d');
const offscreen = document.createElement('canvas');
const offCtx = offscreen.getContext('2d');

// Stats Elements
const fpsEl = document.getElementById('fpsValue');
const facesEl = document.getElementById('facesValue');
const confEl = document.getElementById('confValue');

// Controls
const toggleBtn = document.getElementById('toggleBtn');
const btnText = document.getElementById('btnText');
const btnIcon = document.getElementById('btnIcon');
const blurBtn = document.getElementById('blurBtn');
const blurText = document.getElementById('blurText');
const blurIcon = document.getElementById('blurIcon');

let model = null;
let isDetectionActive = true;
let isBlurActive = false; 
let lastFrameTime = 0; 

// 1. Toggle Detection
toggleBtn.addEventListener('click', () => {
    isDetectionActive = !isDetectionActive;
    if (isDetectionActive) {
        toggleBtn.className = 'active';
        btnText.innerText = "Stop Detection";
        btnIcon.innerText = "◼";
        lastFrameTime = performance.now();
        detectFaces(); 
    } else {
        toggleBtn.className = 'inactive';
        btnText.innerText = "Start Detection";
        btnIcon.innerText = "▶";
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fpsEl.innerText = "0"; 
        facesEl.innerText = "0"; 
        confEl.innerText = "0%";
    }
});

// 2. Toggle Blur
blurBtn.addEventListener('click', () => {
    isBlurActive = !isBlurActive;
    if (isBlurActive) {
        blurBtn.className = 'blur-active';
        blurText.innerText = "Privacy Blur: ON"; 
    } else {
        blurBtn.className = '';
        blurText.innerText = "Privacy Blur: OFF";
    }
});

async function main() {
    try {
        // Initialize WASM Backend
        await tf.setBackend('wasm');
        await tf.ready();
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        video.srcObject = stream;
        await new Promise((resolve) => { video.onloadedmetadata = () => { resolve(video); }; });
        video.play();

        model = await blazeface.load();
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        detectFaces();

    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
    }
}

async function detectFaces() {
    if(!model) return;
    if (!isDetectionActive) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }

    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    const fps = (1000 / delta).toFixed(0);

    const predictions = await model.estimateFaces(video, false);

    if (!isDetectionActive) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update Stats
    fpsEl.innerText = fps;
    facesEl.innerText = predictions.length;

    if (predictions.length > 0) {
        const confidence = Math.round(predictions[0].probability[0] * 100);
        confEl.innerText = confidence + "%";

        predictions.forEach((prediction) => {
            const start = prediction.topLeft;
            const end = prediction.bottomRight;
            const width = end[0] - start[0];
            const height = end[1] - start[1];
            const flippedX = ctx.canvas.width - end[0];

            if (isBlurActive) {
                // ROBUST PIXELATION
                const pixelFactor = 0.1; 
                offscreen.width = width * pixelFactor;
                offscreen.height = height * pixelFactor;
                offCtx.imageSmoothingEnabled = false;
                offCtx.drawImage(video, start[0], start[1], width, height, 0, 0, offscreen.width, offscreen.height);

                ctx.save();
                ctx.translate(flippedX + width, start[1]);
                ctx.scale(-1, 1);
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(offscreen, 0, 0, width, height);
                ctx.restore();

                ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
                ctx.lineWidth = 4;
                ctx.strokeRect(flippedX, start[1], width, height);

            } else {
                // STANDARD BOX
                ctx.beginPath();
                ctx.lineWidth = 4;
                ctx.strokeStyle = "#00ff9d";
                ctx.rect(flippedX, start[1], width, height);
                ctx.stroke();

                ctx.fillStyle = "#00ff9d";
                ctx.font = "bold 12px Inter";
                ctx.fillText("DETECTED", flippedX, start[1] - 5);
            }
        });
    } else {
        confEl.innerText = "0%";
    }

    requestAnimationFrame(detectFaces);
}

main();