export type Brand = {
  id: string;
  version: string;
  name?: string;
  description?: string;
  logo: string;
  colorPalette: string[];
  fonts: string[];
  tone: string;
  fixedCopy: string;
  sizes: string[];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

export const isBrand = (value: unknown): value is Brand => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.version === 'string' && value.version.trim().length > 0
    && (value.name === undefined || typeof value.name === 'string')
    && (value.description === undefined || typeof value.description === 'string')
    && typeof value.logo === 'string'
    && Array.isArray(value.colorPalette) && value.colorPalette.every((entry) => typeof entry === 'string')
    && Array.isArray(value.fonts) && value.fonts.every((entry) => typeof entry === 'string')
    && typeof value.tone === 'string'
    && typeof value.fixedCopy === 'string'
    && Array.isArray(value.sizes) && value.sizes.every((entry) => typeof entry === 'string');
};

export type BrandLibraryState = { brands: Brand[] };

export const isBrandLibraryState = (value: unknown): value is BrandLibraryState => isRecord(value)
  && Array.isArray(value.brands)
  && value.brands.every((brand) => isBrand(brand));

export type BrandSnapshot = Brand & {
  source: { brandId: string; version: string };
  overrides?: Partial<Record<keyof Brand, unknown>>;
};

export type BrandField = keyof Pick<Brand, 'logo' | 'colorPalette' | 'fonts' | 'tone' | 'fixedCopy' | 'sizes'>;

export type BrandFieldState = {
  source: 'override' | 'brand';
  value: unknown;
  base: unknown;
  diff?: string;
};

const clone = <T>(value: T): T => structuredClone(value);

export const resolveConstraint = (input: {
  instruction?: string;
  document?: string;
  brand?: string;
  designer?: string;
  global?: string;
}): string | undefined => input.instruction ?? input.document ?? input.brand ?? input.designer ?? input.global;

export const createBrandSnapshot = (brand: Brand): BrandSnapshot => ({
  ...clone(brand),
  source: { brandId: brand.id, version: brand.version },
});

export const applyBrandOverride = <K extends BrandField>(snapshot: BrandSnapshot, field: K, value: Brand[K]): BrandSnapshot => ({
  ...clone(snapshot),
  [field]: clone(value),
  overrides: { ...clone(snapshot.overrides ?? {}), [field]: clone(value) },
});

export const overrideBrandField = applyBrandOverride;

export const adoptBrandVersion = (snapshot: BrandSnapshot, brand: Brand): BrandSnapshot => {
  const adopted = createBrandSnapshot(brand);
  const overrides = snapshot.overrides ? clone(snapshot.overrides) : undefined;
  if (!overrides) return adopted;
  return Object.entries(overrides).reduce(
    (current, [field, value]) => ({ ...current, [field]: clone(value) }),
    { ...adopted, overrides },
  ) as BrandSnapshot;
};

const displayValue = (value: unknown): string => Array.isArray(value) ? value.join(', ') : String(value ?? '');

export const getBrandFieldState = <K extends BrandField>(snapshot: BrandSnapshot, field: K, brand: Brand): BrandFieldState => {
  const value = clone(snapshot[field]);
  const base = clone(brand[field]);
  const isOverride = snapshot.overrides?.[field] !== undefined || JSON.stringify(value) !== JSON.stringify(base);
  return {
    source: isOverride ? 'override' : 'brand',
    value,
    base,
    ...(isOverride ? { diff: `${displayValue(base)} → ${displayValue(value)}` } : {}),
  };
};

export type BrandStore = {
  create: (brand: Brand) => Brand;
  update: (id: string, patch: Partial<Brand>) => Brand;
  get: (id: string) => Brand | undefined;
  list: () => Brand[];
  remove: (id: string) => boolean;
};

export const createBrandStore = (initial: Brand[] = []): BrandStore => {
  const records = new Map<string, Brand>(initial.map((brand) => [brand.id, clone(brand)]));
  const create = (brand: Brand): Brand => {
    if (records.has(brand.id)) throw new Error('BRAND_EXISTS');
    const next = clone(brand);
    records.set(next.id, next);
    return clone(next);
  };
  const update = (id: string, patch: Partial<Brand>): Brand => {
    const current = records.get(id);
    if (!current) throw new Error('BRAND_NOT_FOUND');
    const next = { ...current, ...clone(patch), id };
    records.set(id, next);
    return clone(next);
  };
  const get = (id: string): Brand | undefined => {
    const brand = records.get(id);
    return brand ? clone(brand) : undefined;
  };
  const list = (): Brand[] => [...records.values()].map((brand) => clone(brand));
  const remove = (id: string): boolean => records.delete(id);
  return { create, update, get, list, remove };
};
