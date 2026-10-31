import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldPollFollowing, shouldPlayVideo } from '../lib/activityPolicy.ts';

const visible = { preview: false, tab: 'following', section: 'home', focused: true,
  foreground: true, webVisible: true, overlayOpen: false };
test('visible Following feed remains fresh', () => {
  assert.equal(shouldPollFollowing(visible), true);
});
for (const [key, value] of [
  ['preview', true], ['tab', 'foryou'], ['section', 'profile'], ['focused', false],
  ['foreground', false], ['webVisible', false], ['overlayOpen', true],
]) {
  test(`Following polling stops for ${key}=${value}`, () => {
    assert.equal(shouldPollFollowing({ ...visible, [key]: value }), false);
    assert.equal(shouldPollFollowing(visible), true);
  });
}
test('playback requests loading without waiting for readiness', () => {
  assert.equal(shouldPlayVideo(true, false, false, false), true);
});
test('paused, hidden, failed and seeking videos stop playback and progress timers', () => {
  for (const args of [[false, false, false, false], [true, true, false, false],
    [true, false, true, false], [true, false, false, true]]) {
    assert.equal(shouldPlayVideo(...args), false);
  }
});
