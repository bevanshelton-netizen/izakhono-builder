export interface SuperEngineReleaseReceipt {
  schema: 'izakhono.release/v1';
  application: {
    slug: 'izakhono-super-engine';
  };
  runtime: {
    port: number;
    healthPath: '/health';
    network: 'izakhono-edge';
  };
  routes: {
    public_https: `https://${string}`;
  };
  release: {
    source: string;
    artifact_digest: string;
  };
}

export function validateSuperEngineReleaseReceipt(
  receipt: SuperEngineReleaseReceipt,
): void {
  if (receipt.schema !== 'izakhono.release/v1') {
    throw new Error('Unsupported IZAKHONO release receipt schema');
  }
  if (receipt.application.slug !== 'izakhono-super-engine') {
    throw new Error('Release receipt targets the wrong application');
  }
  if (!Number.isInteger(receipt.runtime.port) || receipt.runtime.port <= 0 || receipt.runtime.port > 65535) {
    throw new Error('Release receipt contains an invalid runtime port');
  }
  if (receipt.runtime.healthPath !== '/health') {
    throw new Error('Super Engine health path must be /health');
  }
  if (receipt.runtime.network !== 'izakhono-edge') {
    throw new Error('Super Engine must run on the owned IZAKHONO edge network');
  }
  if (!receipt.routes.public_https.startsWith('https://')) {
    throw new Error('Production route must use HTTPS');
  }
  if (!receipt.release.source.trim()) {
    throw new Error('Release source is required');
  }
  if (!receipt.release.artifact_digest.trim()) {
    throw new Error('Immutable artifact digest is required');
  }
}

export function createSuperEngineReleaseReceipt(input: {
  source: string;
  artifactDigest: string;
  publicHttpsRoute: `https://${string}`;
  port?: number;
}): SuperEngineReleaseReceipt {
  const receipt: SuperEngineReleaseReceipt = {
    schema: 'izakhono.release/v1',
    application: { slug: 'izakhono-super-engine' },
    runtime: {
      port: input.port ?? 8787,
      healthPath: '/health',
      network: 'izakhono-edge',
    },
    routes: { public_https: input.publicHttpsRoute },
    release: {
      source: input.source,
      artifact_digest: input.artifactDigest,
    },
  };

  validateSuperEngineReleaseReceipt(receipt);
  return receipt;
}
