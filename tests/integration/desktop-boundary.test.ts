import { expect, it } from 'vitest';

import { isTrustedProjectLibraryRequest } from '../../src/desktop/ipc/workspace';

it('accepts only the trusted project-library renderer frame', () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const trusted = { sender: window.webContents, senderFrame: mainFrame };
  const external = { sender: window.webContents, senderFrame: { url: 'https://example.com' } };
  expect(isTrustedProjectLibraryRequest(trusted, window, 'file:///app/index.html')).toBe(true);
  expect(isTrustedProjectLibraryRequest(external, window, 'file:///app/index.html')).toBe(false);
  expect(isTrustedProjectLibraryRequest(trusted, window, 'file:///app/other.html')).toBe(false);
});

it('keeps canonical development URL checks strict', () => {
  const mainFrame = { url: 'http://127.0.0.1:5173/' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  expect(isTrustedProjectLibraryRequest(event, window, 'http://127.0.0.1:5173')).toBe(true);
  expect(isTrustedProjectLibraryRequest(event, window, 'http://localhost:5173/')).toBe(false);
});
