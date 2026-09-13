import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { normalizeProviderConfigs, type ProviderConfigMap } from '../../features/providers/config';

export type { ProviderConfigMap } from '../../features/providers/config';

const isMissing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

const assertRegularFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROVIDER_CONFIG');
  } catch (error) {
    if (allowMissing && isMissing(error)) return;
    if (error instanceof Error && error.message === 'INVALID_PROVIDER_CONFIG') throw error;
    throw new Error('INVALID_PROVIDER_CONFIG');
  }
};

export const loadProviderConfigs = async (path: string): Promise<ProviderConfigMap> => {
  assertRegularFile(path, true);
  try {
    await access(path, constants.R_OK);
  } catch (error) {
    if (isMissing(error)) return {};
    throw new Error('INVALID_PROVIDER_CONFIG');
  }
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    const configs = normalizeProviderConfigs(parsed);
    if (!configs) throw new Error('INVALID_PROVIDER_CONFIG');
    return structuredClone(configs);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROVIDER_CONFIG') throw error;
    throw new Error('INVALID_PROVIDER_CONFIG');
  }
};

export const saveProviderConfigs = async (path: string, configs: ProviderConfigMap): Promise<boolean> => {
  const normalized = normalizeProviderConfigs(configs);
  if (!normalized) throw new Error('INVALID_PROVIDER_CONFIG');
  assertRegularFile(path, true);
  const temporary = join(dirname(path), `.${randomUUID()}.provider-config.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
