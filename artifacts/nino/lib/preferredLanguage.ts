/** Match device preferences in order, including regional/script locale tags. */
export function preferredLanguage(locales: readonly string[], supported: readonly string[]): string {
  for (const locale of locales) {
    const base = locale.trim().toLowerCase().split(/[-_]/)[0];
    if (supported.includes(base)) return base;
  }
  return 'en';
}
