export type StartupCheckStatus = 'pending' | 'active' | 'complete' | 'error';

export type StartupCheck = {
  id: string;
  status: StartupCheckStatus;
};

export type StartupProgressProfile = readonly number[];

export const createStartupProgressProfile = (
  random: (segment: number) => number = Math.random,
  segments = 4,
): StartupProgressProfile => {
  const segmentCount = Math.max(1, Math.floor(segments));
  const weights = Array.from({ length: segmentCount }, (_, index) => 0.55 + Math.min(1, Math.max(0, random(index))) * 0.9);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const profile = [0];
  let accumulated = 0;
  for (const weight of weights) {
    accumulated += weight;
    profile.push(Math.round((accumulated / total) * 100));
  }
  profile[profile.length - 1] = 100;
  return profile;
};

export const getVisualStartupProgress = (
  elapsedMs: number,
  durationMs: number,
  profile: StartupProgressProfile = createStartupProgressProfile(),
): number => {
  if (durationMs <= 0) return 100;
  const progress = Math.min(1, Math.max(0, elapsedMs / durationMs));
  if (profile.length < 2 || progress === 0) return 0;
  if (progress === 1) return 100;

  const segmentProgress = progress * (profile.length - 1);
  const segment = Math.min(profile.length - 2, Math.floor(segmentProgress));
  const segmentFraction = segmentProgress - segment;
  const start = profile[segment] ?? 0;
  const end = profile[segment + 1] ?? 100;
  return Math.round(start + (end - start) * segmentFraction);
};
