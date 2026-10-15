import { runLiveProviderSmoke } from '../src/features/providers/live-smoke';
import type { ImageTransport } from '../src/features/providers/config';

const enabled = process.env.DESIGNHUB_LIVE_PROVIDER === '1';
const baseUrl = (process.env.DESIGNHUB_PROVIDER_BASE_URL ?? '').trim();
const apiKey = (process.env.DESIGNHUB_PROVIDER_API_KEY ?? '').trim();
const conversationModel = (process.env.DESIGNHUB_CONVERSATION_MODEL ?? '').trim();
const visionModel = (process.env.DESIGNHUB_VISION_MODEL ?? conversationModel).trim();
const imageGenerationModel = (process.env.DESIGNHUB_IMAGE_MODEL ?? '').trim();
const imageEditingModel = (process.env.DESIGNHUB_IMAGE_EDIT_MODEL ?? imageGenerationModel).trim();
const imageTransport = process.env.DESIGNHUB_IMAGE_TRANSPORT === 'responses' ? 'responses' : 'images';
const timeoutMs = Number(process.env.DESIGNHUB_LIVE_TIMEOUT_MS ?? 30_000);

const print = (value: unknown): void => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

if (!enabled) {
  print({ status: 'blocked', reason: 'Set DESIGNHUB_LIVE_PROVIDER=1 to enable live provider smoke.' });
  process.exitCode = 2;
} else if (!baseUrl || !apiKey || !conversationModel || !imageGenerationModel) {
  print({
    status: 'blocked',
    reason: 'DESIGNHUB_PROVIDER_BASE_URL, DESIGNHUB_PROVIDER_API_KEY, DESIGNHUB_CONVERSATION_MODEL and DESIGNHUB_IMAGE_MODEL are required.',
  });
  process.exitCode = 2;
} else {
  const report = await runLiveProviderSmoke({
    baseUrl,
    apiKey,
    imageTransport: imageTransport satisfies ImageTransport,
    timeoutMs,
    models: {
      conversation: conversationModel,
      vision: visionModel,
      imageGeneration: imageGenerationModel,
      imageEditing: imageEditingModel,
    },
  });
  print(report);
  process.exitCode = report.status === 'passed' ? 0 : 1;
}
