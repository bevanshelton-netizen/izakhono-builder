import test from "node:test";
import assert from "node:assert/strict";
import { createEmergencyEnvelope, planEmergencyFallback, selectEmergencyRoutes, transitionDelivery } from "./emergency-communications-core.mjs";
test("only explicitly supported, available and consented paths are eligible", () => {
 const r = selectEmergencyRoutes({ internet_ptt:{supported:true,available:false}, cellular_voice:{supported:true,available:true,requiresUserAction:true}, sms:{supported:true,available:true,consentRequired:true,consentGranted:false}, satellite:{supported:false,available:true} });
 assert.deepEqual(r.map(x=>x.route), ["cellular_voice"]);
});
test("no route is reported honestly", () => { const p=planEmergencyFallback({}); assert.equal(p.noRouteAvailable,true); assert.match(p.userWarning,/No communication route/); });
test("fallback order is deterministic", () => { const p=planEmergencyFallback({sms:{supported:true,available:true},internet_ptt:{supported:true,available:true}}); assert.equal(p.primary.route,"internet_ptt"); assert.equal(p.alternatives[0].route,"sms"); });
test("sent and delivered require trusted receipts", () => { assert.throws(()=>transitionDelivery("attempting","sent"),/receiptId/); assert.equal(transitionDelivery("attempting","sent",{receiptId:"provider-1"}).state,"sent"); });
test("human acknowledgement requires explicit human evidence", () => { assert.throws(()=>transitionDelivery("delivered","acknowledged",{receiptId:"r1"}),/Human acknowledgement/); assert.equal(transitionDelivery("delivered","acknowledged",{receiptId:"r1",humanAcknowledgement:true}).state,"acknowledged"); });
test("acknowledged event cannot regress", () => { assert.throws(()=>transitionDelivery("acknowledged","queued"),/Invalid delivery transition/); });
test("emergency envelope validates and deduplicates channels", () => { const e=createEmergencyEnvelope({eventId:"evt-1",createdAt:"2026-11-08T10:00:00Z",severity:"critical",requestedChannels:["internet_ptt","sms","sms"],location:{latitude:-29.8,longitude:31,accuracyMetres:15}}); assert.deepEqual(e.requestedChannels,["internet_ptt","sms"]); assert.equal(e.location.accuracyMetres,15); assert.throws(()=>createEmergencyEnvelope({eventId:"e",createdAt:"now",requestedChannels:["fake"]}),/Unsupported/); });