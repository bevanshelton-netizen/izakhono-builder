import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function createArtifactStore(root) {
  const base = path.resolve(root);
  fs.mkdirSync(base, { recursive: true, mode: 0o700 });

  function put(bytes) {
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const digest = sha256(data);
    const dir = path.join(base, digest.slice(0, 2));
    const file = path.join(dir, digest);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!fs.existsSync(file)) {
      const tmp = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
      fs.writeFileSync(tmp, data, { mode: 0o600, flag: "wx" });
      fs.renameSync(tmp, file);
    }
    return { digest: `sha256:${digest}`, path: file, bytes: data.length };
  }

  function get(digest) {
    const raw = String(digest).replace(/^sha256:/, "");
    if (!/^[a-f0-9]{64}$/.test(raw)) throw new Error("invalid_digest");
    return fs.readFileSync(path.join(base, raw.slice(0, 2), raw));
  }

  return { put, get };
}
