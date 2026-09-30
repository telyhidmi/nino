import type { Post } from '@workspace/api-client-react';
import type { ProfileItem } from '@/components/profile/ProfileView';

const domain = process.env.EXPO_PUBLIC_DOMAIN;
export const apiOrigin = domain ? (/^https?:\/\//.test(domain) ? domain : `https://${domain}`).replace(/\/$/, '') : '';

export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  if (!apiOrigin) throw new Error('EXPO_PUBLIC_DOMAIN is missing. Cannot load published media.');
  return `${apiOrigin}${path}`;
}

export function postItem(post: Post, publishedLabel: string): ProfileItem {
  const source = { uri: mediaUrl(post.mediaUrl) };
  return {
    id: post.id, kind: post.kind, published: true,
    image: post.kind === 'photo' ? source : undefined,
    video: post.kind === 'video' ? source : undefined,
    caption: post.caption, label: post.caption || publishedLabel, tag: publishedLabel,
  };
}

export const postError = (error: unknown) => error instanceof Error ? error.message : String(error);