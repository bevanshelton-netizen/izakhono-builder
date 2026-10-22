export type VoiceNumber = {
  id: string;
  number: string;
  country?: string;
  capabilities?: string[];
  status?: string;
};

export type NumberSearch = {
  country?: string;
  areaCode?: string;
  limit?: number;
};

export class TkosNumbers {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = 'https://api.tkos.co.za',
  ) {}

  async search(params: NumberSearch = {}): Promise<VoiceNumber[]> {
    if (!this.apiKey) throw new Error('TKOS_API_KEY is not configured');

    const url = new URL(`${this.baseUrl}/v1/numbers`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`TKOS number search failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as VoiceNumber[] | { numbers: VoiceNumber[] };
    return Array.isArray(data) ? data : data.numbers;
  }
}
