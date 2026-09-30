import assert from 'node:assert/strict';
import { test } from 'node:test';
import { countryFlag, countryName, groupRecordedVideos, normalizeCountryCode, postIndexById } from '../components/discover/publishedDiscovery.ts';

const post = (id, code, overrides = {}) => ({
  id, ownerId: 'author-in-US', authorName: 'Author', authorAvatar: null,
  caption: 'Morning walk', kind: 'video', mediaUrl: `/api/media/${id}`,
  createdAt: '2026-06-01T12:00:00Z',
  recordingLocation: { countryCode: code, recordedAt: '2026-06-01T10:00:00Z' },
  ...overrides,
});

test('recording country owns grouping; counts never use author home or demo countries', () => {
  const groups = groupRecordedVideos([post('a', 'JP'), post('b', 'JP'), post('c', 'KE')], 'en');
  assert.deepEqual(groups.map(({ code, posts }) => [code, posts.map((p) => p.id)]), [['JP', ['a', 'b']], ['KE', ['c']]]);
  assert.equal(groups.some((country) => country.code === 'US'), false);
  assert.equal(groups[0].name, 'Japan');
});

test('excludes old posts, photos, gallery, missing media, invalid country and missing recording datetime', () => {
  const posts = [
    post('valid', 'BR'), post('photo', 'BR', { kind: 'photo' }),
    post('gallery', 'BR', { kind: 'gallery' }),
    post('old', 'BR', { recordingLocation: null }),
    post('legacy', 'BR', { recordingLocation: undefined }),
    post('missing-country', 'BR', { recordingLocation: { recordedAt: '2026-06-01T10:00:00Z' } }),
    post('invalid-country', 'ZZ'), post('empty-media', 'BR', { mediaUrl: '' }),
    post('no-timestamp', 'BR', { recordingLocation: { countryCode: 'BR' } }),
    post('bad-timestamp', 'BR', { recordingLocation: { countryCode: 'BR', recordedAt: 'not-a-date' } }),
    post('date-only', 'BR', { recordingLocation: { countryCode: 'BR', recordedAt: '2026-06-01' } }),
  ];
  assert.deepEqual(groupRecordedVideos(posts, 'en').map((group) => group.posts.map((p) => p.id)), [['valid']]);
});

test('global ISO countries and territories work without a curated demo entry', () => {
  const codes = ['KE', 'NZ', 'NP', 'AQ', 'AX', 'BQ', 'PS', 'TL', 'UM', 'ZA'];
  const groups = groupRecordedVideos(codes.map((code) => post(code, code)), 'en');
  assert.equal(groups.length, codes.length);
  assert.equal(normalizeCountryCode(' br '), 'BR');
  for (const invalid of ['USA', 'ZZ', 'UK', '', null, 42]) assert.equal(normalizeCountryCode(invalid), null);
  assert.equal(countryFlag('BR'), '🇧🇷');
  assert.equal(countryFlag('ZZ'), '');
});

test('search supports localized and English country names, ISO codes, captions and accents', () => {
  const posts = [post('a', 'DE'), post('b', 'DE', { caption: 'Quiet café' }), post('c', 'JP')];
  assert.equal(groupRecordedVideos(posts, 'de', 'Deutschland')[0].posts.length, 2);
  assert.equal(groupRecordedVideos(posts, 'de', 'Germany')[0].posts.length, 2);
  assert.equal(groupRecordedVideos(posts, 'de', 'DE')[0].posts.length, 2);
  assert.deepEqual(groupRecordedVideos(posts, 'en', 'cafe').flatMap((group) => group.posts.map((p) => p.id)), ['b']);
  assert.equal(groupRecordedVideos(posts, 'en', 'not found').length, 0);
});

test('shared list additions/deletions change discovery immediately and duplicate IDs count once', () => {
  const first = post('a', 'NP');
  assert.equal(groupRecordedVideos([first, first], 'en')[0].posts.length, 1);
  assert.equal(groupRecordedVideos([first, post('b', 'NP')], 'en')[0].posts.length, 2);
  assert.deepEqual(groupRecordedVideos([], 'en'), []);
});

test('native runtimes without DisplayNames fall back to ISO code, not demo location', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'DisplayNames');
  try {
    Object.defineProperty(Intl, 'DisplayNames', { configurable: true, value: undefined });
    assert.equal(countryName('KE', 'en'), 'KE');
    assert.equal(groupRecordedVideos([post('a', 'KE')], 'en')[0].name, 'KE');
  } finally {
    Object.defineProperty(Intl, 'DisplayNames', descriptor);
  }
});

test('opening an exact published ID preserves the target, unknown IDs never select index zero', () => {
  const posts = [post('first', 'BR'), post('target', 'JP')];
  assert.equal(postIndexById(posts, 'target'), 1);
  assert.equal(postIndexById(posts, 'missing'), -1);
  assert.equal(postIndexById([], 'missing'), -1);
});