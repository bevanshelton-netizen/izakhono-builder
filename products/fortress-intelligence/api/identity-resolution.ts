import { SearchEntity } from "./provider-contract";

export interface IdentityCandidate {
  candidateId: string;
  provider: string;
  entityId?: string;
  confidence: number;
  matchedAttributes: string[];
  reasons: string[];
}

function normalise(value = "") {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ");
}

function tokenOverlap(a: string, b: string) {
  const left = new Set(normalise(a).split(" ").filter(Boolean));
  const right = new Set(normalise(b).split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  let common = 0;
  for (const token of left) if (right.has(token)) common++;
  return common / Math.max(left.size, right.size);
}

/** Conservative identity matching. It produces candidates; it never makes a final identity decision. */
export function resolveIdentity(
  input: SearchEntity,
  candidates: Array<{ provider: string; entityId?: string; name: string; country?: string; registrationNumber?: string; dateOfBirth?: string }>,
): IdentityCandidate[] {
  return candidates.map((candidate, index) => {
    const nameScore = tokenOverlap(input.name, candidate.name);
    let score = nameScore * 0.7;
    const matchedAttributes: string[] = ["name"];
    const reasons: string[] = [];

    if (input.country && candidate.country && normalise(input.country) === normalise(candidate.country)) {
      score += 0.1;
      matchedAttributes.push("country");
    }
    if (input.registrationNumber && candidate.registrationNumber && input.registrationNumber === candidate.registrationNumber) {
      score += 0.2;
      matchedAttributes.push("registrationNumber");
    }
    if (input.dateOfBirth && candidate.dateOfBirth && input.dateOfBirth === candidate.dateOfBirth) {
      score += 0.2;
      matchedAttributes.push("dateOfBirth");
    }

    if (nameScore < 0.5) reasons.push("weak_name_match");
    if (matchedAttributes.length === 1) reasons.push("single_attribute_match");
    if (score >= 0.85) reasons.push("strong_candidate");
    else if (score >= 0.6) reasons.push("review_candidate");
    else reasons.push("low_confidence_candidate");

    return {
      candidateId: `${candidate.provider}:${candidate.entityId ?? index}`,
      provider: candidate.provider,
      entityId: candidate.entityId,
      confidence: Math.min(1, Number(score.toFixed(4))),
      matchedAttributes,
      reasons,
    };
  }).sort((a, b) => b.confidence - a.confidence);
}
