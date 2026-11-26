const VERIFIED = "verified";
const ALIGNMENT_LEVELS = new Set(["exact", "strong", "supplementary", "adjacent"]);

export function normalize(value = "") {
  return String(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function words(value) {
  return new Set(normalize(value).split(/\s+/).filter(Boolean));
}

export function validateInstitution(record) {
  const errors = [];
  if (!record || typeof record !== "object") return ["institution record must be an object"];
  for (const key of ["id", "name", "country", "institution_type"]) {
    if (!String(record[key] ?? "").trim()) errors.push(`missing ${key}`);
  }
  if (!record.source?.url) errors.push("missing authoritative source URL");
  if (!record.verification?.status) errors.push("missing verification status");
  if (record.verification?.status === VERIFIED && !record.verification?.verified_at) {
    errors.push("verified institution requires verified_at");
  }
  return errors;
}

export function validateModule(record) {
  const errors = [];
  if (!record || typeof record !== "object") return ["module record must be an object"];
  for (const key of ["id", "institution_id", "qualification_title", "title"]) {
    if (!String(record[key] ?? "").trim()) errors.push(`missing ${key}`);
  }
  if (!record.source?.url) errors.push("missing official curriculum source URL");
  if (!record.source?.accessed_at) errors.push("missing source access date");
  if (!record.verification_status) errors.push("missing verification status");
  if (!Array.isArray(record.learning_outcomes)) errors.push("learning_outcomes must be an array");
  if (!Array.isArray(record.topics)) errors.push("topics must be an array");
  if (record.verification_status === VERIFIED && !record.verified_at) {
    errors.push("verified module requires verified_at");
  }
  return errors;
}

export function validateAlignment(record) {
  const errors = [];
  if (!record?.module_id) errors.push("missing module_id");
  if (!record?.publication_id) errors.push("missing publication_id");
  if (!ALIGNMENT_LEVELS.has(record?.level)) errors.push("invalid alignment level");
  if (!String(record?.rationale ?? "").trim()) errors.push("missing alignment rationale");
  if (!record?.evidence?.source_url) errors.push("missing alignment evidence source");
  if (record?.institution_endorsed === true && !record?.endorsement?.evidence_url) {
    errors.push("institutional endorsement requires written evidence URL");
  }
  return errors;
}

function scoreRecord(queryTokens, record) {
  const fields = [
    record.title,
    record.code,
    record.qualification_title,
    record.institution_name,
    ...(record.topics ?? []),
    ...(record.learning_outcomes ?? [])
  ];
  const haystack = words(fields.filter(Boolean).join(" "));
  if (!haystack.size || !queryTokens.size) return 0;
  let hits = 0;
  for (const token of queryTokens) if (haystack.has(token)) hits += 1;
  return hits / queryTokens.size;
}

/**
 * Search only records explicitly marked verified. Draft/unverified records remain
 * available to administrators but are not exposed as authoritative student results.
 */
export function searchModules({ query, modules = [], institutions = [], limit = 20 } = {}) {
  const queryTokens = words(query);
  if (!queryTokens.size) return [];
  const institutionById = new Map(institutions.map(item => [item.id, item]));
  return modules
    .filter(item => item.verification_status === VERIFIED)
    .filter(item => institutionById.get(item.institution_id)?.verification?.status === VERIFIED)
    .map(item => ({
      ...item,
      institution_name: institutionById.get(item.institution_id).name,
      relevance: scoreRecord(queryTokens, {
        ...item,
        institution_name: institutionById.get(item.institution_id).name
      })
    }))
    .filter(item => item.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, Number(limit) || 20));
}

export function canPublishProduct({ publication, alignments = [], modules = [] } = {}) {
  const blockers = [];
  if (!publication?.id || !publication?.title) blockers.push("publication identity is incomplete");
  if (publication?.rights_status !== "cleared") blockers.push("publication rights are not cleared");
  if (publication?.editorial_status !== "approved") blockers.push("editorial approval is incomplete");
  if (publication?.specialist_review_required && publication?.specialist_review_status !== "approved") {
    blockers.push("required specialist review is incomplete");
  }
  if (!Array.isArray(publication?.references) || publication.references.length === 0) {
    blockers.push("publication has no source references");
  }
  const moduleIds = new Set(modules.filter(m => m.verification_status === VERIFIED).map(m => m.id));
  const approvedAlignments = alignments.filter(a =>
    a.publication_id === publication?.id &&
    a.review_status === "approved" &&
    !validateAlignment(a).length &&
    moduleIds.has(a.module_id)
  );
  if (!approvedAlignments.length) blockers.push("no approved alignment to a verified module");
  return { publishable: blockers.length === 0, blockers, approved_alignment_count: approvedAlignments.length };
}

export function getStudentDisclosure({ institutionEndorsed = false } = {}) {
  return institutionEndorsed
    ? "Institutional endorsement is recorded separately and must be supported by written evidence."
    : "Independent supplementary learning resource. Not prescribed, approved or endorsed by the institution unless explicitly stated with documented permission.";
}
