export const reuseProject = (
  operations: Readonly<Record<string, string>>,
  operationId: string,
): string | null => operations[operationId] ?? null;
