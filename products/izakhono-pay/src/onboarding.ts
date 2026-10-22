export type OnboardingStatus = 'pending_kyb' | 'under_review' | 'verified' | 'rejected' | 'suspended';

const transitions: Record<OnboardingStatus, OnboardingStatus[]> = {
  pending_kyb: ['under_review', 'rejected'],
  under_review: ['verified', 'rejected', 'pending_kyb'],
  verified: ['suspended'],
  rejected: ['pending_kyb'],
  suspended: ['under_review'],
};

export function canTransition(from: OnboardingStatus, to: OnboardingStatus) {
  return transitions[from]?.includes(to) ?? false;
}

export function assertTransition(from: OnboardingStatus, to: OnboardingStatus) {
  if (!canTransition(from, to)) throw new Error(`invalid_onboarding_transition:${from}->${to}`);
}

export function normalizeOnboardingStatus(value: unknown): OnboardingStatus | null {
  const v = String(value || '').trim() as OnboardingStatus;
  return ['pending_kyb','under_review','verified','rejected','suspended'].includes(v) ? v : null;
}
