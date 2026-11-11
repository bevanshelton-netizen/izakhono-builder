import { strict as assert } from "node:assert";
import { VoicePreferences } from "./voice-preferences.js";

const values = new Map<string, string>();
const store = {
  async get(key: string) { return values.get(key) ?? null; },
  async put(key: string, value: string) { values.set(key, value); },
};
const preferences = new VoicePreferences(store);
const saved = await preferences.set("user-123", "izakhono-nav", {
  gender: "feminine", locale: "en-ZA", speechRate: 1.1,
});
assert.equal(saved.voiceKey, "za-nav-calm-f");
assert.equal((await preferences.get("user-123", "izakhono-nav")).voiceKey, "za-nav-calm-f");
assert.equal((await preferences.get("user-123", "fortress")).voiceKey, "za-fortress-composed");
await assert.rejects(() => preferences.get("../bad\nuser", "fortress"), /voice-user-identity-invalid/);
console.log("IZAKHONO voice preference tests passed");
