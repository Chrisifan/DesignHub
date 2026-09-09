// Worker owns decoding/compositing/encoding; only the finished bitmap is transferred.
onmessage = async ({ data }) => {
  let inputBitmap;
  try {
    if (data.fail) throw new Error('injected-worker-failure');
    inputBitmap = await createImageBitmap(data.input);
    const canvas = new OffscreenCanvas(6000, 4000);
    const context = canvas.getContext('2d');
    context.drawImage(inputBitmap, 0, 0);
    inputBitmap.close();
    inputBitmap = undefined;
    for (let layer = 0; layer < 18; layer += 1) {
      context.fillStyle = `hsla(${layer * 19 + data.cycle}, 60%, 65%, 0.3)`;
      context.fillRect(100 + (layer % 6) * 900, 200 + Math.floor(layer / 6) * 1000, 800, 800);
    }
    context.fillStyle = '#ffffff';
    context.font = '180px sans-serif';
    context.fillText('设计师署名 · 中文排版验证', 200, 3800);
    const output = await canvas.convertToBlob({ type: 'image/png' });
    canvas.width = 1;
    canvas.height = 1;
    const bitmap = await createImageBitmap(output);
    postMessage({ bitmap, bytes: output.size }, [bitmap]);
  } catch (error) {
    postMessage({ error: error.message });
  } finally {
    inputBitmap?.close();
  }
};
