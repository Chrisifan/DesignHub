import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { ImageResponseLog } from '../features/providers/adapter';

export const appendImageResponseLog = async (
  directory: string,
  record: ImageResponseLog,
  dependencies: {
    append?: typeof appendFile;
    makeDirectory?: typeof mkdir;
    timestamp?: string;
  } = {},
): Promise<void> => {
  const makeDirectory = dependencies.makeDirectory ?? mkdir;
  const write = dependencies.append ?? appendFile;
  await makeDirectory(directory, { recursive: true });
  await write(join(directory, 'image-generation.jsonl'), `${JSON.stringify({ timestamp: dependencies.timestamp ?? new Date().toISOString(), ...record })}\n`, 'utf8');
};
