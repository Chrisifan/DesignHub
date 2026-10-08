import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { constants, lstatSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

import { providerConnectionIds, providerProfiles, type ProviderProfile } from '../../features/providers/config';
import type { ProviderConnectionStatusMap, ProviderProfileStatus } from '../../features/providers/status';

const isMissing = (error: unknown): boolean => typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const assertRegularFile = (path: string, allowMissing: boolean): void => {
  try {
    const status = lstatSync(path);
    if (!status.isFile() || status.isSymbolicLink()) throw new Error('INVALID_PROVIDER_STATUS');
  } catch (error) {
    if (allowMissing && isMissing(error)) return;
    if (error instanceof Error && error.message === 'INVALID_PROVIDER_STATUS') throw error;
    throw new Error('INVALID_PROVIDER_STATUS');
  }
};

const normalizeStatus = (value: unknown): ProviderProfileStatus | null => {
  if (!isRecord(value) || !['connected', 'error'].includes(String(value.status)) || typeof value.testedAt !== 'string' || typeof value.configFingerprint !== 'string') return null;
  return { status: value.status as ProviderProfileStatus['status'], testedAt: value.testedAt, configFingerprint: value.configFingerprint };
};

const normalizeStatuses = (value: unknown): ProviderConnectionStatusMap | null => {
  if (!isRecord(value)) return null;
  const normalized: ProviderConnectionStatusMap = {};
  for (const [connectionId, rawProfiles] of Object.entries(value)) {
    if (!providerConnectionIds.includes(connectionId as typeof providerConnectionIds[number]) || !isRecord(rawProfiles)) return null;
    const profiles: Partial<Record<ProviderProfile, ProviderProfileStatus>> = {};
    for (const profile of providerProfiles) {
      if (rawProfiles[profile] !== undefined) {
        const status = normalizeStatus(rawProfiles[profile]);
        if (!status) return null;
        profiles[profile] = status;
      }
    }
    if (Object.keys(rawProfiles).some((key) => !providerProfiles.includes(key as ProviderProfile))) return null;
    normalized[connectionId as typeof providerConnectionIds[number]] = profiles;
  }
  return normalized;
};

export const loadProviderConnectionStatuses = async (path: string): Promise<ProviderConnectionStatusMap> => {
  assertRegularFile(path, true);
  try { await access(path, constants.R_OK); } catch (error) { if (isMissing(error)) return {}; throw new Error('INVALID_PROVIDER_STATUS'); }
  try {
    const parsed = normalizeStatuses(JSON.parse(await readFile(path, 'utf8')));
    if (!parsed) throw new Error('INVALID_PROVIDER_STATUS');
    return structuredClone(parsed);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_PROVIDER_STATUS') throw error;
    throw new Error('INVALID_PROVIDER_STATUS');
  }
};

export const saveProviderConnectionStatuses = async (path: string, statuses: ProviderConnectionStatusMap): Promise<boolean> => {
  const normalized = normalizeStatuses(statuses);
  if (!normalized) throw new Error('INVALID_PROVIDER_STATUS');
  assertRegularFile(path, true);
  const temporary = join(dirname(path), `.${randomUUID()}.provider-status.tmp`);
  try {
    await writeFile(temporary, `${JSON.stringify(normalized, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return true;
};
