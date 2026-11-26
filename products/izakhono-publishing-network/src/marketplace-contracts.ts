/**
 * IZAKHONO PUBLISHING NETWORK — publisher marketplace domain contracts.
 *
 * Pure, provider-neutral conformance logic. No persistence, network, payment,
 * identity, publisher submission or production side effects.
 */

export type CampaignState =
  | 'draft' | 'submitted' | 'qualification' | 'quoted'
  | 'awaiting_customer_approval' | 'approved' | 'awaiting_payment' | 'funded'
  | 'production' | 'customer_content_review' | 'publisher_submission'
  | 'publisher_decision' | 'scheduled' | 'published_reported'
  | 'verification' | 'verified_live' | 'monitoring' | 'closed'
  | 'revision_required' | 'publisher_rejected' | 'customer_cancelled'
  | 'refund_pending' | 'refunded' | 'replacement_pending' | 'disputed'
  | 'blocked_compliance' | 'failed';

export type CampaignEvent =
  | 'submit' | 'qualify' | 'quote' | 'request_customer_approval'
  | 'approve_customer' | 'require_payment' | 'confirm_funding'
  | 'start_production' | 'submit_customer_review' | 'approve_content'
  | 'submit_to_publisher' | 'publisher_accept' | 'publisher_reject'
  | 'schedule' | 'report_published' | 'begin_verification'
  | 'verify_live' | 'begin_monitoring' | 'close'
  | 'request_revision' | 'cancel' | 'request_refund' | 'confirm_refund'
  | 'request_replacement' | 'open_dispute' | 'block_compliance' | 'fail';

export interface CampaignGates {
  customerApproved: boolean;
  rightsCleared: boolean;
  disclosureApproved: boolean;
  paymentOrCreditConfirmed: boolean;
  publisherAccepted: boolean;
  publicationEvidencePresent: boolean;
  verificationEvidenceComplete: boolean;
}

export interface CampaignTransition {
  from: CampaignState;
  event: CampaignEvent;
  to: CampaignState;
  required?: (keyof CampaignGates)[];
}

