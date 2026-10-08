import type { PortfolioAnalysisDiagnostic, TaskProviderFailure, TaskRecord } from '../tasks/state';
import type { TaskRuntime } from '../tasks/runtime';
import { isPortfolioAnalysisDiagnostic, isSafeProviderCode } from '../tasks/state';

export const classifyTaskErrorCode = (error: unknown): string => {
  if (error && typeof error === 'object' && 'kind' in error && typeof error.kind === 'string') return error.kind;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError') return 'CANCELLED';
  if (error instanceof Error && /^[A-Z][A-Z0-9_]{2,63}$/u.test(error.message)) return error.message;
  return 'PROVIDER_REQUEST_FAILED';
};

export const providerFailure = (error: unknown): TaskProviderFailure | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as Record<string, unknown>;
  const kind = value.kind;
  if (kind !== 'http' && kind !== 'rate_limited' && kind !== 'invalid_response' && kind !== 'cancelled') return undefined;
  const status = typeof value.status === 'number' && Number.isInteger(value.status) && value.status >= 100 && value.status <= 599
    ? value.status : undefined;
  const providerCode = isSafeProviderCode(value.providerCode) ? value.providerCode : undefined;
  const retryAfterSeconds = typeof value.retryAfterSeconds === 'number' && Number.isFinite(value.retryAfterSeconds)
    && value.retryAfterSeconds >= 0 && value.retryAfterSeconds <= 86_400 ? Math.ceil(value.retryAfterSeconds) : undefined;
  return {
    kind,
    ...(status === undefined ? {} : { status }),
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
};

export const analysisDiagnostic = (error: unknown): PortfolioAnalysisDiagnostic | undefined => {
  if (!error || typeof error !== 'object') return undefined;
  const value = (error as Record<string, unknown>).analysisDiagnostic;
  return isPortfolioAnalysisDiagnostic(value) ? value : undefined;
};

export const failTask = async (runtime: TaskRuntime, taskId: string, error: unknown): Promise<TaskRecord> => (
  runtime.fail(taskId, classifyTaskErrorCode(error), providerFailure(error), analysisDiagnostic(error))
);
