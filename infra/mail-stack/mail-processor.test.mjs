import assert from "node:assert/strict";
import { createRegistry, processMessage } from "./mail-processor.mjs";

const registry = createRegistry([
  { id: "kora", slug: "kora" },
  { id: "fortress", slug: "fortress" }
]);

const delivered = processMessage({
  from: "Customer <customer@example.com>",
  to: ["kora@izakhonoafrica.co.za"],
  subject: "Partnership enquiry",
  bodyText: "Please contact me regarding a partnership.",
  receivedAt: "2026-10-11T19:00:00Z"
}, registry);
assert.equal(delivered.disposition, "deliver");
assert.equal(delivered.routes[0].platformId, "kora");

const phishing = processMessage({
  from: "attacker@example.net",
  to: ["fortress@izakhonoafrica.co.za"],
  subject: "Urgent action required",
  bodyText: "Click here to verify the account."
}, registry);
assert.equal(phishing.disposition, "security-review");
assert.equal(phishing.analysis.category, "phishing");

const unknown = processMessage({
  from: "sender@example.net",
  to: ["unknown@izakhonoafrica.co.za"],
  subject: "Hello",
  bodyText: "Test"
}, registry);
assert.equal(unknown.disposition, "unrouted");
assert.deepEqual(unknown.unknownRecipients, ["unknown@izakhonoafrica.co.za"]);

console.log("IZAKHONO MAIL processor tests PASSED");
