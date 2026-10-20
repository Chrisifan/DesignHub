import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import type { ActiveProject } from '../../features/workspace/project-store';
import { createProjectMetadata } from '../../features/projects/metadata';
import type { Project } from './types';
import { Studio } from './Studio';

vi.mock('./ProjectCanvas', () => ({
  ProjectCanvas: ({ project, onBack, onGenerationRatioChange }: { project: Project; onBack: () => void; onGenerationRatioChange: (ratio: '1:1') => void }) => (
    <div>
      <output aria-label="Project update time">{project.updatedAt}</output>
      <button onClick={() => onGenerationRatioChange('1:1')}>Update project</button>
      <button onClick={onBack}>Return home</button>
    </div>
  ),
}));

const originalDesktopApi = window.designhub;
afterEach(() => { window.designhub = originalDesktopApi; });

const library = { libraryId: 'workspace-1', directory: '/workspace', formatVersion: 1, openMode: 'writable' as const };
const projects: ActiveProject[] = [
  { projectId: 'older', name: 'A older', updatedAt: '2026-10-19T00:00:00.000Z' },
  { projectId: 'newer', name: 'Z newer', updatedAt: '2026-10-20T00:00:00.000Z' },
];
const renderStudio = () => render(<Studio library={library} locale="en" theme="light" onLocaleChange={vi.fn()} onThemeChange={vi.fn()} />);

it('keeps the updated timestamp returned by a project edit', async () => {
  const metadata = createProjectMetadata({ projectId: 'older', workspaceId: library.libraryId, name: 'A older', updatedAt: '2026-10-21T00:00:00.000Z' });
  window.designhub = { listActiveProjects: vi.fn(async () => projects), updateProjectMetadata: vi.fn(async () => metadata) };
  renderStudio();
  fireEvent.click(await screen.findByRole('button', { name: 'A older' }));
  fireEvent.click(screen.getByRole('button', { name: 'Update project' }));
  await waitFor(() => expect(screen.getByLabelText('Project update time')).toHaveTextContent(metadata.updatedAt));
});

it('reloads persisted update times when returning from the canvas so the latest edited project moves first', async () => {
  let persisted = projects;
  const listActiveProjects = vi.fn(async () => persisted);
  window.designhub = { listActiveProjects };
  const { container } = renderStudio();
  fireEvent.click(await screen.findByRole('button', { name: 'A older' }));
  persisted = projects.map((project) => project.projectId === 'older' ? { ...project, updatedAt: '2026-10-21T00:00:00.000Z' } : project);
  fireEvent.click(screen.getByRole('button', { name: 'Return home' }));
  await waitFor(() => expect(listActiveProjects).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(Array.from(container.querySelectorAll('.studio-home-project-row')).map((row) => row.getAttribute('aria-label'))).toEqual(['A older', 'Z newer']));
});
