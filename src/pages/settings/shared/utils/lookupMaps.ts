/**
 * Create a lookup map from an array of items by ID
 */
export const createLookupMap = <T extends { id: number | string }>(
  items: T[]
): Map<number, T> => {
  const map = new Map<number, T>();
  items.forEach((item) => {
    map.set(Number(item.id), item);
  });
  return map;
};

/**
 * Create a lookup map with a custom key extractor
 */
export const createLookupMapBy = <T>(
  items: T[],
  keyExtractor: (item: T) => number | string
): Map<number, T> => {
  const map = new Map<number, T>();
  items.forEach((item) => {
    const key = Number(keyExtractor(item));
    map.set(key, item);
  });
  return map;
};

/**
 * Filter items by a foreign key
 */
export const filterByForeignKey = <T extends Record<string, any>>(
  items: T[],
  foreignKeyField: string,
  foreignKeyValue: number | string | null | undefined
): T[] => {
  if (foreignKeyValue == null) return [];
  const value = Number(foreignKeyValue);
  return items.filter((item) => Number(item[foreignKeyField]) === value);
};
