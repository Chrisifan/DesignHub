import { expect, it } from 'vitest';

import {
  AGENT_TOOL_ALLOWLIST,
  validateAgentToolRequest,
} from '../../src/features/agent/tool-contracts';

it('exposes only the M04, M05, and M07 tool contracts', () => {
  expect(AGENT_TOOL_ALLOWLIST).toEqual([
    'resolve-constraint',
    'inspect-scene',
    'execute-image-tool',
    'commit-revision',
  ]);
  expect(validateAgentToolRequest({ tool: 'run-shell', target: {}, params: {} })).toEqual({
    ok: false,
    reason: 'TOOL_NOT_ALLOWED',
  });
});
it('requires a project target and object parameters for an allowed tool', () => {
  expect(validateAgentToolRequest({ tool: 'inspect-scene', target: {}, params: {} })).toEqual({
    ok: false,
    reason: 'TARGET_REQUIRED',
  });
  expect(validateAgentToolRequest({ tool: 'inspect-scene', target: { projectId: 'p1' }, params: null })).toEqual({
    ok: false,
    reason: 'PARAMS_REQUIRED',
  });
  expect(validateAgentToolRequest({ tool: 'inspect-scene', target: { projectId: 'p1' }, params: {} })).toEqual({ ok: true });
});

it('rejects target identifiers that attempt to escape the project boundary', () => {
  expect(validateAgentToolRequest({
    tool: 'execute-image-tool',
    target: { projectId: 'p1', layerId: '../other-project' },
    params: { operation: 'resize' },
  })).toEqual({ ok: false, reason: 'INVALID_TARGET' });
});
