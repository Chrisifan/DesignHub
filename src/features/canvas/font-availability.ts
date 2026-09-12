export type FontAvailability = {
  requested: string;
  available: boolean;
  previewFamily: string;
};

export const assessFontAvailability = (requested: string, availableFonts: string[]): FontAvailability => {
  const available = availableFonts.includes(requested);
  return { requested, available, previewFamily: available ? requested : availableFonts[0] ?? 'sans-serif' };
};

export const applyFontReplacement = (requested: string, availability: FontAvailability, confirmed: boolean): string => (
  availability.available || !confirmed ? requested : availability.previewFamily
);
