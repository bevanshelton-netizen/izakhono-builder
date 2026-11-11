import { resolveVoice, type VoicePreference, type VoiceProduct } from "./voice-profiles.js";

export interface VoicePreferenceStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

/**
 * Storage keys are namespaced by authenticated subject and product. The caller
 * must obtain userId from verified server-side authentication, never request JSON.
 */
export class VoicePreferences {
  constructor(private readonly store: VoicePreferenceStore) {}

  private key(userId: string, product: VoiceProduct): string {
    if (!userId || userId.length > 200 || /[\r\n]/.test(userId)) {
      throw new Error("voice-user-identity-invalid");
    }
    return `voice-preference:v1:${encodeURIComponent(userId)}:${product}`;
  }

  async get(userId: string, product: VoiceProduct) {
    const raw = await this.store.get(this.key(userId, product));
    if (!raw) return resolveVoice(product);
    let preference: VoicePreference;
    try { preference = JSON.parse(raw) as VoicePreference; }
    catch { return resolveVoice(product); }
    return resolveVoice(product, preference);
  }

  async set(userId: string, product: VoiceProduct, preference: VoicePreference) {
    const resolved = resolveVoice(product, preference);
    // Persist only normalized, allow-listed values; never persist provider IDs.
    const safe: VoicePreference = {
      voiceKey: resolved.voiceKey,
      locale: resolved.locale,
      speechRate: resolved.speechRate,
    };
    await this.store.put(this.key(userId, product), JSON.stringify(safe));
    return resolved;
  }
}
