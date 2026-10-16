import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';

import { ProfileStep } from './ProfileStep';

const library = {
  libraryId: 'library-1',
  directory: '/tmp/designhub-library',
  formatVersion: 1,
  openMode: 'writable' as const,
};

it('keeps continue disabled until nickname, avatar, and folder are present', async () => {
  const onSubmit = vi.fn(async () => undefined);
  render(
    <ProfileStep
      locale="zh-CN"
      initialProfile={null}
      onChooseProjectLibrary={vi.fn(async () => library)}
      onSubmit={onSubmit}
    />,
  );

  expect(screen.getByRole('button', { name: '继续' })).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: 'Sifan' } });
  fireEvent.change(screen.getByLabelText('上传头像'), {
    target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByRole('img', { name: '头像预览' })).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '继续' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '继续' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    displayName: 'Sifan',
    library,
    avatar: expect.objectContaining({ mimeType: 'image/png' }),
  })));
});

it('keeps the selected fields when directory selection is cancelled', async () => {
  render(
    <ProfileStep
      locale="zh-CN"
      initialProfile={null}
      onChooseProjectLibrary={vi.fn(async () => null)}
      onSubmit={vi.fn(async () => undefined)}
    />,
  );

  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: 'Sifan' } });
  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  expect(screen.getByRole('textbox', { name: '昵称' })).toHaveValue('Sifan');
  expect(screen.getByText('尚未选择存储文件夹')).toBeVisible();
});

it('reuses the existing avatar when recovering the storage directory', async () => {
  const onSubmit = vi.fn(async () => undefined);
  render(
    <ProfileStep
      locale="zh-CN"
      initialProfile={{
        formatVersion: 1,
        displayName: 'Sifan',
        avatarDataUrl: 'data:image/webp;base64,AA==',
        onboarding: { profileCompleted: true, modelStepCompleted: true },
      }}
      onChooseProjectLibrary={vi.fn(async () => library)}
      onSubmit={onSubmit}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  await waitFor(() => expect(screen.getByRole('button', { name: '继续' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: '继续' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
    displayName: 'Sifan',
    library,
  }));
});
