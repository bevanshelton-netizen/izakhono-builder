export class ProviderRouter {
  #providers = new Map();

  register({ name, priority = 100, adapter }) {
    if (!name || !adapter?.charge) throw new Error('provider name and charge adapter are required');
    this.#providers.set(name, { name, priority, adapter, enabled: true });
    return this;
  }

  disable(name) {
    const provider = this.#providers.get(name);
    if (provider) provider.enabled = false;
  }

  route(request) {
    const providers = [...this.#providers.values()]
      .filter(p => p.enabled)
      .sort((a, b) => a.priority - b.priority);
    if (!providers.length) throw new Error('No payment providers available');

    const attempts = [];
    for (const provider of providers) {
      try {
        const result = provider.adapter.charge(request);
        attempts.push({ provider: provider.name, status: 'success' });
        return { ...result, provider: provider.name, attempts };
      } catch (error) {
        attempts.push({ provider: provider.name, status: 'failed', reason: error.message });
      }
    }
    return { status: 'unavailable', provider: null, attempts };
  }

  registry() {
    return [...this.#providers.values()].map(({ name, priority, enabled }) => ({ name, priority, enabled }));
  }
}

export const sandboxProvider = (name, behaviour = 'success') => ({
  charge(request) {
    if (behaviour === 'failure') throw new Error(`${name} simulated failure`);
    return { status: 'succeeded', transaction_id: `txn_${crypto.randomUUID()}`, amount_minor: request.amountMinor, currency: request.currency };
  }
});
