import { randomUUID } from 'node:crypto';

const engines = new Map();

export class Engine {
  constructor(name, capabilities = []) {
    this.name = name;
    this.capabilityList = capabilities;
  }
  health() { return { name: this.name, status: 'READY' }; }
  capabilities() { return this.capabilityList; }
  plan(command) { return { planId: randomUUID(), engine: this.name, command, status: 'PLANNED' }; }
  execute(command) { return { executionId: randomUUID(), engine: this.name, command, status: 'EXECUTED' }; }
  verify(result) { return { ...result, verified: true, verifiedAt: new Date().toISOString() }; }
  rollback(change) { return { rollbackId: randomUUID(), engine: this.name, change, status: 'ROLLBACK_REQUESTED' }; }
}

export function registerEngine(engine) {
  if (!(engine instanceof Engine)) throw new TypeError('engine must extend Engine');
  engines.set(engine.name, engine);
  return engine;
}

export function getEngine(name) { return engines.get(name); }
export function listEngines() { return [...engines.values()].map((e) => ({ name: e.name, capabilities: e.capabilities() })); }

registerEngine(new Engine('storage', ['bucket.create', 'object.put', 'object.get', 'lifecycle', 'replication.plan']));
registerEngine(new Engine('image', ['registry.push', 'registry.pull', 'digest.lock', 'promotion.gate']));
registerEngine(new Engine('build', ['source.build', 'image.publish', 'artifact.store', 'reproducibility.record']));
registerEngine(new Engine('observability', ['health.check', 'metrics.ingest', 'logs.ingest', 'events.record', 'evidence.record']));
registerEngine(new Engine('media', ['ingest', 'transcode', 'package', 'origin', 'stream']));
registerEngine(new Engine('queue', ['command.enqueue', 'command.claim', 'command.ack', 'command.retry']));
registerEngine(new Engine('backup', ['policy.create', 'snapshot.create', 'restore.start', 'restore.verify']));
registerEngine(new Engine('secrets', ['reference.create', 'rotation.plan', 'provider.bind']));
