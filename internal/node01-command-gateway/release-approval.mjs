export function evaluateApprovedRelease(profile, requestedRef) {
  const approvedRef = profile?.approved_ref;

  if (typeof approvedRef !== 'string' || !/^[0-9a-f]{40}$/.test(approvedRef)) {
    return { ok: false, reason: 'missing_or_invalid_approval' };
  }

  if (typeof requestedRef !== 'string' || !/^[0-9a-f]{40}$/.test(requestedRef)) {
    return { ok: false, reason: 'invalid_requested_ref' };
  }

  if (approvedRef !== requestedRef) {
    return { ok: false, reason: 'ref_mismatch' };
  }

  return { ok: true, reason: 'approved_exact_match' };
}
