import {
  normalizePublisherDomain, publisherApprovalGateErrors, validatePublisherMetricEvidence,
  validatePublisherOnboarding, validatePublisherTransition,
  type PublisherOnboardingRecord, type PublisherEvidence,
} from './publisher-onboarding-contracts';

const expect = (value: boolean, message: string) => { if (!value) throw new Error(message); };
const now = '2026-11-26T12:00:00.000Z';
const verified = (evidenceId: string, kind: PublisherEvidence['kind']): PublisherEvidence => ({
  evidenceId, kind, source: 'publisher-submitted evidence', reference: 'evidence://record/' + evidenceId,
  observedAt: now, expiresAt: '2027-11-26T12:00:00.000Z', verifiedByPrincipalRef: 'principal:reviewer',
  verificationDecisionRef: 'fortress:decision:' + evidenceId, status: 'verified',
});
const record: PublisherOnboardingRecord = {
  publisherId: 'publisher:1', platformId: 'izakhono', entityId: 'entity:1', status: 'editorial_review',
  legalName: 'Example Publisher (Pty) Ltd', representativePrincipalRef: 'principal:publisher',
  primaryDomain: 'news.example.co.za',
  evidence: [
    verified('legal', 'legal_identity'), verified('rep', 'authorized_representative'),
    verified('domain', 'domain_control'), verified('policy', 'editorial_policy'),
  ],
  editorialPolicyAccepted: true, finalEditorialControlConfirmed: true, disclosurePolicyAccepted: true,
  createdAt: now, updatedAt: now, version: 3,
};
expect(normalizePublisherDomain('News.Example.co.za.') === 'news.example.co.za', 'domain normalization should be deterministic');
expect(normalizePublisherDomain('https://example.com/path') === null, 'domain field must not accept URL or path');
expect(normalizePublisherDomain('*.example.com') === null, 'wildcard domain must not be accepted as verified primary domain');
expect(validatePublisherOnboarding(record, now).length === 0, 'complete publisher record should pass validation');
expect(publisherApprovalGateErrors(record).length === 0, 'all required evidence should satisfy approval gate');
expect(publisherApprovalGateErrors({ ...record, evidence: record.evidence.filter(e => e.kind !== 'domain_control') }).includes('DOMAIN_CONTROL_NOT_VERIFIED'), 'missing domain proof must block approval');

const approve = { from: 'editorial_review' as const, to: 'approved' as const, occurredAt: now,
  actor: { principalRef: 'principal:reviewer', authorizationDecisionRef: 'fortress:decision:approve', permission: 'publishing.publisher.review' } };
expect(validatePublisherTransition(record, approve).length === 0, 'properly authorized approval transition should pass');
expect(validatePublisherTransition(record, { ...approve, actor: { ...approve.actor, permission: 'publishing.publisher.list' } }).includes('FORTRESS_PERMISSION_MISMATCH'), 'wrong permission must fail');
expect(validatePublisherTransition(record, { ...approve, from: 'submitted' }).includes('PUBLISHER_STATUS_STALE'), 'stale source status must fail');
const listed = { ...record, status: 'approved' as const };
expect(validatePublisherTransition(listed, { ...approve, from: 'approved', to: 'listed', actor: { ...approve.actor, permission: 'publishing.publisher.list' } }).length === 0, 'approved publisher may be listed with listing permission');
expect(validatePublisherTransition(record, { ...approve, to: 'listed' }).includes('PUBLISHER_APPROVAL_REQUIRED_BEFORE_LISTING'), 'publisher must not jump directly to listed');

const metric: PublisherEvidence = { evidenceId: 'metric:1', kind: 'traffic_metrics', source: 'analytics provider',
  reference: 'report://2026-11', observedAt: now, expiresAt: '2026-12-26T12:00:00.000Z',
  verifiedByPrincipalRef: 'principal:analyst', verificationDecisionRef: 'fortress:decision:metric', status: 'verified' };
expect(validatePublisherMetricEvidence(metric, now).length === 0, 'fresh sourced metrics should pass');
expect(validatePublisherMetricEvidence({ ...metric, expiresAt: null }, now).includes('METRIC_EVIDENCE_STALE_OR_UNDATED'), 'undated metrics must fail freshness validation');
expect(validatePublisherMetricEvidence({ ...metric, observedAt: '2027-01-01T00:00:00.000Z' }, now).includes('METRIC_OBSERVATION_IN_FUTURE'), 'future metric observation must fail');

console.log('IZAKHONO PUBLISHER ONBOARDING CONTRACTS: PASS');
