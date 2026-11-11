/**
 * IZAKHONO Voice Engine — provider-neutral voice identity and resolution.
 *
 * This module selects a voice profile. It does not synthesize audio; a server-side
 * TTS adapter must resolve the returned voiceKey to a configured provider voice.
 * Never expose provider credentials or raw provider configuration to clients.
 */
export type VoiceStyle = "executive" | "calm-navigation" | "friendly" | "technical" | "reassuring" | "patient";
export type VoiceGender = "feminine" | "masculine" | "neutral";
export type VoiceProduct =
  | "izakhono-ai" | "izakhono-nav" | "kora-network" | "izakhono-builder"
  | "fortress" | "business-assistant" | "edu-build";

export interface VoiceProfile {
  product: VoiceProduct;
  displayName: string;
  style: VoiceStyle;
  defaultVoiceKey: string;
  alternatives: Partial<Record<VoiceGender, string>>;
  defaultLocale: string;
  supportedLocales: string[];
  speechRate: number;
}

export interface VoicePreference {
  voiceKey?: string;
  gender?: VoiceGender;
  locale?: string;
  speechRate?: number;
}

export interface ResolvedVoice {
  product: VoiceProduct;
  voiceKey: string;
  locale: string;
  speechRate: number;
  style: VoiceStyle;
  fallback: boolean;
}

const profile = (
  product: VoiceProduct, displayName: string, style: VoiceStyle,
  defaultVoiceKey: string, defaultLocale = "en-ZA",
  alternatives: Partial<Record<VoiceGender, string>> = {},
  supportedLocales = ["en-ZA"], speechRate = 1,
): VoiceProfile => ({
  product, displayName, style, defaultVoiceKey, alternatives,
  defaultLocale, supportedLocales, speechRate,
});

/**
 * Voice keys are logical IDs, not vendor IDs. Map them to actual provider voice
 * IDs in server-only configuration after provider selection and voice audition.
 */
export const VOICE_PROFILES: Readonly<Record<VoiceProduct, VoiceProfile>> = {
  "izakhono-ai": profile("izakhono-ai", "IZAKHONO AI", "executive", "za-executive-warm", "en-ZA",
    { feminine: "za-executive-warm-f", masculine: "za-executive-warm-m" },
    ["en-ZA"]),
  "izakhono-nav": profile("izakhono-nav", "IZAKHONO NAV", "calm-navigation", "za-nav-calm", "en-ZA",
    { feminine: "za-nav-calm-f", masculine: "za-nav-calm-m" },
    ["en-ZA", "zu-ZA", "xh-ZA", "af-ZA"], 0.96),
  "kora-network": profile("kora-network", "KORA Network", "friendly", "za-kora-friendly", "en-ZA",
    { feminine: "za-kora-friendly-f", masculine: "za-kora-friendly-m" },
    ["en-ZA"]),
  "izakhono-builder": profile("izakhono-builder", "IZAKHONO Builder", "technical", "za-builder-clear", "en-ZA",
    { feminine: "za-builder-clear-f", masculine: "za-builder-clear-m" },
    ["en-ZA", "zu-ZA", "xh-ZA", "af-ZA"]),
  fortress: profile("fortress", "FORTRESS", "reassuring", "za-fortress-composed", "en-ZA",
    { feminine: "za-fortress-composed-f", masculine: "za-fortress-composed-m" },
    ["en-ZA", "zu-ZA", "xh-ZA", "af-ZA"], 0.94),
  "business-assistant": profile("business-assistant", "Business Assistant", "executive", "za-business-executive", "en-ZA",
    { feminine: "za-business-executive-f", masculine: "za-business-executive-m" },
    ["en-ZA", "zu-ZA", "xh-ZA", "af-ZA"]),
  "edu-build": profile("edu-build", "Edu-Build AI", "patient", "za-edu-patient", "en-ZA",
    { feminine: "za-edu-patient-f", masculine: "za-edu-patient-m" },
    ["en-ZA", "zu-ZA", "xh-ZA", "af-ZA", "st-ZA", "tn-ZA"], 0.97),
};

export function resolveVoice(
  product: VoiceProduct,
  preference: VoicePreference = {},
): ResolvedVoice {
  const selected = VOICE_PROFILES[product];
  const locale = preference.locale && selected.supportedLocales.includes(preference.locale)
    ? preference.locale : selected.defaultLocale;
  const genderVoice = preference.gender ? selected.alternatives[preference.gender] : undefined;
  const requestedVoice = preference.voiceKey?.trim();
  // Only accept voice keys explicitly registered for this product. This prevents
  // cross-product identity leakage and arbitrary provider voice selection.
  const allowed = new Set([selected.defaultVoiceKey, ...Object.values(selected.alternatives)]);
  const requestedAllowed = requestedVoice ? allowed.has(requestedVoice) : false;
  const voiceKey = requestedAllowed ? requestedVoice! : genderVoice ?? selected.defaultVoiceKey;
  return {
    product, voiceKey, locale,
    speechRate: Number.isFinite(preference.speechRate)
      ? Math.min(1.2, Math.max(0.8, preference.speechRate!))
      : selected.speechRate,
    style: selected.style,
    fallback: !requestedAllowed && !!requestedVoice,
  };
}

/** Provider adapter contract. Implementations must run server-side. */
export interface TextToSpeechAdapter {
  readonly provider: string;
  synthesize(input: {
    text: string;
    voiceKey: string;
    locale: string;
    speechRate: number;
    style: VoiceStyle;
    signal?: AbortSignal;
  }): Promise<{ audio: Uint8Array; contentType: string }>;
}
