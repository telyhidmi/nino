import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preferredLanguage } from '../lib/preferredLanguage.ts';

const supported = ['en', 'ar', 'pt', 'es', 'fr', 'de', 'it', 'tr', 'ru', 'hi', 'zh', 'ja'];
test('device locales match supported regional and script variants', () => {
  assert.equal(preferredLanguage(['ar-PS'], supported), 'ar');
  assert.equal(preferredLanguage(['pt_BR'], supported), 'pt');
  assert.equal(preferredLanguage(['zh-Hans-CN'], supported), 'zh');
});
test('uses first supported device preference', () => {
  assert.equal(preferredLanguage(['nl-NL', 'fr-FR', 'en-US'], supported), 'fr');
});
test('unsupported or absent preferences use English', () => {
  assert.equal(preferredLanguage([], supported), 'en');
  assert.equal(preferredLanguage(['ko-KR'], supported), 'en');
});
