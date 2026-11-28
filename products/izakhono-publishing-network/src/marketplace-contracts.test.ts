import {
  transitionCampaign, validatePublisherOffer, validateContentApproval, verifyPlacementEvidence,
  type CampaignGates, type PublisherOffer, type ContentApproval, type PlacementEvidence,
} from './marketplace-contracts';

const gates: CampaignGates = {
  customerApproved: true, rightsCleared: true, disclosureApproved: true,
  paymentOrCreditConfirmed: true, publisherAccepted: true,
  publicationEvidencePresent: true, verificationEvidenceComplete: true,
};
const expect = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };
const rejects = (fn: () => unknown, message: string) => { let didReject = false; try { fn(); } catch { didReject = true; } expect(didReject, message); };

let state = transitionCampaign('draft', 'submit', gates);
state = transitionCampaign(state, 'qualify', gates);
state = transitionCampaign(state, 'quote', gates);
state = transitionCampaign(state, 'request_customer_approval', gates);
state = transitionCampaign(state, 'approve_customer', gates);
state = transitionCampaign(state, 'require_payment', gates);
state = transitionCampaign(state, 'confirm_funding', gates);
state = transitionCampaign(state, 'start_production', gates);
state = transitionCampaign(state, 'submit_customer_review', gates);
state = transitionCampaign(state, 'approve_content', gates);
state = transitionCampaign(state, 'submit_to_publisher', gates);
state = transitionCampaign(state, 'publisher_accept', gates);
state = transitionCampaign(state, 'report_published', gates);
state = transitionCampaign(state, 'begin_verification', gates);
state = transitionCampaign(state, 'verify_live', gates);
state = transitionCampaign(state, 'begin_monitoring', gates);
expect(state === 'monitoring', 'happy-path campaign lifecycle should reach monitoring');
rejects(() => transitionCampaign('draft', 'confirm_funding', gates), 'funding cannot skip campaign approval/payment states');
rejects(() => transitionCampaign('awaiting_payment', 'confirm_funding', { ...gates, paymentOrCreditConfirmed: false }), 'funding requires PAY/credit confirmation');
rejects(() => transitionCampaign('customer_content_review', 'approve_content', { ...gates, rightsCleared: false }), 'content approval requires rights clearance');
rejects(() => transitionCampaign('scheduled', 'report_published', { ...gates, publicationEvidencePresent: false }), 'published report requires evidence');

const offer: PublisherOffer = {
  offerId: 'offer-1', publisherId: 'publisher-1', currency: 'ZAR', amountMinor: 125000,
  offerType: 'sponsored_article', disclosureRequired: true, linkQualification: 'sponsored',
  finalEditorialControl: true, scopeDescription: 'One disclosed sponsored feature', quoteExpiresAt: '2027-01-01T00:00:00.000Z',
};
expect(validatePublisherOffer(offer).length === 0, 'valid publisher offer should pass');
expect(validatePublisherOffer({ ...offer, linkQualification: 'none' }).includes('PAID_LINK_REQUIRES_QUALIFICATION'), 'paid placement without qualification must fail');
expect(validatePublisherOffer({ ...offer, currency: 'R' }).includes('CURRENCY_CODE_FORMAT_INVALID'), 'malformed currency code must fail');
expect(validatePublisherOffer({ ...offer, disclosureRequired: false }).includes('PAID_FORMAT_REQUIRES_DISCLOSURE'), 'paid format must require disclosure');

const hash = 'a'.repeat(64);
const approval: ContentApproval = {
  contentAssetId: 'asset-1', contentHash: hash, approvedHash: hash, approverRef: 'principal-1',
  purpose: 'customer_publication_approval', approvedAt: '2026-11-26T00:00:00.000Z',
};
expect(validateContentApproval(approval, hash).length === 0, 'approval bound to exact current hash should pass');
expect(validateContentApproval(approval, 'b'.repeat(64)).includes('APPROVAL_HASH_MISMATCH'), 'edited content must invalidate old approval');

const placement: PlacementEvidence = {
  url: 'https://publisher.example/article', publisherDomain: 'publisher.example', resolvedDomain: 'publisher.example',
  contentMatchesApprovedVersion: true, disclosurePresent: true, linkQualification: 'sponsored',
  checkedAt: '2026-11-26T00:00:00.000Z', httpStatus: 200, status: 'live', evidenceRef: 'evidence://placement/1',
};
expect(verifyPlacementEvidence(placement).length === 0, 'complete live placement evidence should pass');
expect(verifyPlacementEvidence({ ...placement, resolvedDomain: 'other.example' }).includes('PUBLISHER_DOMAIN_MISMATCH'), 'domain mismatch must fail');
expect(verifyPlacementEvidence({ ...placement, url: 'https://other.example/article' }).includes('PUBLISHER_DOMAIN_MISMATCH'), 'URL hostname must match verified publisher domain');
expect(verifyPlacementEvidence({ ...placement, url: 'https://user:pass@publisher.example/article' }).includes('PLACEMENT_URL_CREDENTIALS_FORBIDDEN'), 'credential-bearing URL must fail');
expect(verifyPlacementEvidence({ ...placement, status: 'unknown' }).includes('PLACEMENT_NOT_CONFIRMED_LIVE'), 'unknown status must not be reported as live');
expect(verifyPlacementEvidence({ ...placement, disclosurePresent: false }).includes('DISCLOSURE_NOT_VERIFIED'), 'missing disclosure must fail verification');
expect(verifyPlacementEvidence({ ...placement, linkQualification: 'none' }).includes('LINK_QUALIFICATION_NOT_COMPLIANT'), 'unqualified paid link must fail verification');

console.log('IZAKHONO PUBLISHER MARKETPLACE CONTRACTS: PASS');
