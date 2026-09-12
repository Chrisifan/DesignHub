import { expect, it, vi } from 'vitest';

import { exportDiagnosticsHandler } from './diagnostics';

const fixture = () => {
  const url = 'http://localhost:5173/?preview=1';
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents }, url };
};

it('exports only a diagnostic preview through the trusted renderer boundary', async () => {
  const context = fixture();
  const write = vi.fn(async () => '/tmp/designhub-diagnostics.json');
  const handler = exportDiagnosticsHandler(context.window, context.url, write);
  await expect(handler(context.event, { runtime: 'Electron', errorCode: null })).resolves.toBe('/tmp/designhub-diagnostics.json');
  expect(write).toHaveBeenCalledWith(expect.objectContaining({ runtime: 'Electron' }));
  await expect(handler(context.event, { runtime: 'Electron', secret: 'nope' })).resolves.toBeNull();
});
