import { Platform } from 'react-native';
import type { CapturedMedia } from './uploadMedia';

const MAX_FRAME = 600000;
function sized(width: number, height: number) {
  const ratio = Math.min(1, 768 / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}
async function nativeJpeg(uri: string): Promise<string> {
  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const result = await manipulateAsync(uri, [{ resize: { width: 768 } }], { compress: 0.65, format: SaveFormat.JPEG, base64: true });
  try {
    if (!result.base64 || result.base64.length > MAX_FRAME) throw new Error('Media preview is too large.');
    return result.base64;
  } finally {
    const { File } = await import('expo-file-system');
    if (result.uri !== uri) { try { new File(result.uri).delete(); } catch { /* Cache cleanup only. */ } }
  }
}
function jpeg(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement('canvas');
  Object.assign(canvas, sized(width, height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image preview unavailable.');
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const base64 = canvas.toDataURL('image/jpeg', 0.65).split(',')[1];
  if (!base64 || base64.length > MAX_FRAME) throw new Error('Media preview is too large.');
  return base64;
}
function waitEvent(target: EventTarget, event: string, action: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(event, done); target.removeEventListener('error', fail); };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Could not read this media.')); };
    const timer = setTimeout(fail, 15000);
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', fail, { once: true });
    try { action(); } catch { fail(); }
  });
}
/** Only user-triggered resized JPEGs leave the device; original media stays local. */
export async function getAssistFrames(asset: CapturedMedia): Promise<string[]> {
  if (Platform.OS !== 'web') {
    if (asset.type === 'image') return [await nativeJpeg(asset.uri)];
    const { getThumbnailAsync } = await import('expo-video-thumbnails');
    const { File } = await import('expo-file-system');
    const frames: string[] = [];
    // Sparse samples from the beginning, not a claim to understand the full clip.
    for (const time of [0, 1000, 3000]) {
      const thumbnail = await getThumbnailAsync(asset.uri, { time, quality: 0.7 });
      try { frames.push(await nativeJpeg(thumbnail.uri)); }
      finally { try { new File(thumbnail.uri).delete(); } catch { /* Cache cleanup only. */ } }
    }
    return frames;
  }
  if (asset.type === 'image') {
    const image = new window.Image();
    await waitEvent(image, 'load', () => { image.src = asset.uri; });
    return [jpeg(image, image.naturalWidth, image.naturalHeight)];
  }
  // Reuse a decoded preview when available: some mobile/headless browsers
  // suspend decoding for detached media or cannot run two decoders at once.
  const preview = Array.from(document.querySelectorAll('video')).find(v =>
    (v.currentSrc === asset.uri || v.src === asset.uri) && v.readyState >= 2);
  const video = preview ?? document.createElement('video');
  const originalTime = video.currentTime;
  const originalMuted = video.muted;
  const wasPlaying = !video.paused;
  video.muted = true; video.preload = 'auto'; video.playsInline = true;
  if (!preview) {
    video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
    video.setAttribute('aria-hidden', 'true');
    document.body.appendChild(video);
  }
  try {
    if (!preview) await waitEvent(video, 'loadeddata', () => { video.src = asset.uri; video.load(); });
    video.pause();
    if (video.currentTime > 0.01) await waitEvent(video, 'seeked', () => { video.currentTime = 0; });
    const frames = [jpeg(video, video.videoWidth, video.videoHeight)];
    const end = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.05) : 3;
    for (const time of [Math.min(1, end), Math.min(3, end)]) {
      if (Math.abs(video.currentTime - time) > 0.01) await waitEvent(video, 'seeked', () => { video.currentTime = time; });
      frames.push(jpeg(video, video.videoWidth, video.videoHeight));
    }
    return frames;
  } finally {
    if (preview) {
      video.muted = originalMuted;
      video.currentTime = originalTime;
      if (wasPlaying) void video.play().catch(() => {});
    } else {
      video.pause(); video.removeAttribute('src'); video.load(); video.remove();
    }
  }
}
