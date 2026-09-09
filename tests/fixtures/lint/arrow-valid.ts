export const createValue = () => ({ ready: true });

export const transformValues = (values: number[]) => values.map((value) => value * 2);
