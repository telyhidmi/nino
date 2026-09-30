import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { cachePublishedPost } from '../lib/publishedPostCache.ts';
import { resetProfileTab } from '../lib/profileTabReset.ts';

const feedKey = ['/api/posts'];
const ownerBaseKey = ['/api/posts/mine'];
const post = {
  id: 'confirmed-post', ownerId: 'owner-a', caption: 'Confirmed',
  kind: 'photo', mediaUrl: '/api/media/confirmed', createdAt: '2026-06-01T00:00:00Z',
  authorName: 'Owner A', authorAvatar: null,
};
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('confirmed post seeds both lists once, preserving other posts and exact owner isolation', async () => {
  const cache = client();
  const ownerKey = [...ownerBaseKey, post.ownerId];
  const otherKey = [...ownerBaseKey, 'owner-b'];
  const existing = { ...post, id: 'existing' };
  cache.setQueryData(feedKey, { posts: [existing, { ...post, caption: 'Old' }] });
  cache.setQueryData(otherKey, { posts: [{ ...existing, ownerId: 'owner-b' }] });
  const otherBefore = cache.getQueryState(otherKey);
  await cachePublishedPost(cache, post, feedKey, ownerBaseKey);
  await cachePublishedPost(cache, post, feedKey, ownerBaseKey);
  assert.deepEqual(cache.getQueryData(feedKey), { posts: [post, existing] });
  assert.deepEqual(cache.getQueryData(ownerKey), { posts: [post] });
  assert.equal(cache.getQueryState(ownerKey).isInvalidated, true);
  assert.equal(cache.getQueryState(feedKey).isInvalidated, true);
  assert.equal(cache.getQueryState(otherKey), otherBefore);
  assert.equal(cache.getQueryData(ownerBaseKey), undefined);
  cache.clear();
});

test('overlapping empty reads are cancelled before seeding and fresh reads revalidate', async () => {
  const cache = client();
  const queries = [];
  for (const queryKey of [feedKey, [...ownerBaseKey, post.ownerId]]) {
    const reads = [];
    const observer = new QueryObserver(cache, {
      queryKey,
      queryFn: ({ signal }) => new Promise((resolve) => reads.push({ signal, resolve })),
    });
    const unsubscribe = observer.subscribe(() => {});
    queries.push({ reads, unsubscribe, queryKey });
  }
  assert.ok(queries.every(({ reads }) => reads.length === 1));
  await cachePublishedPost(cache, post, feedKey, ownerBaseKey);
  for (const { reads, queryKey } of queries) {
    assert.equal(reads[0].signal.aborted, true);
    assert.equal(reads.length, 2, 'invalidation starts a new active read');
    reads[0].resolve({ posts: [] });
    await tick();
    assert.deepEqual(cache.getQueryData(queryKey), { posts: [post] }, 'late empty response cannot clobber seed');
    reads[1].resolve({ posts: [post, { ...post, id: 'server-existing' }] });
  }
  await tick();
  for (const { queryKey, unsubscribe } of queries) {
    assert.equal(cache.getQueryData(queryKey).posts.length, 2);
    assert.equal(cache.getQueryState(queryKey).isInvalidated, false);
    unsubscribe();
  }
  cache.clear();
});

test('every new publish token forces Posts even when profile remains active', () => {
  for (const tab of ['liked', 'private', 'reposts', 'posts']) {
    const selected = { tab, resetToken: 1 };
    assert.equal(resetProfileTab(selected, 1), selected, 'ordinary renders preserve chosen tab');
    const afterPublish = resetProfileTab(selected, 2);
    assert.deepEqual(afterPublish, { tab: 'posts', resetToken: 2 });
    const selectedAgain = { ...afterPublish, tab: 'private' };
    assert.deepEqual(resetProfileTab(selectedAgain, 3), { tab: 'posts', resetToken: 3 });
  }
});

test('profiles without an explicit reset token retain sample tab behavior', () => {
  const sampleState = { tab: 'liked', resetToken: undefined };
  assert.equal(resetProfileTab(sampleState, undefined), sampleState);
});