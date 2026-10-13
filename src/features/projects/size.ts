export type ProjectDesignSize = { width: number; height: number };

export const projectDesignSizePresets: readonly string[] = ['1080 × 1440', '1080 × 1080', '1920 × 1080'];
export const projectGenerationRatios = ['original', '3:4', '1:1', '16:9'] as const;
export type ProjectGenerationRatio = typeof projectGenerationRatios[number];

const generationRatioSizes: Record<Exclude<ProjectGenerationRatio, 'original'>, ProjectDesignSize> = {
  '3:4': { width: 1080, height: 1440 },
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
};

export const isProjectGenerationRatio = (value: unknown): value is ProjectGenerationRatio =>
  typeof value === 'string' && projectGenerationRatios.includes(value as ProjectGenerationRatio);

export const resolveGenerationRatioSize = (
  ratio: ProjectGenerationRatio,
  originalSize: ProjectDesignSize = generationRatioSizes['3:4'],
): ProjectDesignSize => ratio === 'original' ? { ...originalSize } : { ...generationRatioSizes[ratio] };

export const parseProjectDesignSize = (value: string): ProjectDesignSize => {
  const match = /^([1-9][0-9]{0,4})\s*×\s*([1-9][0-9]{0,4})$/u.exec(value.trim());
  if (!match) throw new Error('INVALID_SIZE');
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width > 20_000 || height > 20_000) throw new Error('INVALID_SIZE');
  return { width, height };
};
