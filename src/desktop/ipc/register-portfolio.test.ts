import { portfolioDiscardChannel, portfolioInspectChannel, portfolioSelectChannel } from './portfolio';
import { registerPortfolioHandlers } from './register-portfolio';

describe('registerPortfolioHandlers', () => {
  it('registers inspection, selection, and discard channels', () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();

    registerPortfolioHandlers({
      ipc: {
        handle: (channel, listener) => {
          registrations.set(channel, listener as (...args: unknown[]) => unknown);
        },
      },
      getWindow: () => ({ webContents: {} } as never),
      getTrustedUrl: () => 'http://localhost:5173',
      getLibrary: () => null,
      chooseFiles: vi.fn(),
      inspector: {} as never,
      submit: vi.fn(),
    });

    expect([...registrations.keys()]).toEqual([
      portfolioInspectChannel,
      portfolioSelectChannel,
      portfolioDiscardChannel,
    ]);
  });

  it('returns null or false when the trusted window context is unavailable', async () => {
    const registrations = new Map<string, (...args: unknown[]) => unknown>();

    registerPortfolioHandlers({
      ipc: {
        handle: (channel, listener) => {
          registrations.set(channel, listener as (...args: unknown[]) => unknown);
        },
      },
      getWindow: () => null,
      getTrustedUrl: () => null,
      getLibrary: () => null,
      chooseFiles: vi.fn(),
      inspector: {} as never,
      submit: vi.fn(),
    });

    const event = {};
    expect(await registrations.get(portfolioInspectChannel)?.(event, {})).toBeNull();
    expect(await registrations.get(portfolioSelectChannel)?.(event, {})).toBeNull();
    expect(registrations.get(portfolioDiscardChannel)?.(event, {})).toBe(false);
  });
});
