export const supportsNativeLive = false;
// Match the native loader's type without pulling either SDK into the web bundle.
export async function loadLiveNative(): Promise<{
  native: typeof import('@livekit/react-native');
  client: typeof import('livekit-client');
}> {
  throw new Error('An installed Nino native build is required for Live.');
}