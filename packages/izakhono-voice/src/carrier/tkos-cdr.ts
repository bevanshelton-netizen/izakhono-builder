export type TkosCdr = {
  id: string;
  callId?: string;
  from?: string;
  to?: string;
  status?: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  billableSeconds?: number;
  cost?: number;
  currency?: string;
  route?: string;
  [key: string]: unknown;
};

export type TkosCdrQuery = {
  from?: string;
  to?: string;
  route?: string;
  partner?: string;
};

export class TkosCdrClient {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.tkos.co.za',
  ) {}

  async list(query: TkosCdrQuery = {}): Promise<TkosCdr[]> {
    if (!this.apiKey) throw new Error('TKOS_API_KEY is not configured');

    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value) params.set(key, value);
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`${this.baseUrl}/v1/cdrs${suffix}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TKOS CDR request failed (${response.status}): ${body}`);
    }

    const payload = (await response.json()) as TkosCdr[] | { data?: TkosCdr[] };
    return Array.isArray(payload) ? payload : payload.data ?? [];
  }
}
