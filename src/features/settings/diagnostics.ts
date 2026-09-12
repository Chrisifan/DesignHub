export type DiagnosticField = 'runtime' | 'errorCode' | 'projectPath' | 'prompt' | 'credential';
export type DiagnosticInput = Partial<Record<DiagnosticField, string>>;

export const isDiagnosticFieldAllowed = (field: DiagnosticField): boolean => field === 'runtime' || field === 'errorCode';

export const buildDiagnosticPreview = (input: DiagnosticInput): Pick<DiagnosticInput, 'runtime' | 'errorCode'> => ({
  ...(typeof input.runtime === 'string' ? { runtime: input.runtime } : {}),
  ...(typeof input.errorCode === 'string' ? { errorCode: input.errorCode } : {}),
});

export const serializeDiagnosticPackage = (input: DiagnosticInput): string => JSON.stringify(buildDiagnosticPreview(input));
