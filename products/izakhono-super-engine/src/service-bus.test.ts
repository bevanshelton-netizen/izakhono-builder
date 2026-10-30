import { describe, expect, it } from 'vitest';
import { ServiceBus } from './service-bus.js';

const modules = ['compute', 'ai', 'security'] as const;
const message = (external = false) => ({
  id: 'msg-1',
  source: 'compute',
  destination: 'ai',
  topic: 'inference.request',
  payload: { value: 1 },
  createdAt: new Date().toISOString(),
  external,
});

describe('ServiceBus', () => {
  it('delivers registered module messages', async () => {
    const bus = new ServiceBus(modules);
    let received = false;
    bus.subscribe('ai', () => { received = true; });
    await expect(bus.publish(message())).resolves.toEqual({ delivered: 1 });
    expect(received).toBe(true);
  });

  it('rejects unknown destinations', async () => {
    const bus = new ServiceBus(modules);
    await expect(bus.publish({ ...message(), destination: 'network' as never })).rejects.toThrow('Unknown engine module');
  });

  it('denies external bridging by default', async () => {
    const bus = new ServiceBus(modules);
    await expect(bus.publish(message(true))).rejects.toThrow('External service-bus bridge is disabled');
  });

  it('enforces FORTRESS before delivery and audits denial', async () => {
    let audited = false;
    const bus = new ServiceBus(modules, {}, {
      fortress: () => false,
      audit: (_message, delivered, reason) => {
        audited = !delivered && reason === 'FORTRESS denied message';
      },
    });
    await expect(bus.publish(message())).rejects.toThrow('FORTRESS denied service-bus message');
    expect(audited).toBe(true);
  });

  it('enforces explicit route allowlists when configured', async () => {
    const bus = new ServiceBus(modules, { allowedRoutes: ['compute:ai:allowed'] });
    await expect(bus.publish(message())).rejects.toThrow('Service-bus route not allowed');
  });
});
