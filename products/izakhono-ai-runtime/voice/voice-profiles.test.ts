import { strict as assert } from "node:assert";
import { resolveVoice } from "./voice-profiles.js";

const ai = resolveVoice("izakhono-ai");
const nav = resolveVoice("izakhono-nav");
assert.notEqual(ai.voiceKey, nav.voiceKey, "products must not share the same default voice");
assert.equal(resolveVoice("kora-network", { gender: "feminine" }).voiceKey, "za-kora-friendly-f");
assert.equal(resolveVoice("edu-build", { locale: "zu-ZA" }).locale, "en-ZA");
assert.equal(resolveVoice("edu-build", { locale: "fr-FR" }).locale, "en-ZA");
assert.equal(resolveVoice("fortress", { speechRate: 9 }).speechRate, 1.2);
const rejected = resolveVoice("fortress", { voiceKey: "za-kora-friendly-f" });
assert.equal(rejected.voiceKey, "za-fortress-composed");
assert.equal(rejected.fallback, true);
console.log("IZAKHONO voice profile tests passed");
