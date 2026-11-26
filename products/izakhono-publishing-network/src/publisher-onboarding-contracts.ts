/**
 * IZAKHONO PUBLISHING NETWORK — publisher onboarding and verification contracts.
 * Pure deterministic rules only; no identity provider, DNS, HTTP, database or
 * workflow side effects. Evidence must be collected and verified by approved
 * operational adapters before these gates are satisfied.
 */

export type PublisherOnboardingStatus =
  | 'draft' | 'submitted' | 'identity_review' | 'domain_verification'
  | 'editorial_review' | 'approved' | 'listed' | 'rejected' | 'suspended' | 'expired';

export type PublisherEvidenceKind =
  | 'legal_identity' | 'authorized_representative' | 'domain_control'
  | 'editorial_policy' | 'sample_content' | 'traffic_metrics' | 'audience_metrics';

export interface PublisherEvidence {
  evidenceId: string;
  kind: PublisherEvidenceKind;
  source: string;
  reference: string;
  observedAt: string;
  expiresAt: string | null;
  verifiedByPrincipalRef: string | null;
  verificationDecisionRef: string | null;
  status: 'pending' | 'verified' | 'rejected' | 'expired';
}

export interface PublisherOnboardingRecord {
  publisherId: string;
  platformId: string;
  entityId: string;
  status: PublisherOnboardingStatus;
  legalName: string;
  representativePrincipalRef: string | null;
  primaryDomain: string;
  evidence: PublisherEvidence[];
  editorialPolicyAccepted: boolean;
  finalEditorialControlConfirmed: boolean;
  disclosurePolicyAccepted: boolean;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OnboardingActor {
  principalRef: string;
  authorizationDecisionRef: string;
  permission: string;
}

export interface OnboardingTransition {
  from: PublisherOnboardingStatus;
  to: PublisherOnboardingStatus;
  actor: OnboardingActor;
  occurredAt: string;
}

const transitions: Record<PublisherOnboardingStatus, PublisherOnboardingStatus[]> = {
  draft: ['submitted'],
  submitted: ['identity_review', 'rejected'],
  identity_review: ['domain_verification', 'rejected'],
  domain_verification: ['editorial_review', 'rejected'],
  editorial_review: ['approved', 'rejected'],
  approved: ['listed', 'suspended', 'expired'],
  listed: ['suspended', 'expired'],
  rejected: [],
  suspended: ['identity_review', 'expired'],
  expired: ['identity_review'],
};

const nonBlank = (value: string): boolean => typeof value === 'string' && value.trim().length > 0;
const validTime = (value: string): boolean => Number.isFinite(Date.parse(value));

export function normalizePublisherDomain(value: string): string | null {
  if (!nonBlank(value) || value.length > 253 || /[\s/@?#]/.test(value)) return null;
  const candidate = value.toLowerCase().replace(/\.$/, '');
  if (candidate.startsWith('*.') || candidate.includes('..')) return null;
  const labels = candidate.split('.');
  if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return candidate;
}

export function validatePublisherOnboarding(record: PublisherOnboardingRecord, now = new Date().toISOString()): string[] {
  const errors: string[] = [];
  if (!nonBlank(record.publisherId) || !nonBlank(record.platformId) || !nonBlank(record.entityId)) errors.push('PUBLISHER_TENANT_IDENTITY_REQUIRED');
  if (!nonBlank(record.legalName)) errors.push('PUBLISHER_LEGAL_NAME_REQUIRED');
  if (!normalizePublisherDomain(record.primaryDomain)) errors.push('PUBLISHER_PRIMARY_DOMAIN_INVALID');
  if (!Number.isSafeInteger(record.version) || record.version < 1) errors.push('PUBLISHER_VERSION_INVALID');
  if (!validTime(record.createdAt) || !validTime(record.updatedAt) || Date.parse(record.updatedAt) < Date.parse(record.createdAt)) errors.push('PUBLISHER_TIMESTAMPS_INVALID');
  const ids = new Set<string>();
  for (const item of record.evidence) {
    if (!nonBlank(item.evidenceId) || ids.has(item.evidenceId)) errors.push('PUBLISHER_EVIDENCE_ID_MISSING_OR_DUPLICATE');
    ids.add(item.evidenceId);
    if (!nonBlank(item.source) || !nonBlank(item.reference) || !validTime(item.observedAt)) errors.push('PUBLISHER_EVIDENCE_PROVENANCE_REQUIRED');
    if (item.expiresAt !== null && (!validTime(item.expiresAt) || Date.parse(item.expiresAt) <= Date.parse(item.observedAt))) errors.push('PUBLISHER_EVIDENCE_EXPIRY_INVALID');
    if (item.status === 'verified' && (!nonBlank(item.verifiedByPrincipalRef ?? '') || !nonBlank(item.verificationDecisionRef ?? ''))) errors.push('PUBLISHER_EVIDENCE_VERIFICATION_PROVENANCE_REQUIRED');
    if (item.expiresAt !== null && Date.parse(item.expiresAt) <= Date.parse(now) && item.status === 'verified') errors.push('PUBLISHER_EVIDENCE_EXPIRED');
  }
  return [...new Set(errors)];
}

export function validatePublisherTransition(
  record: PublisherOnboardingRecord,
  transition: OnboardingTransition,
): string[] {
  const errors: string[] = [];
  if (transition.from !== record.status) errors.push('PUBLISHER_STATUS_STALE');
  if (!transitions[transition.from]?.includes(transition.to)) errors.push('PUBLISHER_TRANSITION_NOT_ALLOWED');
  if (!nonBlank(transition.actor.principalRef) || !nonBlank(transition.actor.authorizationDecisionRef)) errors.push('FORTRESS_AUTHORIZATION_PROVENANCE_REQUIRED');
  const expectedPermission = transition.to === 'listed' ? 'publishing.publisher.list' :
    transition.to === 'suspended' ? 'publishing.publisher.suspend' :
    transition.to === 'rejected' ? 'publishing.publisher.reject' : 'publishing.publisher.review';
  if (transition.actor.permission !== expectedPermission) errors.push('FORTRESS_PERMISSION_MISMATCH');
  if (!validTime(transition.occurredAt) || Date.parse(transition.occurredAt) < Date.parse(record.updatedAt)) errors.push('PUBLISHER_TRANSITION_TIMESTAMP_INVALID');
  if (transition.to === 'approved' || transition.to === 'listed') {
    errors.push(...publisherApprovalGateErrors(record));
  }
  if (transition.to === 'listed' && record.status !== 'approved') errors.push('PUBLISHER_APPROVAL_REQUIRED_BEFORE_LISTING');
  return [...new Set(errors)];
}

export function publisherApprovalGateErrors(record: PublisherOnboardingRecord): string[] {
  const now = Date.now();
  const verified = (kind: PublisherEvidenceKind): boolean => record.evidence.some(item =>
    item.kind === kind && item.status === 'verified' &&
    item.verifiedByPrincipalRef !== null && item.verificationDecisionRef !== null &&
    (item.expiresAt === null || Date.parse(item.expiresAt) > now));
  const errors: string[] = [];
  if (!verified('legal_identity')) errors.push('LEGAL_IDENTITY_NOT_VERIFIED');
  if (!verified('authorized_representative')) errors.push('AUTHORIZED_REPRESENTATIVE_NOT_VERIFIED');
  if (!verified('domain_control')) errors.push('DOMAIN_CONTROL_NOT_VERIFIED');
  if (!verified('editorial_policy')) errors.push('EDITORIAL_POLICY_NOT_VERIFIED');
  if (!record.editorialPolicyAccepted) errors.push('EDITORIAL_POLICY_ACCEPTANCE_REQUIRED');
  if (!record.finalEditorialControlConfirmed) errors.push('FINAL_EDITORIAL_CONTROL_CONFIRMATION_REQUIRED');
  if (!record.disclosurePolicyAccepted) errors.push('DISCLOSURE_POLICY_ACCEPTANCE_REQUIRED');
  if (!nonBlank(record.representativePrincipalRef ?? '')) errors.push('PUBLISHER_REPRESENTATIVE_REQUIRED');
  return errors;
}

/** SEO metrics are informational only; require provenance and freshness. */
export function validatePublisherMetricEvidence(evidence: PublisherEvidence, now = new Date().toISOString()): string[] {
  const errors: string[] = [];
  if (evidence.kind !== 'traffic_metrics' && evidence.kind !== 'audience_metrics') errors.push('EVIDENCE_IS_NOT_A_METRIC');
  if (!nonBlank(evidence.source) || !nonBlank(evidence.reference) || !validTime(evidence.observedAt)) errors.push('METRIC_PROVENANCE_REQUIRED');
  if (Date.parse(evidence.observedAt) > Date.parse(now)) errors.push('METRIC_OBSERVATION_IN_FUTURE');
  if (evidence.expiresAt === null || !validTime(evidence.expiresAt) || Date.parse(evidence.expiresAt) <= Date.parse(now)) errors.push('METRIC_EVIDENCE_STALE_OR_UNDATED');
  return errors;
}
