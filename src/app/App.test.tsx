import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { App } from './App';

const library = {
  libraryId: 'library-1',
  directory: '/tmp/designhub-library',
  formatVersion: 1,
  openMode: 'writable' as const,
};

const completedProfile = {
  formatVersion: 1 as const,
  displayName: 'Sifan',
  avatarDataUrl: 'data:image/webp;base64,AA==',
  onboarding: { profileCompleted: true, modelStepCompleted: true },
};

beforeEach(() => {
  localStorage.clear();
  Reflect.deleteProperty(window, 'designhub');
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const revealSplash = async (): Promise<void> => {
  await act(async () => { await vi.advanceTimersByTimeAsync(2700); });
  vi.useRealTimers();
};

it('tracks the pointer on the root application shell through an animation frame', () => {
  let frame: FrameRequestCallback | undefined;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  render(<App />);
  const shell = screen.getByRole('main', { name: 'Design Hub' });

  fireEvent.pointerMove(shell, { clientX: 320, clientY: 240 });
  frame?.(0);
  expect(shell).toHaveAttribute('data-pointer-active', 'true');
  expect(shell.style.getPropertyValue('--pointer-x')).toBe('320px');
  expect(shell.style.getPropertyValue('--pointer-y')).toBe('240px');
});

it('shows the branded splash before first-launch onboarding', async () => {
  vi.useFakeTimers();
  window.designhub = {
    loadProfile: async () => null,
    getProjectLibraryStatus: async () => ({ state: 'unselected' }),
  } as never;
  render(<App />);

  expect(screen.getByRole('img', { name: 'Design Hub' })).toBeVisible();
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByText('检查项目库').parentElement).toHaveClass('startup-splash__check--complete');
  expect(screen.getByText('读取本地配置')).toBeVisible();
  expect(screen.queryByRole('heading', { name: '设置你的资料' })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  const halfwayProgress = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
  expect(halfwayProgress).toBeGreaterThan(0);
  expect(halfwayProgress).toBeLessThan(100);
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  expect(screen.queryByRole('heading', { name: '设置你的资料' })).toBeNull();
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getByRole('heading', { name: '设置你的资料' })).toBeVisible();
});

it('requires profile fields and advances to the optional model step', async () => {
  vi.useFakeTimers();
  const chooseProjectLibrary = vi.fn(async () => library);
  const saveProfile = vi.fn(async () => ({ ...completedProfile, onboarding: { profileCompleted: true, modelStepCompleted: false } }));
  window.designhub = {
    loadProfile: async () => null,
    getProjectLibraryStatus: async () => ({ state: 'unselected' }),
    chooseProjectLibrary,
    saveProfile,
  } as never;
  render(<App />);
  await revealSplash();

  const continueButton = screen.getByRole('button', { name: '继续' });
  expect(continueButton).toBeDisabled();
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: 'Sifan' } });
  fireEvent.change(screen.getByLabelText('上传头像'), {
    target: { files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })] },
  });
  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  await waitFor(() => expect(continueButton).toBeEnabled());
  fireEvent.click(continueButton);

  await screen.findByRole('heading', { name: '配置模型连接' });
  expect(saveProfile).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Sifan', onboarding: { profileCompleted: true } }));
});

it('skipping model setup enters the project library home', async () => {
  vi.useFakeTimers();
  const saveProfile = vi.fn(async () => completedProfile);
  window.designhub = {
    loadProfile: async () => ({ ...completedProfile, onboarding: { profileCompleted: true, modelStepCompleted: false } }),
    getProjectLibraryStatus: async () => ({ state: 'ready', library }),
    saveProfile,
    listActiveProjects: async () => [],
  } as never;
  render(<App />);

  await revealSplash();
  await screen.findByRole('heading', { name: '配置模型连接' });
  fireEvent.click(screen.getByRole('button', { name: '跳过，稍后设置' }));
  await waitFor(() => expect(screen.getByRole('textbox', { name: '设计需求' })).toBeVisible());
  expect(saveProfile).toHaveBeenCalledWith({ onboarding: { modelStepCompleted: true } });
});

it('enters Studio directly after completed onboarding and restores the avatar', async () => {
  vi.useFakeTimers();
  window.designhub = {
    loadProfile: async () => completedProfile,
    getProjectLibraryStatus: async () => ({ state: 'ready', library }),
    listActiveProjects: async () => [],
  } as never;
  render(<App />);

  await revealSplash();
  expect(await screen.findByRole('img', { name: '用户头像' })).toHaveAttribute('src', completedProfile.avatarDataUrl);
  expect(screen.getByRole('textbox', { name: '设计需求' })).toBeVisible();
});

it('keeps the profile step when project-library selection is cancelled', async () => {
  vi.useFakeTimers();
  window.designhub = {
    loadProfile: async () => null,
    getProjectLibraryStatus: async () => ({ state: 'unselected' }),
    chooseProjectLibrary: vi.fn(async () => null),
  } as never;
  render(<App />);
  await revealSplash();
  fireEvent.change(screen.getByRole('textbox', { name: '昵称' }), { target: { value: 'Sifan' } });
  fireEvent.click(screen.getByRole('button', { name: '选择存储文件夹' }));
  expect(screen.getByRole('textbox', { name: '昵称' })).toHaveValue('Sifan');
  expect(screen.getByText('尚未选择存储文件夹')).toBeVisible();
});

it('switches language and theme without leaving the active onboarding step', async () => {
  vi.useFakeTimers();
  window.designhub = { loadProfile: async () => null, getProjectLibraryStatus: async () => ({ state: 'unselected' }) } as never;
  render(<App />);
  await revealSplash();
  const title = screen.getByRole('heading', { name: '设置你的资料' });
  fireEvent.click(screen.getByRole('button', { name: '切换主题' }));
  expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'dark');
  expect(screen.getByRole('heading', { name: '设置你的资料' })).toBe(title);
  fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
  expect(screen.getByRole('heading', { name: 'Set up your profile' })).toBeVisible();
});
