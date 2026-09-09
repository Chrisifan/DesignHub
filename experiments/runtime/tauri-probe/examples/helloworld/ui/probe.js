// Disposable synthetic WebView probe; no React, production canvas, or real input events.
const status = document.querySelector('#status');
const canvas = document.querySelector('#view');
const context = canvas.getContext('2d');
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
const quantile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const report = async (value) => {
  status.textContent = JSON.stringify(value);
  await fetch('/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
};
const run = async () => {
  const greeting = await window.__TAURI__.core.invoke('greet', { name: 'DesignHub 探针' });
  if (!greeting.includes('DesignHub 探针')) throw new Error('Native IPC greeting mismatch');
  const source = document.createElement('canvas');
  source.width = 6000;
  source.height = 4000;
  const sourceContext = source.getContext('2d');
  const gradient = sourceContext.createLinearGradient(0, 0, 6000, 4000);
  gradient.addColorStop(0, '#315d82');
  gradient.addColorStop(1, '#e5c89e');
  sourceContext.fillStyle = gradient;
  sourceContext.fillRect(0, 0, 6000, 4000);
  const input = await new Promise((resolve, reject) => source.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Input PNG failed')), 'image/png'));
  source.width = 1;
  source.height = 1;
  const worker = new Worker('/worker.js', { type: 'module' });
  let bitmap;
  const frames = [];
  const drawing = [];
  const heartbeat = [];
  const cycles = [];
  let previousBeat = performance.now();
  const timer = setInterval(() => {
    const now = performance.now();
    heartbeat.push(now - previousBeat);
    previousBeat = now;
  }, 16);
  const request = (message) => new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
    worker.onerror = (event) => reject(new Error(event.message));
    worker.postMessage(message);
  });
  try {
    for (let cycle = 0; cycle < 10; cycle += 1) {
      const started = performance.now();
      const result = await request({ input, cycle });
      bitmap?.close();
      bitmap = result.bitmap;
      if (bitmap.width !== 6000 || bitmap.height !== 4000 || result.bytes <= 0) throw new Error('Bad exported raster');
      cycles.push({ cycle: cycle + 1, elapsedMs: performance.now() - started, pngBytes: result.bytes });
      let previous = await nextFrame();
      for (let frame = 0; frame < 12; frame += 1) {
        const start = performance.now();
        context.clearRect(0, 0, canvas.width, canvas.height);
        const scale = 0.16 + (frame % 6) * 0.006;
        context.drawImage(bitmap, frame * 2, frame, 6000 * scale, 4000 * scale);
        context.strokeStyle = '#ffffff';
        context.strokeRect(20 + frame * 2, 20 + frame, 200, 100);
        drawing.push(performance.now() - start);
        const now = await nextFrame();
        frames.push(now - previous);
        previous = now;
      }
    }
    let expectedFailure = false;
    try { await request({ fail: true }); } catch (error) { expectedFailure = error.message === 'injected-worker-failure'; }
    if (!expectedFailure) throw new Error('Worker failure was not delivered');
    bitmap.close();
    bitmap = undefined;
    context.clearRect(0, 0, canvas.width, canvas.height);
    await report({
      status: 'pass', greeting, userAgent: navigator.userAgent,
      devicePixelRatio, screen: { width: screen.width, height: screen.height },
      workload: '6000x4000 synthetic PNG; 1 raster + 18 rectangles + 1 Chinese text layer; 10 worker decode/composite/PNG-export/decode cycles; 120 synthetic pan/zoom frames',
      metrics: { frameGapP95Ms: quantile(frames, 0.95), frameGapMaxMs: Math.max(...frames), drawCallP95Ms: quantile(drawing, 0.95), heartbeatMaxMs: Math.max(...heartbeat) },
      workerFailureDelivered: expectedFailure, cycles,
      exclusions: ['Real pointer/keyboard/IME input', 'Editable canvas library', '20 full-resolution raster layers', 'Whole-app/GPU memory recovery', 'Filesystem export', 'Windows', 'Production credentials and task history'],
    });
  } finally {
    clearInterval(timer);
    worker.terminate();
    bitmap?.close();
  }
};
run().catch((error) => report({ status: 'fail', error: error.message }));
