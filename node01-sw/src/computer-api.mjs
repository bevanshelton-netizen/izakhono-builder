import { createVirtualFilesystem } from './virtual-filesystem.mjs';
import { createApplicationRegistry } from './application-registry.mjs';

export function createComputerApi({ workspaceRoot, state, persist }) {
  const apps = createApplicationRegistry();
  const fsFor = (ws) => createVirtualFilesystem(`${workspaceRoot}/${ws.id}`);
  const getWorkspace = (id) => state.workspaces.find((w) => w.id === id);

  return {
    apps,
    getWorkspace,
    async initWorkspace(ws) { await fsFor(ws).init(); },
    async listFiles(ws, path = '/') { const fs = fsFor(ws); await fs.init(); return fs.list(path); },
    async readFile(ws, path) { const fs = fsFor(ws); await fs.init(); return fs.read(path); },
    async writeFile(ws, path, content) { const fs = fsFor(ws); await fs.init(); await fs.write(path, content); },
    async createWorkspace(ws) { state.workspaces.push(ws); await this.initWorkspace(ws); await persist(); return ws; }
  };
}
