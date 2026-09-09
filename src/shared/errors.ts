export type PublicErrorCode = 'DISK_FULL' | 'READ_ONLY' | 'UNKNOWN';

const messages: Record<PublicErrorCode, string> = {
  DISK_FULL: '磁盘空间不足，请释放空间后重试保存。',
  READ_ONLY: '当前内容为只读，请在可写工作区中继续。',
  UNKNOWN: '操作未完成，请重试或查看诊断。',
};

export const userMessage = (code: PublicErrorCode): string => messages[code];
