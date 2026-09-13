import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ProviderSettings } from './ProviderSettings';

it('clears the entered secret after a successful save and exposes capabilities', async () => {
  const save = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[{
        id: 'provider-a',
        label: 'Provider A',
        status: 'not-configured',
        capabilities: ['conversation', 'image-generation'],
      }]}
      onStoreCredential={save}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'secret-value' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save key' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Credential saved');
  expect(screen.getByLabelText('API key')).toHaveValue('');
  expect(save).toHaveBeenCalledWith('provider-a', 'secret-value');
  expect(screen.getByText(/conversation, image-generation/)).toBeInTheDocument();
  expect(screen.queryByText('secret-value')).not.toBeInTheDocument();
});

it('loads configured status and updates it after save and delete', async () => {
  const hasCredential = vi.fn(async () => false);
  const onStoreCredential = vi.fn(async () => true);
  const onDeleteCredential = vi.fn(async () => true);
  render(<ProviderSettings locale="en" connections={[{ id: 'provider-1', label: 'Provider', status: 'not-configured', capabilities: ['conversation'] }]} onStoreCredential={onStoreCredential} onDeleteCredential={onDeleteCredential} onCheckCredential={hasCredential} />);
  expect(await screen.findByText('Not configured')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save key' }));
  await screen.findByText('Connected');
  fireEvent.click(screen.getByRole('button', { name: 'Delete key' }));
  await waitFor(() => expect(screen.getByText('Not configured')).toBeInTheDocument());
  expect(hasCredential).toHaveBeenCalledWith('provider-1');
});

it('saves the endpoint and capability models without mixing them with the API key', async () => {
  const saveConfig = vi.fn(async () => true);
  render(
    <ProviderSettings
      locale="en"
      connections={[{ id: 'openai-compatible', label: 'OpenAI compatible', status: 'not-configured', capabilities: ['conversation', 'vision-analysis', 'image-generation', 'image-editing'] }]}
      configs={{ 'openai-compatible': { baseUrl: 'https://api.example.test/v1', models: { conversation: 'chat-old' } } }}
      onSaveProviderConfig={saveConfig}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  expect(screen.getByLabelText('Base URL')).toHaveValue('https://api.example.test/v1');
  fireEvent.change(screen.getByLabelText('Conversation model'), { target: { value: 'chat-new' } });
  fireEvent.change(screen.getByLabelText('Image generation model'), { target: { value: 'image-new' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save config' }));

  await waitFor(() => expect(saveConfig).toHaveBeenCalledWith('openai-compatible', {
    baseUrl: 'https://api.example.test/v1',
    models: { conversation: 'chat-new', 'image-generation': 'image-new' },
  }));
  expect(JSON.stringify(saveConfig.mock.calls)).not.toContain('API key');
});

it('reports a recoverable message when saving connection configuration rejects', async () => {
  render(
    <ProviderSettings
      locale="en"
      connections={[{ id: 'openai-compatible', label: 'OpenAI compatible', status: 'not-configured', capabilities: ['conversation'] }]}
      onSaveProviderConfig={vi.fn(async () => { throw new Error('disk unavailable'); })}
      onStoreCredential={vi.fn(async () => true)}
      onDeleteCredential={vi.fn(async () => true)}
    />,
  );

  fireEvent.change(screen.getByLabelText('Base URL'), { target: { value: 'https://api.example.test/v1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save config' }));

  expect(await screen.findByRole('status')).toHaveTextContent('Connection configuration could not be saved');
});
