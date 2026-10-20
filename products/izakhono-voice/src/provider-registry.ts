import type {
  CaseStore,
  KnowledgeAdapter,
  ModelAdapter,
  TelephonyAdapter,
  VoiceAdapter,
} from "./types";

export interface IzakhonoVoiceProviders {
  telephony: TelephonyAdapter;
  voice: VoiceAdapter;
  knowledge: KnowledgeAdapter;
  model: ModelAdapter;
  cases: CaseStore;
}

/**
 * Provider-neutral dependency container.
 *
 * The application depends only on IZAKHONO interfaces. Concrete providers are
 * selected by the runtime/bootstrap layer and are deliberately not embedded
 * in the call-centre orchestration code.
 */
export class ProviderRegistry {
  private providers?: IzakhonoVoiceProviders;

  register(providers: IzakhonoVoiceProviders): void {
    this.providers = providers;
  }

  get(): IzakhonoVoiceProviders {
    if (!this.providers) {
      throw new Error("IZAKHONO VOICE providers have not been registered");
    }
    return this.providers;
  }
}
