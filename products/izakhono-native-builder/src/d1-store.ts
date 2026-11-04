import type { BuilderProject, BuildJob, BuilderStore } from "./index.js";

/** Minimal Cloudflare D1-compatible interfaces; no provider SDK is required. */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
}

/**
 * Durable D1 adapter for the native builder domain.
 * The same BuilderStore contract can be implemented by PostgreSQL or IZAKHONO-owned SQL.
 */
export class D1BuilderStore implements BuilderStore {
  constructor(private readonly db: D1Database) {}

  async getProject(id: string): Promise<BuilderProject | null> {
    const row = await this.db.prepare(
      "SELECT payload_json FROM native_builder_projects WHERE id = ?1",
    ).bind(id).first<{ payload_json: string }>();
    return row ? parsePayload<BuilderProject>(row.payload_json, "project") : null;
  }

  async saveProject(project: BuilderProject): Promise<void> {
    await this.db.prepare(`
      INSERT INTO native_builder_projects
        (id, name, status, source_of_truth, updated_at, payload_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        status=excluded.status,
        source_of_truth=excluded.source_of_truth,
        updated_at=excluded.updated_at,
        payload_json=excluded.payload_json
    `).bind(
      project.id, project.name, project.status, project.sourceOfTruth,
      project.updatedAt, JSON.stringify(project),
    ).run();
  }

  async getJob(id: string): Promise<BuildJob | null> {
    const row = await this.db.prepare(
      "SELECT payload_json FROM native_builder_jobs WHERE id = ?1",
    ).bind(id).first<{ payload_json: string }>();
    return row ? parsePayload<BuildJob>(row.payload_json, "job") : null;
  }

  async saveJob(job: BuildJob): Promise<void> {
    await this.db.prepare(`
      INSERT INTO native_builder_jobs
        (id, project_id, status, requires_approval, requested_by, approved_by,
         created_at, updated_at, payload_json)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
      ON CONFLICT(id) DO UPDATE SET
        project_id=excluded.project_id,
        status=excluded.status,
        requires_approval=excluded.requires_approval,
        requested_by=excluded.requested_by,
        approved_by=excluded.approved_by,
        updated_at=excluded.updated_at,
        payload_json=excluded.payload_json
    `).bind(
      job.id, job.projectId, job.status, job.requiresApproval ? 1 : 0,
      job.requestedBy, job.approvedBy ?? null, job.createdAt, job.updatedAt,
      JSON.stringify(job),
    ).run();
  }
}

function parsePayload<T>(value: string, kind: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(`Native Builder stored ${kind} payload is invalid JSON.`);
  }
}
