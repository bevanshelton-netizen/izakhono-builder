export type VoiceCallRequest = {
  from: string;
  to: string;
  webhook?: string;
  metadata?: Record<string, string>;
};

export type VoiceCall = {
  id: string;
  status: string;
  route?: string;
};

export interface VoiceCarrier {
  placeCall(request: VoiceCallRequest, idempotencyKey: string): Promise<VoiceCall>;
}

export class TkosCarrier implements VoiceCarrier {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.tkos.co.za',
  ) {}

  async placeCall(request: VoiceCallRequest, idempotencyKey: string): Promise<VoiceCall> {
    if (!this.apiKey) throw new Error('TKOS_API_KEY is not configured');

    const response = await fetch(`${this.baseUrl}/v1/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TKOS call failed (${response.status}): ${body}`);
    }

    return (await response.json()) as VoiceCall;
  }
}
