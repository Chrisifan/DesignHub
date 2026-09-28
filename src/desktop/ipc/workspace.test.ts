import { expect, it } from 'vitest';

import { isTrustedProjectLibraryRequest } from './workspace';
import { createProjectContainerHandler, listActiveProjectsHandler } from './projects';

const createFixture = () => {
  const mainFrame = { url: 'file:///app/index.html' };
  const window = { webContents: { mainFrame, getURL: () => mainFrame.url } };
  const event = { sender: window.webContents, senderFrame: mainFrame };
  return { window, event, trustedUrl: mainFrame.url };
};

it('gates project-library operations on the trusted renderer and active library identity', async () => {
  const { window, event, trustedUrl } = createFixture();
  const library = { library: { libraryId: 'library-1' } } as never;
  const listProjects = async () => [{ projectId: 'project-1', name: 'A project' }];
  await expect(listActiveProjectsHandler(window as never, trustedUrl, () => library, listProjects)(event as never, 'library-1')).resolves.toEqual([
    { projectId: 'project-1', name: 'A project' },
  ]);
  const createProject = async (_library: unknown, input: { name: string }) => ({ projectId: `created-${input.name}` });
  await expect(createProjectContainerHandler(window as never, trustedUrl, () => library, createProject)(event as never, {
    libraryId: 'library-1', operationId: 'op-1', name: 'New project',
  })).resolves.toEqual({ projectId: 'created-New project' });
  await expect(listActiveProjectsHandler(window as never, trustedUrl, () => library, listProjects)(event as never, 'other')).resolves.toBeNull();
  expect(isTrustedProjectLibraryRequest(event as never, window as never, trustedUrl)).toBe(true);
});

it('rejects an untrusted renderer before reaching project-library storage', async () => {
  const { window, event, trustedUrl } = createFixture();
  const library = { library: { libraryId: 'library-1' } } as never;
  const listProjects = async () => [{ projectId: 'project-1', name: 'A project' }];
  const untrusted = { ...event, senderFrame: { url: 'file:///app/evil.html' } };
  await expect(listActiveProjectsHandler(window as never, trustedUrl, () => library, listProjects)(untrusted as never, 'library-1')).resolves.toBeNull();
});
