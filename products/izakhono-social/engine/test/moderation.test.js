import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateText } from '../src/moderation.js';

test('allows ordinary community content', () => {
  assert.equal(moderateText('Community football practice is Saturday').action, 'allow');
});

test('blocks illegal drug sales language', () => {
  assert.equal(moderateText('I sell cocaine and deliver tonight').action, 'block');
});

test('routes legitimate public-interest drug discussion to review', () => {
  assert.equal(
    moderateText('Documentary reporting on how dealers sell cocaine in the city').action,
    'review',
  );
});

test('always blocks sexual content involving minors', () => {
  assert.equal(moderateText('child explicit sexual content').action, 'block');
});
