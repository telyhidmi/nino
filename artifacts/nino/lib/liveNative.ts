import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export const supportsNativeLive = Platform.OS !== 'web' && !isRunningInExpoGo();
type LiveSDK = { native: typeof import('@livekit/react-native'); client: typeof import('livekit-client') };
let sdkPromise: Promise<LiveSDK> | undefined;
export async function loadLiveNative() {
  if (!supportsNativeLive) throw new Error('An installed Nino native build is required for Live.');
  // Never evaluated in Expo Go. Web resolves liveNative.web.ts instead.
  sdkPromise ??= (async () => {
    const native = await import('@livekit/react-native');
    native.registerGlobals();
    // registerGlobals must run before constructing a Room or capturing tracks.
    const client = await import('livekit-client');
    return { native, client };
  })().catch((error) => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}