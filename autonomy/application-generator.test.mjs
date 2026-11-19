import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCanonicalSnapshot, availableApplicationTemplates, scaffoldApplication } from './application-generator.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'izakhono-generator-'));
try {
  const workspace = path.join(temp, 'workspace');
  const first = scaffoldApplication({
    workspaceRoot: workspace, projectId: 'school-portal', name: 'School Portal',
    goal: 'A secure portal for school uniform ordering', templateId: 'static-web',
  });
  assert.equal(first.fileCount, 10);
  assert.equal(first.templateVersion, '1.0.0');
  assert.equal(scaffoldApplication({ workspaceRoot: workspace, projectId: 'school-portal', name: 'School Portal', goal: 'A secure portal for school uniform ordering', templateId: 'static-web' }).reused, true);
  assert.ok(fs.existsSync(path.join(workspace, 'src/server.mjs')));
  assert.ok(fs.existsSync(path.join(workspace, 'src/content.mjs')));
  assert.ok(fs.existsSync(path.join(workspace, 'public/index.html')));
  assert.ok(fs.existsSync(path.join(workspace, 'tests/application.test.mjs')));
  assert.match(fs.readFileSync(path.join(workspace, 'public/index.html'), 'utf8'), /School Portal/);
  assert.equal(availableApplicationTemplates().length, 2);
  assert.equal(availableApplicationTemplates()[0].version, '1.0.0');
  assert.equal(JSON.parse(fs.readFileSync(path.join(workspace, 'izakhono.application.json'), 'utf8')).templateVersion, '1.0.0');

  const snapshotA = createCanonicalSnapshot({ workspaceRoot: workspace, repositoryRoot: path.join(temp, 'repository') });
  const snapshotB = createCanonicalSnapshot({ workspaceRoot: workspace, repositoryRoot: path.join(temp, 'repository') });
  assert.equal(snapshotA.snapshotHash, snapshotB.snapshotHash, 'identical workspaces must produce identical snapshots');
  assert.equal(snapshotA.fileCount, 10);
  const objectRoot = path.join(temp, 'repository', 'objects');
  assert.ok(fs.readdirSync(objectRoot).length > 0);

  fs.appendFileSync(path.join(workspace, 'README.md'), '\nChanged.\n');
  const snapshotC = createCanonicalSnapshot({ workspaceRoot: workspace, repositoryRoot: path.join(temp, 'repository') });
  assert.notEqual(snapshotA.snapshotHash, snapshotC.snapshotHash, 'content changes must produce a new canonical hash');

  assert.throws(() => scaffoldApplication({
    workspaceRoot: path.join(temp, 'bad'), projectId: '../escape', name: 'Bad', goal: 'Invalid path',
  }), /project-id-invalid/);
  assert.throws(() => scaffoldApplication({
    workspaceRoot: path.join(temp, 'unknown'), projectId: 'unknown-template', name: 'Bad', goal: 'Invalid template', templateId: 'remote-code',
  }), /template-unsupported/);

  const apiWorkspace = path.join(temp, 'api');
  const api = scaffoldApplication({
    workspaceRoot: apiWorkspace, projectId: 'catalog-api', name: 'Catalog API',
    goal: 'A read-only catalogue API', templateId: 'node-api',
  });
  assert.equal(api.templateId, 'node-api');
  assert.ok(fs.existsSync(path.join(apiWorkspace, 'src/server.mjs')));
  assert.ok(fs.existsSync(path.join(apiWorkspace, 'tests/health.test.mjs')));
  const tamperedWorkspace = path.join(temp, 'tampered');
  scaffoldApplication({
    workspaceRoot: tamperedWorkspace, projectId: 'tampered-app', name: 'Tampered App',
    goal: 'A workspace tamper-resistance test', templateId: 'static-web',
  });
  fs.appendFileSync(path.join(tamperedWorkspace, 'README.md'), '\\nunauthorized edit\\n');
  assert.throws(() => scaffoldApplication({
    workspaceRoot: tamperedWorkspace, projectId: 'tampered-app', name: 'Tampered App',
    goal: 'A workspace tamper-resistance test', templateId: 'static-web',
  }), /workspace-modified/);

  if (process.platform !== 'win32') {
    const symlinkWorkspace = path.join(temp, 'symlinked');
    const outsideFile = path.join(temp, 'outside-content.mjs');
    scaffoldApplication({
      workspaceRoot: symlinkWorkspace, projectId: 'symlink-app', name: 'Symlink App',
      goal: 'A symlink rejection test', templateId: 'static-web',
    });
    fs.writeFileSync(outsideFile, 'export const compromised = true;\\n');
    fs.unlinkSync(path.join(symlinkWorkspace, 'src/content.mjs'));
    fs.symlinkSync(outsideFile, path.join(symlinkWorkspace, 'src/content.mjs'));
    assert.throws(() => scaffoldApplication({
      workspaceRoot: symlinkWorkspace, projectId: 'symlink-app', name: 'Symlink App',
      goal: 'A symlink rejection test', templateId: 'static-web',
    }), /symlink-not-allowed/);
  }

  console.log('[PASS] deterministic multi-file templates, path safety and content-addressed snapshots');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
