import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { Post, PostList } from '@workspace/api-client-react';

/** Only call after publish returns the server's confirmed Post. */
export async function cachePublishedPost(
  client: QueryClient,
  post: Post,
  feedKey: QueryKey,
  ownerBaseKey: QueryKey,
): Promise<void> {
  const ownerKey = [...ownerBaseKey, post.ownerId];
  const keys = [feedKey, ownerKey];
  // Cancel before writing: an older empty read must not overwrite the confirmed post.
  await Promise.all(keys.map((queryKey) => client.cancelQueries({ queryKey, exact: true })));
  for (const queryKey of keys) {
    client.setQueryData<PostList>(queryKey, (previous) => ({
      posts: [post, ...(previous?.posts ?? []).filter((item) => item.id !== post.id)],
    }));
  }
  // Revalidate only the affected owner; never seed another signed-in user's cache.
  for (const queryKey of keys) {
    void client.invalidateQueries({ queryKey, exact: true });
  }
}