const transitions: CampaignTransition[] = [
  { from: 'draft', event: 'submit', to: 'submitted' },
  { from: 'submitted', event: 'qualify', to: 'qualification' },
  { from: 'qualification', event: 'quote', to: 'quoted' },
  { from: 'quoted', event: 'request_customer_approval', to: 'awaiting_customer_approval' },
  { from: 'awaiting_customer_approval', event: 'approve_customer', to: 'approved', required: ['customerApproved'] },
  { from: 'approved', event: 'require_payment', to: 'awaiting_payment' },
  { from: 'awaiting_payment', event: 'confirm_funding', to: 'funded', required: ['paymentOrCreditConfirmed'] },
  { from: 'funded', event: 'start_production', to: 'production', required: ['rightsCleared'] },
  { from: 'production', event: 'submit_customer_review', to: 'customer_content_review' },
  { from: 'customer_content_review', event: 'approve_content', to: 'publisher_submission', required: ['customerApproved', 'rightsCleared', 'disclosureApproved'] },
  { from: 'publisher_submission', event: 'submit_to_publisher', to: 'publisher_decision' },
  { from: 'publisher_decision', event: 'publisher_accept', to: 'scheduled', required: ['publisherAccepted'] },
  { from: 'publisher_decision', event: 'publisher_reject', to: 'publisher_rejected' },
  { from: 'scheduled', event: 'report_published', to: 'published_reported', required: ['publicationEvidencePresent'] },
  { from: 'published_reported', event: 'begin_verification', to: 'verification' },
  { from: 'verification', event: 'verify_live', to: 'verified_live', required: ['verificationEvidenceComplete'] },
  { from: 'verified_live', event: 'begin_monitoring', to: 'monitoring' },
  { from: 'monitoring', event: 'close', to: 'closed' },
  { from: 'production', event: 'request_revision', to: 'revision_required' },
  { from: 'customer_content_review', event: 'request_revision', to: 'revision_required' },
  { from: 'revision_required', event: 'submit_customer_review', to: 'customer_content_review' },
  { from: 'draft', event: 'cancel', to: 'customer_cancelled' },
  { from: 'submitted', event: 'cancel', to: 'customer_cancelled' },
  { from: 'quoted', event: 'cancel', to: 'customer_cancelled' },
  { from: 'awaiting_customer_approval', event: 'cancel', to: 'customer_cancelled' },
  { from: 'funded', event: 'request_refund', to: 'refund_pending' },
  { from: 'publisher_rejected', event: 'request_refund', to: 'refund_pending' },
  { from: 'refund_pending', event: 'confirm_refund', to: 'refunded' },
  { from: 'publisher_rejected', event: 'request_replacement', to: 'replacement_pending' },
  { from: 'monitoring', event: 'request_replacement', to: 'replacement_pending' },
  { from: 'replacement_pending', event: 'submit_to_publisher', to: 'publisher_submission' },
  { from: 'publisher_submission', event: 'open_dispute', to: 'disputed' },
  { from: 'published_reported', event: 'open_dispute', to: 'disputed' },
  { from: 'verification', event: 'open_dispute', to: 'disputed' },
  { from: 'monitoring', event: 'open_dispute', to: 'disputed' },
  { from: 'submitted', event: 'block_compliance', to: 'blocked_compliance' },
  { from: 'qualification', event: 'block_compliance', to: 'blocked_compliance' },
  { from: 'production', event: 'block_compliance', to: 'blocked_compliance' },
  { from: 'publisher_submission', event: 'block_compliance', to: 'blocked_compliance' },
  { from: 'verification', event: 'fail', to: 'failed' },
];

export function transitionCampaign(
  state: CampaignState,
  event: CampaignEvent,
  gates: CampaignGates,
): CampaignState {
  const transition = transitions.find(item => item.from === state && item.event === event);
  if (!transition) throw new Error(`Invalid campaign transition: ${state} + ${event}`);
  const missing = (transition.required ?? []).filter(key => gates[key] !== true);
  if (missing.length) throw new Error(`Transition blocked; unmet gates: ${missing.join(', ')}`);
  return transition.to;
}

export type LinkQualification = 'sponsored' | 'nofollow' | 'ugc' | 'none' | 'unknown';

export interface PublisherOffer {
  offerId: string;
  publisherId: string;
  currency: string;
  amountMinor: number;
  offerType: 'sponsored_article' | 'contributed_article' | 'interview' | 'product_feature' | 'newsletter' | 'press_release' | 'display_sponsorship';
  disclosureRequired: boolean;
  linkQualification: LinkQualification;
  finalEditorialControl: true;
  scopeDescription: string;
  quoteExpiresAt: string;
}

export function validatePublisherOffer(offer: PublisherOffer): string[] {
  const errors: string[] = [];
  if (!offer.offerId.trim() || !offer.publisherId.trim()) errors.push('OFFER_IDENTIFIERS_REQUIRED');
  if (!/^[A-Z]{3}$/.test(offer.currency)) errors.push('CURRENCY_CODE_FORMAT_INVALID');
  if (!Number.isSafeInteger(offer.amountMinor) || offer.amountMinor < 0) errors.push('INVALID_AMOUNT_MINOR');
  if (!offer.scopeDescription.trim()) errors.push('OFFER_SCOPE_REQUIRED');
  if (offer.finalEditorialControl !== true) errors.push('PUBLISHER_EDITORIAL_CONTROL_REQUIRED');
  const paidFormats = ['sponsored_article', 'product_feature', 'newsletter', 'press_release', 'display_sponsorship'];
  if (paidFormats.includes(offer.offerType) && !offer.disclosureRequired) errors.push('PAID_FORMAT_REQUIRES_DISCLOSURE');
  if (offer.disclosureRequired && !['sponsored', 'nofollow'].includes(offer.linkQualification)) {
    errors.push('PAID_LINK_REQUIRES_QUALIFICATION');
  }
  if (offer.linkQualification === 'unknown') errors.push('LINK_QUALIFICATION_MUST_BE_KNOWN');
  if (!Number.isFinite(Date.parse(offer.quoteExpiresAt))) errors.push('INVALID_QUOTE_EXPIRY');
  return errors;
}

