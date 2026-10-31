import { describe, expect, it } from 'vitest';
import {
  createSuperEngineReleaseReceipt,
  validateSuperEngineReleaseReceipt,
} from './release-contract.js';

describe('Super Engine release contract', () => {
  it('creates a valid owned-runtime receipt', () => {
    const receipt = createSuperEngineReleaseReceipt({
      source: 'fc950c7dd058763e9e7e970db821241e1248ce96',
      artifactDigest: 'sha256:example',
      publicHttpsRoute: 'https://super-engine.example.invalid',
    });

    expect(receipt.schema).toBe('izakhono.release/v1');
    expect(receipt.application.slug).toBe('izakhono-super-engine');
    expect(receipt.runtime.port).toBe(8787);
    expect(receipt.runtime.network).toBe('izakhono-edge');
  });

  it('rejects a non-HTTPS route', () => {
    const receipt = createSuperEngineReleaseReceipt({
      source: 'source',
      artifactDigest: 'sha256:example',
      publicHttpsRoute: 'https://super-engine.example.invalid',
    });

    expect(() => validateSuperEngineReleaseReceipt({
      ...receipt,
      routes: { public_https: 'http://super-engine.example.invalid' as `https://${string}` },
    })).toThrow('Production route must use HTTPS');
  });

  it('rejects a missing immutable digest', () => {
    const receipt = createSuperEngineReleaseReceipt({
      source: 'source',
      artifactDigest: 'sha256:example',
      publicHttpsRoute: 'https://super-engine.example.invalid',
    });

    expect(() => validateSuperEngineReleaseReceipt({
      ...receipt,
      release: { ...receipt.release, artifact_digest: '' },
    })).toThrow('Immutable artifact digest is required');
  });
});
