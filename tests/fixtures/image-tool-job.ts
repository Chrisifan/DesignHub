import { createImageToolJob, type ImageToolItem, type ImageToolJob, type ImageToolJobTool, type ToolExecutor } from '../../src/features/image-tools/jobs';

export type ImageToolJobFixture = { job: ImageToolJob; items: ImageToolItem[] };

export const createImageToolJobFixture = (overrides: Partial<ImageToolJob> = {}, itemOverrides: Partial<ImageToolItem> = {}): ImageToolJobFixture => {
  const now = '2026-10-07T00:00:00.000Z';
  const id = overrides.id ?? 'job-fixture';
  const tool = (overrides.tool ?? 'resize') as ImageToolJobTool;
  const executor = overrides.executor ?? (tool === 'resize' || tool === 'format-convert'
    ? { kind: 'local', engine: 'image-codec' } satisfies ToolExecutor
    : { kind: 'provider', connectionId: 'connection-fixture', modelId: 'model-fixture' } satisfies ToolExecutor);
  const itemId = itemOverrides.id ?? `${id}-item-1`;
  const item: ImageToolItem = {
    id: itemId,
    jobId: id,
    relativePath: 'input.png',
    state: 'queued',
    attempt: 1,
    updatedAt: now,
    ...itemOverrides,
  };
  const job = createImageToolJob({
    id,
    tool,
    params: overrides.params ?? { width: 1024, height: 1024 },
    sourceRoot: overrides.sourceRoot ?? '/tmp/designhub-fixture-source',
    outputRoot: overrides.outputRoot ?? '/tmp/designhub-fixture-output',
    itemIds: overrides.itemIds ?? [itemId],
    libraryId: overrides.libraryId ?? 'library-fixture',
    executor,
    schemaVersion: overrides.schemaVersion,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  });
  return { job: { ...job, ...overrides }, items: [item] };
};
