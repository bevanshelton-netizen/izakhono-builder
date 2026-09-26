import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePoint, tileTarget } from '../lib.js';

test('parsePoint accepts valid lng,lat', () => assert.deepEqual(parsePoint('28.0473,-26.2041'), {lng:28.0473,lat:-26.2041}));
test('parsePoint rejects invalid values', () => { assert.equal(parsePoint('200,0'), null); assert.equal(parsePoint('x,y'), null); });
test('tileTarget is absent when no tile backend configured', () => assert.equal(tileTarget(5,10,12), null));
