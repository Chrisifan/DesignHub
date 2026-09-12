import { fireEvent, render, screen } from '@testing-library/react';
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
