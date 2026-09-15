import type { OpenAICompatibleAdapter } from './adapter';

export type ProviderConformanceCheck = {
  name: 'conversation' | 'stream' | 'vision-analysis' | 'image-generation' | 'image-editing';
  ok: boolean;
  error?: string;
};

export type ProviderConformanceReport = {
  ok: boolean;
  checks: ProviderConformanceCheck[];
};

export type ProviderConformanceHarness = {
  run: () => Promise<ProviderConformanceReport>;
};

type HarnessOptions = {
  redactError?: (value: string) => string;
};

const errorMessage = (error: unknown, redact: (value: string) => string): string => {
  const message = error instanceof Error && error.message ? error.message : 'CHECK_FAILED';
  return redact(message).slice(0, 240);
};

const createProviderConformanceHarness = (
  adapter: OpenAICompatibleAdapter,
  options: HarnessOptions = {},
): ProviderConformanceHarness => {
  const redact = options.redactError ?? ((value: string): string => value);
  const runCheck = async (
    name: ProviderConformanceCheck['name'],
    check: () => Promise<void>,
  ): Promise<ProviderConformanceCheck> => {
    try {
      await check();
      return { name, ok: true };
    } catch (error) {
      return { name, ok: false, error: errorMessage(error, redact) };
    }
  };

  const run = async (): Promise<ProviderConformanceReport> => {
    const checks = await Promise.all([
      runCheck('conversation', async () => {
        const result = await adapter.chat({ messages: [{ role: 'user', content: 'DesignHub conformance check' }] });
        if (!result.text.trim()) throw new Error('EMPTY_CONVERSATION_RESULT');
      }),
      runCheck('stream', async () => {
        let text = '';
        for await (const event of adapter.streamChat({ messages: [{ role: 'user', content: 'DesignHub stream check' }] })) text += event.text;
        if (!text.trim()) throw new Error('EMPTY_STREAM_RESULT');
      }),
      runCheck('vision-analysis', async () => {
        const result = await adapter.analyzeVision({ prompt: 'Describe this conformance image.', image: { base64: 'aW1hZ2U=', mimeType: 'image/png' } });
        if (!result.text.trim()) throw new Error('EMPTY_VISION_RESULT');
      }),
      runCheck('image-generation', async () => {
        const result = await adapter.generateImage({ prompt: 'A one-pixel conformance image', count: 1 });
        if (result.images.length === 0) throw new Error('IMAGE_RESULT_EMPTY');
      }),
      runCheck('image-editing', async () => {
        const result = await adapter.editImage({
          prompt: 'Apply a conformance edit',
          image: new Blob(['image'], { type: 'image/png' }),
          tool: 'remove-object',
          toolParams: { feather: 1 },
          region: { x: 0, y: 0, width: 1, height: 1 },
        });
        if (result.images.length === 0) throw new Error('IMAGE_RESULT_EMPTY');
      }),
    ]);
    return { ok: checks.every((check) => check.ok), checks };
  };

  return { run };
};

export { createProviderConformanceHarness };
