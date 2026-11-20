export type EvidenceScanStatus = "clean" | "infected" | "not_configured" | "error";

export type EvidenceScanResult = {
  status: EvidenceScanStatus;
  engine: string;
  signatureVersion: string | null;
  sha256: string;
  scannedAt: string | null;
  code: string;
};

export interface ClamAVTransport {
  scan(bytes: Uint8Array): Promise<{
    status: "clean" | "infected";
    signatureVersion: string;
  }>;
}

const SHA256 = /^[0-9a-f]{64}$/i;

async function sha256(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export class ClamAVEvidenceScanner {
  private readonly transport: ClamAVTransport | null;

  constructor(transport: ClamAVTransport | null = null) {
    this.transport = transport;
  }

  isConfigured() {
    return this.transport !== null;
  }

  async scan(bytes: Uint8Array, expectedSha256: string): Promise<EvidenceScanResult> {
    const actual = await sha256(bytes);
    if (!SHA256.test(expectedSha256) || actual !== expectedSha256.toLowerCase()) {
      return {
        status: "error",
        engine: "clamav",
        signatureVersion: null,
        sha256: actual,
        scannedAt: null,
        code: "EVIDENCE_HASH_MISMATCH",
      };
    }

    if (!this.transport) {
      return {
        status: "not_configured",
        engine: "clamav",
        signatureVersion: null,
        sha256: actual,
        scannedAt: null,
        code: "SCANNER_NOT_CONFIGURED",
      };
    }

    try {
      const result = await this.transport.scan(bytes);
      if (!result || !["clean", "infected"].includes(result.status) ||
          typeof result.signatureVersion !== "string" ||
          !result.signatureVersion.trim()) {
        throw new Error("invalid_scanner_response");
      }
      return {
        status: result.status,
        engine: "clamav",
        signatureVersion: result.signatureVersion.slice(0, 100),
        sha256: actual,
        scannedAt: new Date().toISOString(),
        code: result.status === "clean" ? "SCAN_CLEAN" : "MALWARE_DETECTED",
      };
    } catch {
      return {
        status: "error",
        engine: "clamav",
        signatureVersion: null,
        sha256: actual,
        scannedAt: null,
        code: "SCANNER_ERROR",
      };
    }
  }
}

export function createDefaultEvidenceScanner() {
  return new ClamAVEvidenceScanner();
}
