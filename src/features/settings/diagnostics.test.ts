import { expect, it } from 'vitest';
import { isDiagnosticFieldAllowed, buildDiagnosticPreview, serializeDiagnosticPackage } from './diagnostics';

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

it('序列化诊断包拒绝路径、提示词和超长值', () => {
  expect(() => serializeDiagnosticPackage({ runtime: 'Electron /Users/alice', errorCode: 'E01' })).toThrow('DIAGNOSTIC_SENSITIVE_DATA');
  expect(() => serializeDiagnosticPackage({ runtime: 'Electron', errorCode: 'x'.repeat(257) })).toThrow('DIAGNOSTIC_SENSITIVE_DATA');
  expect(serializeDiagnosticPackage({ runtime: 'Electron', errorCode: 'E01', prompt: 'hidden' })).toBe('{"runtime":"Electron","errorCode":"E01"}');
});

it('诊断包序列化结果不含敏感字段或值', () => {
  const serialized = serializeDiagnosticPackage({ runtime: 'Electron', errorCode: 'E01', credential: 'secret', prompt: 'private prompt', projectPath: '/tmp/project' });
  expect(serialized).not.toMatch(/credential|prompt|projectPath|secret|private prompt|\/tmp/iu);
  expect(Object.keys(JSON.parse(serialized) as Record<string, unknown>)).toEqual(['runtime', 'errorCode']);
});
