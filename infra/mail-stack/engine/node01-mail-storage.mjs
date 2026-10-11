/** IZAKHONO MAIL — NODE01 durable append-only mailbox store. */
import fs from "node:fs/promises";
import path from "node:path";

export class Node01MailStorage {
  constructor({ root = "/var/lib/izakhono-mail" } = {}) { this.root = root; }
  async init() { await fs.mkdir(this.root, { recursive: true }); }

  #safe(address) { return String(address).trim().toLowerCase().replace(/[^a-z0-9._@+-]/g, "_"); }
  #file(address, folder) { return path.join(this.root, `${this.#safe(address)}.${folder}.jsonl`); }

  async append(address, folder, message) {
    await this.init();
    await fs.appendFile(this.#file(address, folder), `${JSON.stringify(message)}\n`, "utf8");
    return { address: String(address).toLowerCase(), folder, messageId: message.id };
  }

  async list(address, folder = "inbox") {
    await this.init();
    try {
      const raw = await fs.readFile(this.#file(address, folder), "utf8");
      return raw.split("\n").filter(Boolean).map(line => JSON.parse(line));
    } catch (error) {
      if (error.code === "ENOENT") return [];
      throw error;
    }
  }

  async stats(address, folders = ["inbox", "sent", "archive", "trash", "quarantine"]) {
    const entries = await Promise.all(folders.map(async folder => [folder, (await this.list(address, folder)).length]));
    return Object.fromEntries(entries);
  }
}
