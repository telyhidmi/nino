import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePeopleQuery, isSearchablePeopleQuery } from '../lib/peopleQuery.ts';

test('strips leading @ and whitespace', () => {
  assert.equal(normalizePeopleQuery('  @ana.lu '), 'ana.lu');
  assert.equal(normalizePeopleQuery('@@bo'), 'bo');
  assert.equal(normalizePeopleQuery('Maria Silva'), 'Maria Silva');
  assert.equal(normalizePeopleQuery('a@b'), 'a@b');
});
test('2-char minimum applies after stripping @', () => {
  assert.equal(isSearchablePeopleQuery(normalizePeopleQuery('@a')), false);
  assert.equal(isSearchablePeopleQuery(normalizePeopleQuery('@ab')), true);
  assert.equal(isSearchablePeopleQuery(normalizePeopleQuery('@')), false);
});
