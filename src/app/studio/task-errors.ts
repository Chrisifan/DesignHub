import type { Locale } from '../i18n';
import { isSafeProviderCode, type TaskProviderFailure, type TaskRecord } from '../../features/tasks/state';

const bridgeErrorCodes = [
  'INVALID_TASK_STATE',
  'DOCUMENT_SCHEMA_REMOVED',
  'PROJECT_LIBRARY_NOT_OPEN',
  'SYSTEM_CREDENTIAL_STORE_READ_FAILED',
  'PROVIDER_API_KEY_REQUIRED',
  'PROVIDER_NOT_CONFIGURED',
  'INVALID_PROVIDER_CONFIG',
] as const;

export type TaskBridgeErrorCode = typeof bridgeErrorCodes[number];

export const taskBridgeErrorCode = (error: unknown): TaskBridgeErrorCode | null => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return bridgeErrorCodes.find((code) => new RegExp(`(?:^|[^A-Z0-9_])${code}(?:$|[^A-Z0-9_])`, 'u').test(message)) ?? null;
};

export const taskLoadErrorMessage = (locale: Locale, error: unknown): string => {
  const code = taskBridgeErrorCode(error);
  if (code === 'INVALID_TASK_STATE') {
    return locale === 'zh-CN'
      ? '任务历史格式异常（INVALID_TASK_STATE）。原文件未被覆盖，请重试读取或导出诊断。'
      : 'Task history has an invalid format (INVALID_TASK_STATE). The source file was not overwritten; retry or export diagnostics.';
  }
  if (code === 'DOCUMENT_SCHEMA_REMOVED') {
    return locale === 'zh-CN'
      ? '检测到不再支持的旧文档任务（DOCUMENT_SCHEMA_REMOVED）。原文件未被修改。'
      : 'Unsupported legacy document tasks were detected (DOCUMENT_SCHEMA_REMOVED). The source file was not modified.';
  }
  return locale === 'zh-CN'
    ? '任务读取失败（TASK_LIST_UNAVAILABLE）。原有任务不会被覆盖。'
    : 'Could not load tasks (TASK_LIST_UNAVAILABLE). Existing task records were not overwritten.';
};

export const taskSubmissionErrorMessage = (locale: Locale, error: unknown): string => {
  const code = taskBridgeErrorCode(error);
  if (code === 'INVALID_TASK_STATE') {
    return locale === 'zh-CN'
      ? '任务历史格式异常（INVALID_TASK_STATE），本次请求尚未发送到模型。'
      : 'Task history has an invalid format (INVALID_TASK_STATE); this request was not sent to the model.';
  }
  if (code === 'DOCUMENT_SCHEMA_REMOVED') {
    return locale === 'zh-CN'
      ? '检测到不兼容的旧文档任务（DOCUMENT_SCHEMA_REMOVED），本次请求尚未发送到模型。'
      : 'Unsupported legacy document tasks were detected (DOCUMENT_SCHEMA_REMOVED); this request was not sent to the model.';
  }
  if (code === 'PROJECT_LIBRARY_NOT_OPEN') {
    return locale === 'zh-CN'
      ? '项目库未打开（PROJECT_LIBRARY_NOT_OPEN），任务未提交。'
      : 'The project library is not open (PROJECT_LIBRARY_NOT_OPEN); the task was not submitted.';
  }
  if (code === 'SYSTEM_CREDENTIAL_STORE_READ_FAILED' || code === 'PROVIDER_API_KEY_REQUIRED') {
    return locale === 'zh-CN'
      ? `无法读取模型凭据（${code}），本次请求尚未发送到模型。请重新保存密钥。`
      : `Model credentials could not be read (${code}); this request was not sent. Save the key again.`;
  }
  if (code === 'PROVIDER_NOT_CONFIGURED' || code === 'INVALID_PROVIDER_CONFIG') {
    return locale === 'zh-CN'
      ? `模型连接配置无效（${code}），本次请求尚未发送。`
      : `The model connection configuration is invalid (${code}); this request was not sent.`;
  }
  return locale === 'zh-CN'
    ? '任务提交失败（TASK_SUBMISSION_FAILED）。连接测试通过不代表本次请求成功，请重试或查看任务记录。'
    : 'Task submission failed (TASK_SUBMISSION_FAILED). A passed connection test does not guarantee this request succeeded; retry or inspect the task history.';
};

const taskErrorMessages: Record<string, [string, string]> = {
  PROVIDER_UNAVAILABLE: ['模型服务不可用', 'Model provider unavailable'],
  PROVIDER_REQUEST_FAILED: ['模型请求失败', 'Model request failed'],
  EMPTY_PROVIDER_RESPONSE: ['模型返回空响应', 'The model returned an empty response'],
  DESIGN_GENERATION_ALL_FAILED: ['所有候选设计生成失败', 'All design candidates failed'],
  RESULT_DIMENSIONS_INVALID: ['返回图片尺寸不符合工具参数', 'Returned image dimensions do not match the tool parameters'],
  RESULT_UNKNOWN_AFTER_RESTART: ['应用重启后无法确认远端结果', 'The remote result could not be confirmed after restart'],
  RESULT_UNKNOWN_AFTER_CANCEL: ['取消后无法确认远端结果', 'The remote result could not be confirmed after cancellation'],
  CANCELLED: ['任务已取消', 'Task cancelled'],
};

const safeTaskErrorCode = (value: unknown): string | null => typeof value === 'string'
  && Object.hasOwn(taskErrorMessages, value)
  ? value
  : null;

const providerFailureMessage = (locale: Locale, failure: TaskProviderFailure): string => {
  const details = [
    failure.status === undefined ? undefined : `HTTP ${failure.status}`,
    isSafeProviderCode(failure.providerCode) ? failure.providerCode : undefined,
  ].filter((value): value is string => Boolean(value)).join(locale === 'zh-CN' ? '，' : ', ');
  const suffix = details ? `（${details}）` : '';
  if (failure.kind === 'rate_limited') {
    return locale === 'zh-CN'
      ? `服务请求受限${suffix}${failure.retryAfterSeconds === undefined ? '' : `，${failure.retryAfterSeconds} 秒后可重试`}`
      : `Provider rate limit${details ? ` (${details})` : ''}${failure.retryAfterSeconds === undefined ? '' : `; retry in ${failure.retryAfterSeconds}s`}`;
  }
  if (failure.kind === 'invalid_response') return locale === 'zh-CN' ? `服务返回了无法解析的结果${suffix}` : `Provider returned an unreadable result${details ? ` (${details})` : ''}`;
  if (failure.kind === 'cancelled') return locale === 'zh-CN' ? '服务请求已取消' : 'Provider request was cancelled';
  return locale === 'zh-CN' ? `服务请求被拒绝${suffix}` : `Provider request was rejected${details ? ` (${details})` : ''}`;
};

const taskErrorCodeMessage = (locale: Locale, code: string): string => {
  const message = taskErrorMessages[code];
  const label = locale === 'zh-CN' ? message[0] : message[1];
  return `${label}（${code}）`;
};

export const taskFailureMessage = (locale: Locale, task: TaskRecord): string | undefined => {
  const failure = task.providerFailure
    ?? task.generationSlots?.find((slot) => slot.state === 'failed' && slot.providerFailure)?.providerFailure;
  const code = safeTaskErrorCode(task.errorCode);
  const codeMessage = code ? taskErrorCodeMessage(locale, code) : undefined;
  const providerMessage = failure ? providerFailureMessage(locale, failure) : undefined;
  return [codeMessage, providerMessage].filter((value): value is string => Boolean(value)).join(' · ') || undefined;
};
