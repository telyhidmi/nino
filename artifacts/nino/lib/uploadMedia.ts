import { Platform } from 'react-native';
import { PostUploadRequestContentType } from '@workspace/api-client-react';

export type CapturedMedia = {
  uri: string; type: 'image' | 'video'; mimeType?: string | null; file?: Blob;
};
export type UploadMedia = { uri: string; contentType: PostUploadRequestContentType; size: number; blob?: Blob };
export type ByteProgress = { sent: number; total: number };

function inferredType(asset: CapturedMedia): string {
  const ext = asset.uri.split(/[?#]/)[0].split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', m4v: 'video/mp4',
  };
  return asset.mimeType || asset.file?.type || types[ext ?? ''] || '';
}

export async function readUploadMedia(asset: CapturedMedia, invalid: string, limit: string): Promise<UploadMedia> {
  let contentType = inferredType(asset);
  let size: number;
  let blob: Blob | undefined;
  if (Platform.OS === 'web') {
    blob = asset.file;
    if (!blob) {
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error(invalid);
      blob = await response.blob();
    }
    contentType ||= blob.type;
    size = blob.size;
  } else {
    // Only inspect native file metadata. Never materialize a 200 MB video in JS.
    const { File } = await import('expo-file-system');
    const file = new File(asset.uri);
    if (!file.exists) throw new Error(invalid);
    size = file.size;
    contentType ||= file.type;
  }
  const expected = asset.type === 'video' ? 'video/' : 'image/';
  if (!contentType.startsWith(expected) || !Object.values(PostUploadRequestContentType).includes(contentType as PostUploadRequestContentType) || !Number.isFinite(size) || size <= 0) throw new Error(invalid);
  if (size > (asset.type === 'video' ? 200 : 20) * 1024 * 1024) throw new Error(limit);
  return { uri: asset.uri, contentType: contentType as PostUploadRequestContentType, size, blob };
}

// The only direct network request here is the signed storage PUT, not an API endpoint.
export async function uploadMedia(url: string, media: UploadMedia, progress: (value: ByteProgress) => void, registerCancel: (cancel: () => void) => void): Promise<void> {
  progress({ sent: 0, total: media.size });
  if (Platform.OS === 'web') {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      registerCancel(() => xhr.abort());
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', media.contentType);
      xhr.upload.onprogress = (event) => progress({ sent: event.loaded, total: media.size });
      xhr.onerror = () => reject(new Error('Storage upload failed. Check your connection and retry.'));
      xhr.onabort = () => reject(new Error('Upload cancelled.'));
      xhr.ontimeout = () => reject(new Error('Storage upload timed out. Please retry.'));
      xhr.timeout = 15 * 60 * 1000;
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage upload failed (HTTP ${xhr.status}). Please retry.`));
      xhr.send(media.blob);
    });
  } else {
    // Expo's legacy native upload task streams a file URI and provides byte progress.
    // Unlike fetch(uri).blob(), it does not allocate the entire video in JS memory.
    const fs = await import('expo-file-system/legacy');
    const task = fs.createUploadTask(url, media.uri, {
      httpMethod: 'PUT', uploadType: fs.FileSystemUploadType.BINARY_CONTENT,
      sessionType: fs.FileSystemSessionType.FOREGROUND,
      headers: { 'Content-Type': media.contentType },
    }, (event) => progress({ sent: event.totalBytesSent, total: media.size }));
    registerCancel(() => { void task.cancelAsync().catch(() => undefined); });
    const result = await task.uploadAsync();
    if (!result) throw new Error('Upload cancelled.');
    if (result.status < 200 || result.status >= 300) throw new Error(`Storage upload failed (HTTP ${result.status}). Please retry.`);
  }
  progress({ sent: media.size, total: media.size });
}