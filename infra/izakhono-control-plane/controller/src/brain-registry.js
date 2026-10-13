import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(HERE, "../../brain-registry.json");

export function loadBrainRegistry(path = REGISTRY_PATH) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(document.brains)) throw new Error("INVALID_BRAIN_REGISTRY");
  return document;
}
