const BUILT_INS = [
  { id: 'code', name: 'IZAKHONO CODE', kind: 'system', route: '/code', capabilities: ['workspace.read', 'workspace.write', 'files.read', 'files.write'] },
  { id: 'super-ai', name: 'IZAKHONO SUPER AI', kind: 'ai', route: '/ai', capabilities: ['workspace.read', 'job.submit', 'job.read'] },
  { id: 'run', name: 'IZAKHONO RUN', kind: 'runtime', route: '/run', capabilities: ['job.submit', 'job.read'] },
  { id: 'deploy', name: 'IZAKHONO DEPLOY', kind: 'deployment', route: '/deploy', capabilities: ['job.submit', 'job.read'] },
  { id: 'provisioner', name: 'IZAKHONO PROVISIONER', kind: 'infrastructure', route: '/provisioner', capabilities: ['job.submit', 'job.read'] }
];

export function createApplicationRegistry() {
  return {
    list() { return BUILT_INS.map((app) => ({ ...app, capabilities: [...app.capabilities] })); },
    get(id) { return BUILT_INS.find((app) => app.id === id) || null; },
    canLaunch(id, capabilities = []) {
      const app = this.get(id);
      if (!app) return false;
      return app.capabilities.every((required) => capabilities.includes(required));
    }
  };
}
