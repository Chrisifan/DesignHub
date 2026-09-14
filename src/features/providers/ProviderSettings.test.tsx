import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ProviderSettings } from './ProviderSettings';

const connection = {
  id: 'openai-compatible',
  label: 'OpenAI compatible',
  status: 'not-configured' as const,
  capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] as const,
};

it('clears the conversation secret after a successful save and exposes both profiles', async () => {
  const save = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[{ ...connection, id: 'provider-a', label: 'Provider A', capabilities: ['conversation', 'image-generation'] }]}
      onStoreCredential={save}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  expect(screen.getByRole('heading', { name: 'Conversation and vision' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Image generation and editing' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Conversation and vision API key'), { target: { value: 'secret-value' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save key' })[0]!);
  expect(await screen.findByRole('status')).toHaveTextContent('Credential saved');
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveValue('');
  expect(save).toHaveBeenCalledWith('provider-a:conversation', 'secret-value');
  expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
});

it('loads profile status and updates it after save and delete', async () => {
  const hasCredential = vi.fn(async (account: string) => account.endsWith(':conversation'));
  const onStoreCredential = vi.fn(async () => true);
  const onDeleteCredential = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[{ ...connection, id: 'provider-1', label: 'Provider' }]}
      onStoreCredential={onStoreCredential}
      onDeleteCredential={onDeleteCredential}
      onCheckCredential={hasCredential}
    />,
  );
  expect(await screen.findAllByText('Connected')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Conversation and vision API key'), { target: { value: 'secret' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save key' })[0]!);
  await screen.findByRole('status');
  fireEvent.click(screen.getAllByRole('button', { name: 'Delete key' })[0]!);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Conversation and vision' }).parentElement).toHaveTextContent('Not configured'));
  expect(hasCredential).toHaveBeenCalledWith('provider-1:conversation');
  expect(hasCredential).toHaveBeenCalledWith('provider-1:image');
  expect(onDeleteCredential).toHaveBeenCalledWith('provider-1:conversation');
});

it('makes a saved key visible as a status without exposing its value', async () => {
  render(
    <ProviderSettings
      locale="en"
      connections={[{ ...connection, status: 'connected' }]}
      onCheckCredential={vi.fn(async (account: string) => account === 'openai-compatible:conversation')}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  expect(await screen.findByText('Key saved')).toBeInTheDocument();
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveAttribute('placeholder', 'Enter a new key to replace the saved key');
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveValue('');
  expect(screen.getByTestId('conversation-key-actions')).toHaveClass('provider-key-actions');
  expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
});

it('saves nested profile configuration without mixing the two model groups', async () => {
  const saveConfig = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[connection]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://text.example/v1', models: { conversation: 'chat-old' } },
        image: { baseUrl: 'https://image.example/v1', imageTransport: 'images', models: { 'image-generation': 'image-old' } },
      } }}
      onSaveProviderConfig={saveConfig}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  expect(screen.getByLabelText('Conversation base URL')).toHaveValue('https://text.example/v1');
  expect(screen.getByLabelText('Image base URL')).toHaveValue('https://image.example/v1');
  fireEvent.change(screen.getByLabelText('Conversation model'), { target: { value: 'chat-new' } });
  fireEvent.change(screen.getByLabelText('Image generation model'), { target: { value: 'image-new' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save config' })[0]!);

  await waitFor(() => expect(saveConfig).toHaveBeenCalledWith('openai-compatible', {
    conversation: { baseUrl: 'https://text.example/v1', models: { conversation: 'chat-new' } },
    image: { baseUrl: 'https://image.example/v1', imageTransport: 'images', models: { 'image-generation': 'image-new' } },
  }));
});

it('allows saving conversation configuration while the image profile is empty', async () => {
  const saveConfig = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[connection]}
      onSaveProviderConfig={saveConfig}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.change(screen.getByLabelText('Conversation base URL'), { target: { value: 'https://text.example/v1' } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Save config' })[0]!);
  await waitFor(() => expect(saveConfig).toHaveBeenCalledWith('openai-compatible', expect.objectContaining({
    conversation: { baseUrl: 'https://text.example/v1', models: {} },
    image: { baseUrl: '', imageTransport: 'images', models: {} },
  })));
});

it('runs the image connection test with the image profile model', async () => {
  const testImageGeneration = vi.fn(async () => ({ image: { base64: 'preview-bytes' }, cost: null }));
  render(
    <ProviderSettings
      locale="en"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://text.example/v1', models: {} },
        image: { baseUrl: 'https://image.example/v1', imageTransport: 'responses', models: { 'image-generation': 'image-model' } },
      } }}
      onTestImageGeneration={testImageGeneration}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Test image generation' }));

  expect(await screen.findByRole('img', { name: 'Connection test result' })).toHaveAttribute('src', 'data:image/png;base64,preview-bytes');
  expect(testImageGeneration).toHaveBeenCalledWith('openai-compatible', expect.objectContaining({ prompt: expect.any(String), model: 'image-model', size: '1024x1024' }));
  expect(screen.getByRole('status')).toHaveTextContent('Image generation connection test succeeded');
});
