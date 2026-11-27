#!/usr/bin/env node
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const path = new URL("./storefront-prototype/index.html", import.meta.url);
const html = readFileSync(path, "utf8");
const checks = [
  ["HTML5 doctype", /<!doctype html>/i],
  ["language declaration", /<html lang="en">/i],
  ["responsive viewport", /name="viewport"[^>]*width=device-width/i],
  ["descriptive page title", /<title>[^<]{8,}<\/title>/i],
  ["main landmark", /<main[\s>]/i],
  ["navigation landmark", /<nav\s+aria-label=/i],
  ["single primary heading", /<h1[\s>]/i],
  ["reduced-motion support", /prefers-reduced-motion:\s*reduce/i],
  ["mobile layout breakpoint", /@media\s*\(max-width:\s*620px\)/i],
  ["draft product status", /Editorial draft\s*[·-]\s*Not for sale/i],
  ["no live purchase control", /cannot be purchased/i],
  ["no fabricated social proof", /No testimonials, customer counts or endorsements/i],
  ["no external checkout destination", !/href=["']https?:\/\/(?:checkout|pay|buy)[^"']*["']/i.test(html) ? /<footer>/i : /$a/],
];

let failures = 0;
for (const [name, pattern] of checks) {
  const ok = pattern instanceof RegExp ? pattern.test(html) : Boolean(pattern);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failures++;
}
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicateIds.length) {
  console.error("FAIL duplicate element IDs:", [...new Set(duplicateIds)].join(", "));
  failures++;
} else {
  console.log("PASS unique element IDs");
}
const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const missingTargets = hrefs.filter((id) => !ids.includes(id) && id !== "");
if (missingTargets.length) {
  console.error("FAIL missing in-page targets:", [...new Set(missingTargets)].join(", "));
  failures++;
} else {
  console.log("PASS in-page navigation targets");
}
assert.equal(failures, 0, `${failures} storefront check(s) failed`);
console.log("Storefront prototype checks passed.");
