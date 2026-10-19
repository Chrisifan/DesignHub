import { describe, expect, it } from 'vitest';

import type { TaskRecord } from '../../features/tasks/state';
import {
  getForegroundPresenceTask,
  getObservedTerminalOutcome,
  getTerminalPresenceOutcome,
} from './neural-presence-state';

const task = (input: Pick<TaskRecord, 'id' | 'capability' | 'state'> & { createdAt: string; analysisThreadId?: string }): TaskRecord => ({
  ...input,
  requestId: `${input.id}-request`,
  cancelRequested: false,
  attempt: 1,
});

describe('getForegroundPresenceTask', () => {
  it.each([
    ['conversation', 'thinking'],
    ['design-generation', 'working'],
    ['image-editing', 'working'],
    ['local-transform', 'working'],
  ] as const)('maps active %s work to %s', (capability, mode) => {
    const activeTask = task({ id: 'task-1', capability, state: 'running', createdAt: '2026-10-19T10:00:00Z', analysisThreadId: 'thread-1' });

    expect(getForegroundPresenceTask([activeTask], 'thread-1')).toMatchObject({ taskId: 'task-1', mode });
  });

  it('selects the most recently started active operation', () => {
    const analysis = task({ id: 'analysis', capability: 'conversation', state: 'running', createdAt: '2026-10-19T10:00:00Z', analysisThreadId: 'thread-1' });
    const edit = task({ id: 'edit', capability: 'image-editing', state: 'queued', createdAt: '2026-10-19T10:01:00Z' });

    expect(getForegroundPresenceTask([analysis, edit], 'thread-1')).toMatchObject({ taskId: 'edit', mode: 'working' });
  });

  it('ignores conversations and design generations from another thread', () => {
    const otherThreadAnalysis = task({ id: 'analysis', capability: 'conversation', state: 'running', createdAt: '2026-10-19T10:00:00Z', analysisThreadId: 'thread-2' });
    const otherThreadDesign = task({ id: 'design', capability: 'design-generation', state: 'queued', createdAt: '2026-10-19T10:01:00Z', analysisThreadId: 'thread-2' });

    expect(getForegroundPresenceTask([otherThreadAnalysis, otherThreadDesign], 'thread-1')).toBeNull();
  });

  it('ignores terminal records when selecting active work', () => {
    const completed = task({ id: 'done', capability: 'design-generation', state: 'completed', createdAt: '2026-10-19T10:00:00Z', analysisThreadId: 'thread-1' });

    expect(getForegroundPresenceTask([completed], 'thread-1')).toBeNull();
  });
});

describe('terminal outcome feedback', () => {
  it('maps only explicit completion and failure to visual outcomes', () => {
    expect(getTerminalPresenceOutcome('completed')).toBe('success');
    expect(getTerminalPresenceOutcome('failed')).toBe('failure');
    expect(getTerminalPresenceOutcome('cancelled')).toBeNull();
    expect(getTerminalPresenceOutcome('unknown')).toBeNull();
    expect(getTerminalPresenceOutcome('running')).toBeNull();
  });

  it('emits feedback only for a running task transitioning to a terminal outcome', () => {
    expect(getObservedTerminalOutcome('running', 'completed')).toBe('success');
    expect(getObservedTerminalOutcome('queued', 'failed')).toBe('failure');
    expect(getObservedTerminalOutcome(undefined, 'completed')).toBeNull();
    expect(getObservedTerminalOutcome('completed', 'completed')).toBeNull();
    expect(getObservedTerminalOutcome('running', 'cancelled')).toBeNull();
  });
});
