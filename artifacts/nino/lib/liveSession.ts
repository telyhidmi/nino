// Lets sign-out wait for a host's end request before invalidating its auth token.
let cleanup: (() => Promise<void>) | null = null;
export function registerLiveCleanup(fn: () => Promise<void>) {
  cleanup = fn;
  return () => { if (cleanup === fn) cleanup = null; };
}
export async function closeActiveLiveSession() { await cleanup?.(); }