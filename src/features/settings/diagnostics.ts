export type DiagnosticField = 'runtime' | 'errorCode' | 'projectPath' | 'prompt' | 'credential';
export type DiagnosticInput = Partial<Record<DiagnosticField, string>>;

export const isDiagnosticFieldAllowed = (field: DiagnosticField): boolean => field === 'runtime' || field === 'errorCode';

export const buildDiagnosticPreview = (input: DiagnosticInput): Pick<DiagnosticInput, 'runtime' | 'errorCode'> => ({
  ...(typeof input.runtime === 'string' ? { runtime: input.runtime } : {}),
  ...(typeof input.errorCode === 'string' ? { errorCode: input.errorCode } : {}),
});

const isSafeDiagnosticText = (value: string): boolean => value.length > 0
  && value.length <= 256
  && !/[\\/]/u.test(value)
  && !/[\u0000-\u001f]/u.test(value);

export const serializeDiagnosticPackage = (input: DiagnosticInput): string => {
  const preview = buildDiagnosticPreview(input);
  if ((preview.runtime && !isSafeDiagnosticText(preview.runtime)) || (preview.errorCode && !isSafeDiagnosticText(preview.errorCode))) {
    throw new Error('DIAGNOSTIC_SENSITIVE_DATA');
  }
  return JSON.stringify(preview);
};
