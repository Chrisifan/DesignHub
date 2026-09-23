export type AppProfile = {
  formatVersion: 1;
  displayName: string;
  avatarDataUrl: string | null;
  onboarding: {
    profileCompleted: boolean;
    modelStepCompleted: boolean;
  };
};

export type ProfilePatch = Partial<Pick<AppProfile, 'displayName' | 'avatarDataUrl'>> & {
  onboarding?: Partial<AppProfile['onboarding']>;
};

export const emptyAppProfile = (): AppProfile => ({
  formatVersion: 1,
  displayName: '',
  avatarDataUrl: null,
  onboarding: {
    profileCompleted: false,
    modelStepCompleted: false,
  },
});

export const isAppProfile = (value: unknown): value is AppProfile => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const profile = value as Record<string, unknown>;
  if (profile.formatVersion !== 1 || typeof profile.displayName !== 'string') return false;
  if (profile.avatarDataUrl !== null && typeof profile.avatarDataUrl !== 'string') return false;
  if (typeof profile.onboarding !== 'object' || profile.onboarding === null || Array.isArray(profile.onboarding)) return false;
  const onboarding = profile.onboarding as Record<string, unknown>;
  return typeof onboarding.profileCompleted === 'boolean'
    && typeof onboarding.modelStepCompleted === 'boolean';
};
