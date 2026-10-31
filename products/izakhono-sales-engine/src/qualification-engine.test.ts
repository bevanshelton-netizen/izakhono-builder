import { qualifyLead } from "./qualification-engine";

const fnb = qualifyLead({
  company: "FNB",
  contact: "Procurement Team",
  role: "Procurement",
  email: "procurement@example.com",
  need: "Corporate apparel & uniforms",
});

if (fnb.score < 85 || fnb.stage !== "outreach_ready") {
  throw new Error(`FNB qualification failed: ${JSON.stringify(fnb)}`);
}

const weak = qualifyLead({ company: "Unknown Prospect" });
if (weak.score !== 15 || weak.stage !== "new") {
  throw new Error(`Weak lead qualification failed: ${JSON.stringify(weak)}`);
}

const fleet = qualifyLead({
  company: "Secure Fleet Prospect",
  contact: "Operations Director",
  role: "Operations Director",
  need: "Secure fleet mobility & driver safety",
});

if (fleet.score < 70 || fleet.stage !== "qualified") {
  throw new Error(`Fleet qualification failed: ${JSON.stringify(fleet)}`);
}

console.log("Sales Engine qualification tests passed");
