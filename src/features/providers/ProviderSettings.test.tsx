import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ProviderSettings } from './ProviderSettings';

const connection = {
  id: 'openai-compatible',
  label: 'OpenAI compatible',
  status: 'not-configured' as const,
  capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] as const,
};

it('omits redundant connection chrome when only one provider is available', () => {
  render(
    <ProviderSettings
      locale="en"
      connections={[connection]}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  expect(screen.queryByRole('heading', { name: 'Connection setup' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Connection')).not.toBeInTheDocument();
  expect(screen.queryByText(/^Capabilities:/)).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Image generation and editing' })).toBeInTheDocument();
});

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
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveValue('********');
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

  const keyStatus = await screen.findByText('Key saved');
  expect(keyStatus.parentElement).toHaveClass('provider-key-label');
  expect(keyStatus.parentElement).toHaveTextContent('API key');
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveAttribute('placeholder', 'Enter a new key to replace the saved key');
  expect(screen.getByLabelText('Conversation and vision API key')).toHaveValue('********');
  expect(screen.getByTestId('conversation-key-actions')).toHaveClass('provider-key-actions');
  expect(screen.getByLabelText('Conversation and vision API key').parentElement).toHaveClass('provider-key-row');
  expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
});

it('places each connection status beside its profile title', async () => {
  render(
    <ProviderSettings
      locale="en"
      connections={[{ ...connection, status: 'connected' }]}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  const conversationTitle = screen.getByRole('heading', { name: 'Conversation and vision' });
  const imageTitle = screen.getByRole('heading', { name: 'Image generation and editing' });
  await waitFor(() => expect(conversationTitle.parentElement).toHaveTextContent('Connected'));
  expect(imageTitle.parentElement).toHaveTextContent('Connected');
  expect(conversationTitle.parentElement).toHaveClass('provider-profile-title-row');
  expect(imageTitle.parentElement).toHaveClass('provider-profile-title-row');
});

it('keeps the configuration save action after the key controls', () => {
  render(
    <ProviderSettings
      locale="en"
      activeProfile="image"
      connections={[connection]}
      onSaveProviderConfig={vi.fn(async () => true)}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  const saveConfig = screen.getByRole('button', { name: 'Save config' });
  const keyActions = screen.getByTestId('image-key-actions');
  expect(keyActions.compareDocumentPosition(saveConfig) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(saveConfig.querySelector('.ui-icon')).toBeInTheDocument();
});

it('places image generation testing beside the configuration save action', () => {
  render(
    <ProviderSettings
      locale="en"
      activeProfile="image"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: '', models: {} },
        image: { baseUrl: 'https://image.example/v1', imageTransport: 'images', models: {} },
      } }}
      onSaveProviderConfig={vi.fn(async () => true)}
      onTestImageGeneration={vi.fn(async () => ({ image: { base64: 'preview' }, cost: null }))}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  const testButton = screen.getByRole('button', { name: 'Test generation' });
  const saveConfig = screen.getByRole('button', { name: 'Save config' });
  expect(testButton.parentElement?.parentElement).toHaveClass('provider-profile-actions-row');
  expect(saveConfig.parentElement?.parentElement).toBe(testButton.parentElement?.parentElement);
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

  fireEvent.click(screen.getByRole('button', { name: 'Test generation' }));

  expect(await screen.findByRole('img', { name: 'Connection test result' })).toHaveAttribute('src', 'data:image/png;base64,preview-bytes');
  expect(testImageGeneration).toHaveBeenCalledWith('openai-compatible', expect.objectContaining({ prompt: expect.any(String), model: 'image-model', size: '1024x1024' }));
  expect(screen.getByRole('status')).toHaveTextContent('Image generation connection test succeeded');
});

it('tests the conversation connection with its configured model', async () => {
  const testConversation = vi.fn(async () => ({ cost: null }));
  render(
    <ProviderSettings
      locale="en"
      activeProfile="conversation"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://text.example/v1', models: { conversation: 'chat-model' } },
        image: { baseUrl: '', imageTransport: 'images', models: {} },
      } }}
      onTestConversation={testConversation}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Test connection' }));

  await waitFor(() => expect(testConversation).toHaveBeenCalledWith('openai-compatible', { model: 'chat-model' }));
  expect(screen.getByRole('status')).toHaveTextContent('Conversation connection test succeeded');
});

it('saves the current form before testing the conversation connection', async () => {
  const saveConfig = vi.fn(async () => true);
  const testConversation = vi.fn(async () => ({ cost: null }));
  render(
    <ProviderSettings
      locale="en"
      activeProfile="conversation"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://old.example/v1', models: { conversation: 'old-model' } },
        image: { baseUrl: '', imageTransport: 'images', models: {} },
      } }}
      onSaveProviderConfig={saveConfig}
      onTestConversation={testConversation}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.change(screen.getByLabelText('Conversation base URL'), { target: { value: 'https://new.example/v1' } });
  fireEvent.change(screen.getByLabelText('Conversation model'), { target: { value: 'new-model' } });
  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

  await waitFor(() => expect(testConversation).toHaveBeenCalledWith('openai-compatible', { model: 'new-model' }));
  expect(saveConfig).toHaveBeenCalledWith('openai-compatible', expect.objectContaining({
    conversation: { baseUrl: 'https://new.example/v1', models: { conversation: 'new-model' } },
  }));
  expect(saveConfig.mock.invocationCallOrder[0]).toBeLessThan(testConversation.mock.invocationCallOrder[0]!);
});

it('explains that a TLS failure happened before an HTTP request reached the provider', async () => {
  render(
    <ProviderSettings
      locale="en"
      activeProfile="conversation"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://bad-certificate.example/v1', models: {} },
        image: { baseUrl: '', imageTransport: 'images', models: {} },
      } }}
      onTestConversation={vi.fn(async () => { throw new Error('PROVIDER_TLS_ERROR: self-signed certificate (DEPTH_ZERO_SELF_SIGNED_CERT)'); })}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

  expect(await screen.findByRole('status')).toHaveTextContent('TLS certificate validation failed before an HTTP request was sent');
  expect(screen.getByRole('status')).toHaveTextContent('DEPTH_ZERO_SELF_SIGNED_CERT');
});

it('explains when the conversation test was blocked locally by a missing key', async () => {
  render(
    <ProviderSettings
      locale="en"
      activeProfile="conversation"
      connections={[{ ...connection, status: 'connected' }]}
      configs={{ 'openai-compatible': {
        conversation: { baseUrl: 'https://text.example/v1', models: {} },
        image: { baseUrl: '', imageTransport: 'images', models: {} },
      } }}
      onTestConversation={vi.fn(async () => { throw new Error('PROVIDER_API_KEY_REQUIRED'); })}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));

  expect(await screen.findByRole('status')).toHaveTextContent('No saved API key was available. The request was not sent');
});
