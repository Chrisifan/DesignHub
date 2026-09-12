import { expect, it } from 'vitest';
import { createCredentialStoreHandler } from './credentials';

const makeFixture = (url: string) => {
  const mainFrame = { url };
  const webContents = { mainFrame, getURL: () => url };
  return { event: { sender: webContents, senderFrame: mainFrame }, window: { webContents }, webContents };
};

it('accepts only the canonical trusted renderer location', async () => {
  const fixture = makeFixture('http://localhost:5173/?mode=preview');
  let stored = false;
  const boundary = { storeCredential: async () => { stored = true; return true; }, deleteCredential: async () => true };
  const handler = createCredentialStoreHandler(fixture.window, 'http://localhost:5173/?mode=preview', boundary);
  await handler(fixture.event, 'provider-1', 'secret');
  expect(stored).toBe(true);

  const altered = makeFixture('http://localhost:5173/?mode=other');
  const rejected = await handler(altered.event, 'provider-1', 'secret');
  expect(rejected).toBe(false);
});
