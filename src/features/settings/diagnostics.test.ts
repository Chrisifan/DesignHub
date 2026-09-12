import { expect, it } from 'vitest';
import { isDiagnosticFieldAllowed, buildDiagnosticPreview } from './diagnostics';

it('本地诊断包只接受脱敏白名单字段', () => {
  expect(isDiagnosticFieldAllowed('runtime')).toBe(true);
  expect(isDiagnosticFieldAllowed('errorCode')).toBe(true);
  expect(isDiagnosticFieldAllowed('projectPath')).toBe(false);
  expect(isDiagnosticFieldAllowed('prompt')).toBe(false);
  expect(isDiagnosticFieldAllowed('credential')).toBe(false);
});

it('诊断预览只包含运行时和错误码', () => {
  expect(buildDiagnosticPreview({ runtime: 'Electron', errorCode: 'E01', prompt: 'hidden', projectPath: '/private' })).toEqual({ runtime: 'Electron', errorCode: 'E01' });
});
