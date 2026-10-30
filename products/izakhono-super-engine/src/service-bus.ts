import type { EngineModuleId } from './types.js';

export interface ServiceMessage<T = unknown> {
  id: string;
  source: EngineModuleId;
  destination: EngineModuleId;
  topic: string;
  payload: T;
  createdAt: string;
  external: boolean;
}

export interface ServiceBusPolicy {
  allowExternalBridge?: boolean;
  maxPayloadBytes?: number;
  allowedRoutes?: readonly string[];
}

export interface ServiceBusHooks {
  fortress?: (message: ServiceMessage) => boolean | Promise<boolean>;
  audit?: (message: ServiceMessage, delivered: boolean, reason?: string) => void | Promise<void>;
}

export type ServiceHandler<T = unknown> = (message: ServiceMessage<T>) => void | Promise<void>;

/** Controlled internal fabric for communication between Super Engine modules. */
export class ServiceBus {
  private readonly handlers = new Map<EngineModuleId, Set<ServiceHandler>>();
  private readonly modules = new Set<EngineModuleId>();
  private readonly policy: Required<ServiceBusPolicy>;
  private readonly hooks: ServiceBusHooks;

  constructor(modules: readonly EngineModuleId[], policy: ServiceBusPolicy = {}, hooks: ServiceBusHooks = {}) {
    for (const module of modules) this.modules.add(module);
    this.policy = {
      allowExternalBridge: policy.allowExternalBridge ?? false,
      maxPayloadBytes: policy.maxPayloadBytes ?? 256 * 1024,
      allowedRoutes: policy.allowedRoutes ?? [],
    };
    this.hooks = hooks;
  }

  subscribe(module: EngineModuleId, handler: ServiceHandler): () => void {
    this.assertModule(module);
    const handlers = this.handlers.get(module) ?? new Set<ServiceHandler>();
    handlers.add(handler);
    this.handlers.set(module, handlers);
    return () => handlers.delete(handler);
  }

  async publish<T>(message: ServiceMessage<T>): Promise<{ delivered: number }> {
    this.assertModule(message.source);
    this.assertModule(message.destination);
    this.assertTopic(message);
    if (message.external && !this.policy.allowExternalBridge) {
      await this.audit(message, false, 'external bridge disabled');
      throw new Error('External service-bus bridge is disabled');
    }
    const payloadBytes = new TextEncoder().encode(JSON.stringify(message.payload ?? null)).byteLength;
    if (payloadBytes > this.policy.maxPayloadBytes) {
      await this.audit(message, false, 'payload exceeds limit');
      throw new Error('Service-bus payload exceeds configured limit');
    }
    if (this.hooks.fortress && !(await this.hooks.fortress(message))) {
      await this.audit(message, false, 'FORTRESS denied message');
      throw new Error('FORTRESS denied service-bus message');
    }
    const handlers = this.handlers.get(message.destination) ?? new Set<ServiceHandler>();
    for (const handler of handlers) await handler(message);
    await this.audit(message, true);
    return { delivered: handlers.size };
  }

  private assertModule(module: EngineModuleId): void {
    if (!this.modules.has(module)) throw new Error(`Unknown engine module: ${module}`);
  }

  private assertTopic(message: ServiceMessage): void {
    if (!message.topic || message.topic.includes('*')) throw new Error('Invalid service-bus topic');
    const route = `${message.source}:${message.destination}:${message.topic}`;
    if (this.policy.allowedRoutes.length > 0 && !this.policy.allowedRoutes.includes(route)) {
      throw new Error(`Service-bus route not allowed: ${route}`);
    }
  }

  private async audit(message: ServiceMessage, delivered: boolean, reason?: string): Promise<void> {
    await this.hooks.audit?.(message, delivered, reason);
  }
}
