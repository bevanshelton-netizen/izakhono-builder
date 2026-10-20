import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function assertId(value, label) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(String(value || ""))) throw new Error(`${label}_invalid`);
}

function sha256File(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  fs.writeFileSync(tmp, value, { mode: 0o600 });
  fs.renameSync(tmp, file);
}

function copyTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); }
  }
}

export function createDeploymentExecutor({ root }) {
  const releases = path.join(root, "releases");
  const pointers = path.join(root, "pointers");
  const receipts = path.join(root, "receipts");
  const current = path.join(pointers, "current.json");
  fs.mkdirSync(releases, { recursive: true });
  fs.mkdirSync(pointers, { recursive: true });
  fs.mkdirSync(receipts, { recursive: true });

  function receiptPath(deploymentId) { return path.join(receipts, `${deploymentId}.json`); }

  function readReceipt(deploymentId) {
    assertId(deploymentId, "deployment_id");
    const file = receiptPath(deploymentId);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  }

  function verifyArtifacts(buildReceipt) {
    if (!buildReceipt || buildReceipt.status !== "succeeded") throw new Error("build_receipt_required");
    if (!Array.isArray(buildReceipt.artifacts) || buildReceipt.artifacts.length === 0) throw new Error("artifacts_required");
    for (const artifact of buildReceipt.artifacts) {
      if (!artifact.path || !artifact.digest || !/^[a-f0-9]{64}$/.test(artifact.digest)) throw new Error("artifact_receipt_invalid");
      if (!fs.existsSync(artifact.path)) throw new Error(`artifact_missing:${artifact.path}`);
      const digest = sha256File(artifact.path);
      if (digest !== artifact.digest) throw new Error(`artifact_digest_mismatch:${artifact.path}`);
    }
    return true;
  }

  function promote({ deploymentId, projectId, buildReceipt, verification = {} }) {
    assertId(deploymentId, "deployment_id");
    assertId(projectId, "project_id");
    verifyArtifacts(buildReceipt);
    if (verification.passed !== true) throw new Error("verification_gate_required");
    const releaseId = `${deploymentId}-${Date.now()}`;
    const releaseDir = path.join(releases, releaseId);
    fs.mkdirSync(releaseDir, { recursive: true });
    const manifest = [];
    for (const artifact of buildReceipt.artifacts) {
      const relative = path.basename(artifact.path);
      const destination = path.join(releaseDir, relative);
      copyTree(artifact.path, destination);
      manifest.push({ path: relative, digest: artifact.digest });
    }
    const previous = fs.existsSync(current) ? JSON.parse(fs.readFileSync(current, "utf8")) : null;
    const receipt = {
      schema: "izakhono.host/deployment-receipt/v1",
      deployment_id: deploymentId,
      project_id: projectId,
      release_id: releaseId,
      state: "promoted",
      promoted_at: new Date().toISOString(),
      previous_release_id: previous?.release_id || null,
      verification,
      artifacts: manifest
    };
    atomicWrite(receiptPath(deploymentId), JSON.stringify(receipt, null, 2));
    atomicWrite(current, JSON.stringify({ release_id: releaseId, deployment_id: deploymentId, project_id: projectId }, null, 2));
    return receipt;
  }

  function rollback({ deploymentId, targetDeploymentId }) {
    assertId(deploymentId, "deployment_id");
    assertId(targetDeploymentId, "target_deployment_id");
    const target = readReceipt(targetDeploymentId);
    if (!target || target.state !== "promoted") throw new Error("rollback_target_not_promoted");
    atomicWrite(current, JSON.stringify({ release_id: target.release_id, deployment_id: target.deployment_id, project_id: target.project_id }, null, 2));
    const receipt = { schema: "izakhono.host/rollback-receipt/v1", deployment_id: deploymentId, target_deployment_id: targetDeploymentId, release_id: target.release_id, state: "rolled_back", rolled_back_at: new Date().toISOString() };
    atomicWrite(receiptPath(deploymentId), JSON.stringify(receipt, null, 2));
    return receipt;
  }

  function status() {
    return fs.existsSync(current) ? JSON.parse(fs.readFileSync(current, "utf8")) : null;
  }

  return { promote, rollback, status, readReceipt };
}
