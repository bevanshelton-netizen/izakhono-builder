/**
 * IZAKHONO MAIL TEMPLATE REGISTRY — versioned, tenant-aware template control plane.
 * Templates remain data owned by IZAKHONO; rendering is a replaceable boundary.
 */

export class TemplateRegistry {
  constructor({ templates = new Map(), clock = () => new Date().toISOString() } = {}) {
    this.templates = templates;
    this.clock = clock;
  }

  register(template, { tenantId = "system", actor = "system" } = {}) {
    validateTemplate(template);
    const key = templateKey(tenantId, template.id);
    const existing = this.templates.get(key);
    const version = existing ? existing.version + 1 : 1;
    const record = {
      ...template,
      tenantId,
      version,
      status: template.status || "active",
      updatedAt: this.clock(),
      updatedBy: actor,
    };
    this.templates.set(key, record);
    return structuredClone(record);
  }

  get(id, { tenantId = "system", version } = {}) {
    const record = this.templates.get(templateKey(tenantId, id));
    if (!record) return null;
    if (version && record.version !== version) return null;
    return structuredClone(record);
  }

  list({ tenantId = "system", status } = {}) {
    return [...this.templates.values()]
      .filter((template) => template.tenantId === tenantId && (!status || template.status === status))
      .map((template) => structuredClone(template));
  }

  activate(id, options = {}) { return this.#setStatus(id, "active", options); }
  archive(id, options = {}) { return this.#setStatus(id, "archived", options); }

  #setStatus(id, status, { tenantId = "system", actor = "system" } = {}) {
    const key = templateKey(tenantId, id);
    const record = this.templates.get(key);
    if (!record) return null;
    record.status = status;
    record.updatedAt = this.clock();
    record.updatedBy = actor;
    return structuredClone(record);
  }
}

function templateKey(tenantId, id) { return `${tenantId}:${id}`; }

function validateTemplate(template) {
  if (!template || typeof template !== "object" || Array.isArray(template)) throw new Error("template must be an object");
  if (!template.id || typeof template.id !== "string") throw new Error("template.id is required");
  if (!template.name || typeof template.name !== "string") throw new Error("template.name is required");
  if (!template.schemaVersion || typeof template.schemaVersion !== "string") throw new Error("template.schemaVersion is required");
  if (!template.source || typeof template.source !== "object") throw new Error("template.source is required");
}
