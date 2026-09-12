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
