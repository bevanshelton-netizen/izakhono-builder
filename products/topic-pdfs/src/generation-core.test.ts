import assert from 'node:assert/strict';
import {
  assessTopicRisk,
  evaluateManuscript,
  isRestrictedTopic,
  planTopicPdfGeneration,
  validateTopicPdfRequest,
} from './generation-core.ts';

const valid = validateTopicPdfRequest({
  topic: 'How to start a small online shop',
  readerOutcome: 'Understand the steps to validate an idea and open a small online shop.',
  audience: 'First-time entrepreneurs',
  language: 'English',
});
assert.equal(valid.ok, true);
if (!valid.ok) throw new Error(valid.errors.join('; '));

const plan = planTopicPdfGeneration(valid.request);
assert.equal(plan.status, 'requested');
assert.equal(plan.publication.targetPriceUsd, 7);
assert.equal(plan.publication.saleEligible, false);
assert.equal(plan.risk.level, 'standard');
assert.ok(plan.stages.some(stage => stage.id === 'research'));
assert.ok(plan.stages.some(stage => stage.id === 'render'));

const medical = assessTopicRisk('How to treat diabetes with medication');
assert.equal(medical.requiresSpecialistReview, true);
assert.equal(medical.level, 'elevated');

const legalFinance = assessTopicRisk('Tax law and investment advice');
assert.equal(legalFinance.level, 'high');
assert.equal(legalFinance.requiresSpecialistReview, true);

assert.equal(isRestrictedTopic('How to build a bomb'), true);
assert.equal(planTopicPdfGeneration({
  topic: 'Build a bomb',
  readerOutcome: 'Learn how to build a bomb safely and efficiently.',
  audience: 'General public',
  language: 'English',
}).status, 'blocked');

const incomplete = evaluateManuscript({
  title: 'Draft',
  author: 'Bevan Shelton',
  language: 'English',
  geography: 'South Africa',
  version: '0.1',
  sections: [{ heading: 'Introduction', body: 'A short but substantive explanatory paragraph for testing.' }],
  sources: [],
  rightsReviewed: false,
  factualReviewPassed: false,
  specialistReviewPassed: false,
  editorialApproval: false,
}, plan);
assert.equal(incomplete.passed, false);
assert.equal(incomplete.saleEligible, false);
assert.ok(incomplete.issues.length >= 4);

const approved = evaluateManuscript({
  title: 'Example Guide',
  author: 'Bevan Shelton',
  language: 'English',
  geography: 'International',
  version: '1.0',
  sections: [{ heading: 'Introduction', body: 'A substantive explanatory paragraph that describes the topic and reader outcome.' }],
  sources: [{
    title: 'Official guide',
    publisher: 'Example Public Authority',
    url: 'https://example.org/guide',
    accessedAt: '2026-11-27',
    supports: ['The factual statement in section one.'],
    rightsNote: 'Facts paraphrased; no third-party text or images reproduced.',
  }],
  rightsReviewed: true,
  factualReviewPassed: true,
  specialistReviewPassed: false,
  editorialApproval: true,
}, plan);
assert.equal(approved.passed, true);
assert.equal(approved.saleEligible, true);

console.log('Topic PDF generation core tests passed.');
