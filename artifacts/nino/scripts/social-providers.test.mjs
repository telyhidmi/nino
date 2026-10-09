import assert from 'node:assert/strict';
import { test } from 'node:test';
import { enabledSocialProviders } from '../lib/socialProviders.ts';

test('unknown configuration never advertises providers', () => {
  for (const config of [undefined, null, {}]) {
    assert.deepEqual(enabledSocialProviders(config), []);
  }
});

test('disabled Apple is hidden while enabled Google remains available', () => {
  assert.deepEqual(enabledSocialProviders({
    oauth_google: { enabled: true, authenticatable: true },
    oauth_apple: { enabled: false, authenticatable: true },
  }), ['google']);
});

test('link-only providers cannot be used for sign-in', () => {
  assert.deepEqual(enabledSocialProviders({
    oauth_apple: { enabled: true, authenticatable: false },
    oauth_google: { enabled: true },
  }), []);
});

test('Apple appears automatically when enabled for authentication', () => {
  assert.deepEqual(enabledSocialProviders({
    oauth_google: { enabled: true, authenticatable: true },
    oauth_apple: { enabled: true, authenticatable: true },
  }), ['google', 'apple']);
});
