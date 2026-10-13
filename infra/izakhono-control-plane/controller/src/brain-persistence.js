import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export class BrainPersistence {
  constructor(path = process.env.IZAKHONO_BRAIN_STATE || "/var/lib/izakhono-control-plane/brain-state.json") {
    this.path = path;
  }

  load() {
    try {
      const state = JSON.parse(readFileSync(this.path, "utf8"));
      return { audit: Array.isArray(state.audit) ? state.audit : [] };
    } catch (error) {
      if (error?.code === "ENOENT") return { audit: [] };
      throw new Error(`BRAIN_STATE_LOAD_FAILED: ${error.message}`);
    }
  }

  save(audit) {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      const temp = `${this.path}.tmp`;
      writeFileSync(temp, JSON.stringify({ version: 1, audit }, null, 2), "utf8");
      renameSync(temp, this.path);
    } catch (error) {
      throw new Error(`BRAIN_STATE_SAVE_FAILED: ${error.message}`);
    }
  }
}
