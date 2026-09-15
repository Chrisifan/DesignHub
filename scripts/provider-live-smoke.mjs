const enabled = process.env.DESIGNHUB_LIVE_PROVIDER === '1';
const baseUrl = (process.env.DESIGNHUB_PROVIDER_BASE_URL ?? '').trim().replace(/\/+$/u, '');
const apiKey = (process.env.DESIGNHUB_PROVIDER_API_KEY ?? '').trim();
const conversationModel = (process.env.DESIGNHUB_CONVERSATION_MODEL ?? '').trim();
const visionModel = (process.env.DESIGNHUB_VISION_MODEL ?? conversationModel).trim();
const imageModel = (process.env.DESIGNHUB_IMAGE_MODEL ?? '').trim();
const imageEditModel = (process.env.DESIGNHUB_IMAGE_EDIT_MODEL ?? imageModel).trim();
const timeoutMs = Number(process.env.DESIGNHUB_LIVE_TIMEOUT_MS ?? 30000);

const result = (name, status, details = {}) => ({ name, status, ...details });
const redact = (value) => typeof value === 'string' && apiKey ? value.replaceAll(apiKey, '[redacted]') : value;

const print = (payload) => {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
};

if (!enabled) {
  print({ status: 'blocked', reason: 'Set DESIGNHUB_LIVE_PROVIDER=1 to enable live provider smoke.' });
  process.exitCode = 2;
} else if (!baseUrl || !apiKey || !conversationModel || !imageModel) {
  print({
    status: 'blocked',
    reason: 'DESIGNHUB_PROVIDER_BASE_URL, DESIGNHUB_PROVIDER_API_KEY, DESIGNHUB_CONVERSATION_MODEL and DESIGNHUB_IMAGE_MODEL are required.',
  });
  process.exitCode = 2;
} else {
  const headers = { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
  const request = async (name, path, body, parse) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000);
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const providerMessage = payload?.error?.message;
        return result(name, 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, error: typeof providerMessage === 'string' ? redact(providerMessage).slice(0, 160) : 'HTTP_REQUEST_FAILED' });
      }
      const valid = parse(payload);
      return result(name, valid ? 'passed' : 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, ...(valid ? {} : { error: 'INVALID_RESPONSE' }) });
    } catch (error) {
      return result(name, 'failed', { elapsedMs: Date.now() - started, error: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_REQUEST_FAILED' });
    } finally {
      clearTimeout(timer);
    }
  };

  const requestStream = async (name, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000);
    const started = Date.now();
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: true }), signal: controller.signal });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const providerMessage = payload?.error?.message;
        return result(name, 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, error: typeof providerMessage === 'string' ? redact(providerMessage).slice(0, 160) : 'HTTP_REQUEST_FAILED' });
      }
      const reader = response.body?.getReader();
      if (!reader) return result(name, 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, error: 'NO_STREAM_BODY' });
      const decoder = new TextDecoder();
      let buffer = '';
      let text = '';
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        if (chunk.done) { buffer += decoder.decode(); done = true; } else buffer += decoder.decode(chunk.value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/u);
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const data = frame.split(/\r?\n/u).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
          if (!data) continue;
          if (data === '[DONE]') { done = true; break; }
          try {
            const content = data && JSON.parse(data)?.choices?.[0]?.delta?.content;
            if (typeof content === 'string') text += content;
          } catch {
            return result(name, 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, error: 'INVALID_STREAM' });
          }
        }
      }
      return result(name, text.trim() ? 'passed' : 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, ...(text.trim() ? {} : { error: 'INVALID_RESPONSE' }) });
    } catch (error) {
      return result(name, 'failed', { elapsedMs: Date.now() - started, error: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_REQUEST_FAILED' });
    } finally {
      clearTimeout(timer);
    }
  };

  const requestImageEdit = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000);
    const started = Date.now();
    try {
      const form = new FormData();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR42mP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC', 'base64');
      form.append('prompt', 'Apply a minimal conformance edit');
      form.append('model', imageEditModel);
      form.append('tool', 'remove-object');
      form.append('tool_params', JSON.stringify({ feather: 1 }));
      form.append('region', JSON.stringify({ x: 0, y: 0, width: 1, height: 1 }));
      form.append('image', new Blob([png], { type: 'image/png' }), 'source.png');
      const response = await fetch(`${baseUrl}/images/edits`, { method: 'POST', headers: { authorization: `Bearer ${apiKey}` }, body: form, signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const providerMessage = payload?.error?.message;
        return result('image-editing', 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, error: typeof providerMessage === 'string' ? redact(providerMessage).slice(0, 160) : 'HTTP_REQUEST_FAILED' });
      }
      const valid = Array.isArray(payload?.data) && payload.data.length > 0;
      return result('image-editing', valid ? 'passed' : 'failed', { statusCode: response.status, elapsedMs: Date.now() - started, ...(valid ? {} : { error: 'INVALID_RESPONSE' }) });
    } catch (error) {
      return result('image-editing', 'failed', { elapsedMs: Date.now() - started, error: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_REQUEST_FAILED' });
    } finally {
      clearTimeout(timer);
    }
  };

  const run = async () => {
    const checks = [];
    checks.push(await request('conversation', '/chat/completions', { model: conversationModel, messages: [{ role: 'user', content: 'Reply with the word ok.' }], max_tokens: 8 }, (payload) => typeof payload?.choices?.[0]?.message?.content === 'string'));
    checks.push(await requestStream('stream', { model: conversationModel, messages: [{ role: 'user', content: 'Reply with the word ok.' }], max_tokens: 8 }));
    checks.push(await request('vision-analysis', '/chat/completions', { model: visionModel, messages: [{ role: 'user', content: [{ type: 'text', text: 'Describe the image in one word.' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' } }] }], max_tokens: 8 }, (payload) => typeof payload?.choices?.[0]?.message?.content === 'string'));
    checks.push(await request('image-generation', '/images/generations', { model: imageModel, prompt: 'A one-pixel solid black image', size: '1024x1024', n: 1 }, (payload) => Array.isArray(payload?.data) && payload.data.length > 0));
    checks.push(await requestImageEdit());
    print({ status: checks.every((check) => check.status === 'passed') ? 'passed' : 'failed', checks });
    process.exitCode = checks.every((check) => check.status === 'passed') ? 0 : 1;
  };

  await run();
}
