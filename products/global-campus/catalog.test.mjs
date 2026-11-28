import test from "node:test";
import assert from "node:assert/strict";
import {
  normalize, validateInstitution, validateModule, validateAlignment,
  searchModules, canPublishProduct, getStudentDisclosure
} from "./catalog.mjs";

const institution = {
  id: "za-demo-university",
  name: "Example Public University",
  country: "ZA",
  institution_type: "public-university",
  source: { url: "https://example.edu.za/about" },
  verification: { status: "verified", verified_at: "2026-11-01" }
};

const verifiedModule = {
  id: "demo-accounting-101",
  institution_id: institution.id,
  qualification_title: "Illustrative Bachelor of Commerce",
  title: "Introduction to Financial Accounting",
  code: "DEMO101",
  learning_outcomes: ["prepare basic financial statements"],
  topics: ["accounting equation", "debits and credits"],
  source: { url: "https://example.edu.za/handbook", accessed_at: "2026-11-01" },
  verification_status: "verified",
  verified_at: "2026-11-01"
};

test("normalizes Unicode and punctuation for search", () => {
  assert.equal(normalize("  CAFÉ & Law  "), "cafe law");
});

test("institution verification requires a source and verification date", () => {
  assert.deepEqual(validateInstitution(institution), []);
  assert.ok(validateInstitution({ ...institution, verification: { status: "verified" } }).includes("verified institution requires verified_at"));
});

test("module validation requires official provenance", () => {
  assert.deepEqual(validateModule(verifiedModule), []);
  assert.ok(validateModule({ ...verifiedModule, source: {} }).includes("missing official curriculum source URL"));
});

test("student search excludes unverified institution and module records", () => {
  const results = searchModules({
    query: "financial accounting",
    institutions: [institution],
    modules: [verifiedModule, { ...verifiedModule, id: "draft", verification_status: "needs-review" }]
  });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, verifiedModule.id);
  assert.ok(results[0].relevance > 0);
});

test("alignment cannot imply endorsement without documentary evidence", () => {
  const alignment = {
    module_id: verifiedModule.id,
    publication_id: "guide-001",
    level: "strong",
    rationale: "Explains the stated learning outcomes.",
    evidence: { source_url: "https://example.edu.za/handbook" },
    institution_endorsed: true
  };
  assert.ok(validateAlignment(alignment).includes("institutional endorsement requires written evidence URL"));
});

test("publication gate blocks uncleared rights and unreviewed products", () => {
  const result = canPublishProduct({
    publication: {
      id: "guide-001", title: "Accounting Foundations", rights_status: "pending",
      editorial_status: "approved", references: ["https://example.org"]
    },
    alignments: [{
      module_id: verifiedModule.id, publication_id: "guide-001", level: "strong",
      rationale: "Mapped to module outcomes.", evidence: { source_url: verifiedModule.source.url },
      review_status: "approved"
    }],
    modules: [verifiedModule]
  });
  assert.equal(result.publishable, false);
  assert.ok(result.blockers.includes("publication rights are not cleared"));
});

test("publication gate passes only when required checks and verified alignment pass", () => {
  const result = canPublishProduct({
    publication: {
      id: "guide-001", title: "Accounting Foundations", rights_status: "cleared",
      editorial_status: "approved", references: ["https://example.org"]
    },
    alignments: [{
      module_id: verifiedModule.id, publication_id: "guide-001", level: "strong",
      rationale: "Mapped to module outcomes.", evidence: { source_url: verifiedModule.source.url },
      review_status: "approved"
    }],
    modules: [verifiedModule]
  });
  assert.equal(result.publishable, true);
});

test("student disclosure avoids false institutional affiliation", () => {
  assert.match(getStudentDisclosure(), /Not prescribed, approved or endorsed/);
});
