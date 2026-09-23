import test from 'node:test';
import assert from 'node:assert/strict';
import { identitySkeleton, similarity, normalizeSafetyCategory } from '../src/safety-utils.js';

test('identity skeleton collapses common clone tricks', () => {
  assert.equal(identitySkeleton('@Safe.Person-01'), 'safepersonol');
  assert.equal(identitySkeleton('safe_person_o1'), 'safepersonol');
});

test('near-identical protected handles score highly', () => {
  assert.ok(similarity('bevan.shelton', 'bevan_shelton') >= 0.99);
});

test('same-name category aliases classify cyberbullying and cloning', () => {
  assert.equal(normalizeSafetyCategory('Cyber bullying and humiliation'), 'cyberbullying');
  assert.equal(normalizeSafetyCategory('This is a cloned account'), 'account-cloning');
});
