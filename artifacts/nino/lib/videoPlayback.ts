import { Platform } from 'react-native';

export function playbackFormats(): ('mp4' | 'webm')[] {
  // H.264/AAC remains the native path. Never infer support from ".mp4" alone.
  if (Platform.OS !== 'web' || typeof document === 'undefined') return ['mp4'];
  const video = document.createElement('video');
  const mp4 = !!video.canPlayType('video/mp4; codecs="avc1.4D4028, mp4a.40.2"');
  const webm = !!video.canPlayType('video/webm; codecs="vp8, vorbis"');
  return mp4 ? (webm ? ['mp4', 'webm'] : ['mp4']) : webm ? ['webm'] : [];
}

export function playbackUri(uri: string, format: 'mp4' | 'webm') {
  return `${uri}${uri.includes('?') ? '&' : '?'}playback=${format}`;
}
