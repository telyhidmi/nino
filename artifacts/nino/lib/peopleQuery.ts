/** Normalizes a people-search query: trims and strips leading @ so "@ana" matches username "ana". */
export const PEOPLE_MIN_CHARS = 2;
export function normalizePeopleQuery(raw: string): string {
  return raw.trim().replace(/^@+/, '').trim();
}
export const isSearchablePeopleQuery = (q: string) => q.length >= PEOPLE_MIN_CHARS;
