/**
 * IZAKHONO Native Builder Core
 * Provider-independent project registry and controlled build-job lifecycle.
 *
 * This module is an application-layer foundation. Persistence, authentication,
 * worker isolation and deployment adapters are injected by the host runtime.
 */

export type ProjectStatus =
  | "discovered" | "imported" | "editable" | "validated"
  | "release_candidate" | "deployed_owned" | "verified_owned" | "retired";

export type JobStatus =
  | "queued" | "planning" | "awaiting_approval" | "running"
  | "testing" | "packaging" | "deploying" | "verifying"
  | "succeeded" | "failed" | "cancelled";

export type RiskClass = "routine" | "sensitive" | "destructive" | "financial" | "external";

export interface BuilderProject {
  id: string;
  name: string;
  description: string;
  repository?: string;
  sourceOfTruth: "izakhono_internal" | "git_mirror" | "external_pending_import";
  status: ProjectStatus;
  dependencies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BuildRequest {
  projectId: string;
  instruction: string;
  requestedBy: string;
  risk: RiskClass;
  productionRelease?: boolean;
}

export interface BuildJob {
  id: string;
  projectId: string;
  instruction: string;
  requestedBy: string;
  status: JobStatus;
  requiresApproval: boolean;
  approvedBy?: string;
  events: Array<{ at: string; status: JobStatus; detail: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface BuilderStore {
  getProject(id: string): Promise<BuilderProject | null>;
  saveProject(project: BuilderProject): Promise<void>;
  getJob(id: string): Promise<BuildJob | null>;
  saveJob(job: BuildJob): Promise<void>;
}

export interface BuilderClock {
  now(): string;
  id(): string;
}

export class BuilderError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "BuilderError";
  }
}

const APPROVAL_RISKS = new Set<RiskClass>([
  "sensitive", "destructive", "financial", "external",
]);

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["planning", "cancelled"],
  planning: ["awaiting_approval", "running", "failed", "cancelled"],
  awaiting_approval: ["running", "cancelled"],
  running: ["testing", "failed", "cancelled"],
  testing: ["packaging", "failed", "cancelled"],
  packaging: ["deploying", "succeeded", "failed", "cancelled"],
  deploying: ["verifying", "failed", "cancelled"],
  verifying: ["succeeded", "failed"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export class NativeBuilderCore {
  constructor(
    private readonly store: BuilderStore,
    private readonly clock: BuilderClock,
  ) {}

  async registerProject(input: Omit<BuilderProject, "createdAt" | "updatedAt">): Promise<BuilderProject> {
    if (!input.id.trim() || !input.name.trim()) {
      throw new BuilderError("Project id and name are required.", "INVALID_PROJECT");
    }
    const existing = await this.store.getProject(input.id);
    if (existing) throw new BuilderError("Project already exists.", "PROJECT_EXISTS");
    const now = this.clock.now();
    const project: BuilderProject = { ...input, createdAt: now, updatedAt: now };
    await this.store.saveProject(project);
    return project;
  }

  async requestBuild(input: BuildRequest): Promise<BuildJob> {
    const project = await this.store.getProject(input.projectId);
    if (!project) throw new BuilderError("Project not found.", "PROJECT_NOT_FOUND");
    if (project.status === "retired") {
      throw new BuilderError("Retired projects cannot be changed.", "PROJECT_RETIRED");
    }
    if (!input.instruction.trim() || !input.requestedBy.trim()) {
      throw new BuilderError("Instruction and requester are required.", "INVALID_REQUEST");
    }

    const now = this.clock.now();
    const job: BuildJob = {
      id: this.clock.id(),
      projectId: input.projectId,
      instruction: input.instruction.trim(),
      requestedBy: input.requestedBy,
      status: "queued",
      requiresApproval: Boolean(input.productionRelease) || APPROVAL_RISKS.has(input.risk),
      events: [{ at: now, status: "queued", detail: "Build request accepted into the controlled queue." }],
      createdAt: now,
      updatedAt: now,
    };
    await this.store.saveJob(job);
    return job;
  }

  async approveJob(jobId: string, approver: string): Promise<BuildJob> {
    const job = await this.requireJob(jobId);
    if (job.status !== "awaiting_approval" || !job.requiresApproval) {
      throw new BuilderError("This job is not awaiting approval.", "NOT_AWAITING_APPROVAL");
    }
    if (!approver.trim() || approver === job.requestedBy) {
      throw new BuilderError("A distinct authorised approver is required.", "APPROVAL_SEPARATION_REQUIRED");
    }
    return this.transition(job, "running", `Approved by ${approver}.`, approver);
  }

  async advance(jobId: string, next: JobStatus, detail: string): Promise<BuildJob> {
    const job = await this.requireJob(jobId);
    if (job.requiresApproval && !job.approvedBy && next !== "planning" && next !== "awaiting_approval" && next !== "cancelled") {
      if (job.status === "queued" || job.status === "planning") {
        throw new BuilderError("Approval is required before execution.", "APPROVAL_REQUIRED");
      }
    }
    if (job.status === "queued" && next !== "planning" && next !== "cancelled") {
      throw new BuilderError("A queued job must enter planning first.", "INVALID_TRANSITION");
    }
    return this.transition(job, next, detail);
  }

  async cancel(jobId: string, actor: string): Promise<BuildJob> {
    if (!actor.trim()) throw new BuilderError("Actor is required.", "INVALID_ACTOR");
    const job = await this.requireJob(jobId);
    return this.transition(job, "cancelled", `Cancelled by ${actor}.`);
  }

  private async requireJob(id: string): Promise<BuildJob> {
    const job = await this.store.getJob(id);
    if (!job) throw new BuilderError("Build job not found.", "JOB_NOT_FOUND");
    return job;
  }

  private async transition(
    job: BuildJob,
    next: JobStatus,
    detail: string,
    approvedBy?: string,
  ): Promise<BuildJob> {
    if (!TRANSITIONS[job.status].includes(next)) {
      throw new BuilderError(`Transition ${job.status} -> ${next} is not permitted.`, "INVALID_TRANSITION");
    }
    const now = this.clock.now();
    const updated: BuildJob = {
      ...job,
      status: next,
      ...(approvedBy ? { approvedBy } : {}),
      events: [...job.events, { at: now, status: next, detail }],
      updatedAt: now,
    };
    await this.store.saveJob(updated);
    return updated;
  }
}

/** In-memory adapter for unit tests and local development only. */
export class MemoryBuilderStore implements BuilderStore {
  private projects = new Map<string, BuilderProject>();
  private jobs = new Map<string, BuildJob>();
  async getProject(id: string) { return this.projects.get(id) ?? null; }
  async saveProject(project: BuilderProject) { this.projects.set(project.id, project); }
  async getJob(id: string) { return this.jobs.get(id) ?? null; }
  async saveJob(job: BuildJob) { this.jobs.set(job.id, job); }
}

export const systemBuilderClock: BuilderClock = {
  now: () => new Date().toISOString(),
  id: () => `build_${crypto.randomUUID()}`,
};
