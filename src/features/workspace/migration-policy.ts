export type MigrationPolicyInput = {
  backupVerified: boolean;
  writable: boolean;
  from: number;
  to: number;
};

export const canMigrate = (input: MigrationPolicyInput): boolean => input.backupVerified
  && input.writable
  && input.from < input.to;