export interface ContentApproval {
  contentAssetId: string;
  contentHash: string;
  approvedHash: string;
  approverRef: string;
  purpose: 'customer_publication_approval' | 'rights_approval' | 'publisher_change_approval';
  approvedAt: string;
}

export function validateContentApproval(approval: ContentApproval, currentContentHash: string): string[] {
  const errors: string[] = [];
  if (!approval.contentAssetId.trim() || !approval.approverRef.trim()) errors.push('APPROVAL_IDENTITY_REQUIRED');
  if (!/^[a-f0-9]{64}$/i.test(approval.contentHash) || !/^[a-f0-9]{64}$/i.test(approval.approvedHash)) errors.push('SHA256_HASH_REQUIRED');
  if (approval.contentHash !== approval.approvedHash || approval.approvedHash !== currentContentHash) errors.push('APPROVAL_HASH_MISMATCH');
  if (!Number.isFinite(Date.parse(approval.approvedAt))) errors.push('INVALID_APPROVAL_TIMESTAMP');
  return errors;
}

export type PlacementCheckStatus = 'live' | 'changed' | 'missing' | 'blocked' | 'redirected' | 'unknown';

export interface PlacementEvidence {
  url: string;
  publisherDomain: string;
  resolvedDomain: string;
  contentMatchesApprovedVersion: boolean;
  disclosurePresent: boolean;
  linkQualification: LinkQualification;
  checkedAt: string;
  httpStatus: number | null;
  status: PlacementCheckStatus;
  evidenceRef: string;
}

export function verifyPlacementEvidence(evidence: PlacementEvidence): string[] {
  const errors: string[] = [];
  let parsed: URL | undefined;
  try { parsed = new URL(evidence.url); } catch { errors.push('INVALID_PLACEMENT_URL'); }
  if (parsed && parsed.protocol !== 'https:') errors.push('PLACEMENT_MUST_USE_HTTPS');
  if (parsed && (parsed.username || parsed.password)) errors.push('PLACEMENT_URL_CREDENTIALS_FORBIDDEN');
  const expectedDomain = evidence.publisherDomain.toLowerCase();
  if (!expectedDomain || evidence.resolvedDomain.toLowerCase() !== expectedDomain || parsed?.hostname.toLowerCase() !== expectedDomain) errors.push('PUBLISHER_DOMAIN_MISMATCH');
  if (!evidence.contentMatchesApprovedVersion) errors.push('CONTENT_VERSION_NOT_VERIFIED');
  if (!evidence.disclosurePresent) errors.push('DISCLOSURE_NOT_VERIFIED');
  if (!['sponsored', 'nofollow'].includes(evidence.linkQualification)) errors.push('LINK_QUALIFICATION_NOT_COMPLIANT');
  if (evidence.status !== 'live') errors.push('PLACEMENT_NOT_CONFIRMED_LIVE');
  if (evidence.httpStatus === null || evidence.httpStatus < 200 || evidence.httpStatus >= 300) errors.push('HTTP_SUCCESS_NOT_CONFIRMED');
  if (!Number.isFinite(Date.parse(evidence.checkedAt))) errors.push('INVALID_CHECK_TIMESTAMP');
  if (!evidence.evidenceRef.trim()) errors.push('PLACEMENT_EVIDENCE_REFERENCE_REQUIRED');
  return errors;
}
