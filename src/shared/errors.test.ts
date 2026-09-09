import { expect, it } from 'vitest';

import { userMessage } from './errors';

it('provides a recovery action when saving fails because the disk is full', () => {
  expect(userMessage('DISK_FULL')).toBe('磁盘空间不足，请释放空间后重试保存。');
});

it('maps every public error code to a fixed user-safe message', () => {
  expect(userMessage('READ_ONLY')).toBe('当前内容为只读，请在可写工作区中继续。');
  expect(userMessage('UNKNOWN')).toBe('操作未完成，请重试或查看诊断。');
});
