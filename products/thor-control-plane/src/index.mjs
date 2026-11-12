/**
 * THOR orchestration core — provider-neutral task scheduler.
 *
 * Persistence is injected through ThorStore. Production adapters MUST implement
 * claimNext atomically (e.g. one SQL transaction / conditional UPDATE) so two
 * workers cannot claim the same task. MemoryThorStore is for tests only.
 */

export const TASK_STATES = Object.freeze(["queued", "running", "succeeded", "failed", "cancelled"]);

export class ThorError extends Error {
  constructor(message, code) { super(message); this.name = "ThorError"; this.code = code; }
}

const iso = (ms) => new Date(ms).toISOString();

export class MemoryThorStore {
  constructor(clock = () => Date.now()) {
    this.clock = clock;
    this.tasks = new Map();
    this.events = [];
  }

  async createTask(task) {
    if (this.tasks.has(task.id)) throw new ThorError("Task already exists", "TASK_EXISTS");
    this.tasks.set(task.id, structuredClone(task));
    this.events.push({ taskId: task.id, type: "created", at: iso(this.clock()) });
    return structuredClone(task);
  }

  async getTask(id) {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async listTasks() { return [...this.tasks.values()].map(structuredClone); }

  // This method is atomic in this in-memory adapter because no await occurs
  // between candidate selection and mutation. Durable adapters must guarantee
  // the same property in their database.
  async claimNext(workerId, leaseMs) {
    const now = this.clock();
    const tasks = [...this.tasks.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const task of tasks) {
      if (task.state !== "queued" && !(task.state === "running" && Date.parse(task.leaseUntil) <= now)) continue;
      const dependencies = task.dependsOn.map(id => this.tasks.get(id));
      if (dependencies.some(dep => !dep || dep.state !== "succeeded")) continue;
      task.state = "running";
      task.workerId = workerId;
      task.attempts += 1;
      task.leaseUntil = iso(now + leaseMs);
      task.updatedAt = iso(now);
      this.events.push({ taskId: task.id, type: "claimed", workerId, attempt: task.attempts, at: iso(now) });
      return structuredClone(task);
    }
    return null;
  }

  async heartbeat(taskId, workerId, leaseMs) {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== "running" || task.workerId !== workerId) return false;
    task.leaseUntil = iso(this.clock() + leaseMs);
    task.updatedAt = iso(this.clock());
    this.events.push({ taskId, type: "heartbeat", workerId, at: task.updatedAt });
    return true;
  }

  async finish(taskId, workerId, result) {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== "running" || task.workerId !== workerId) {
      throw new ThorError("Worker does not own this running task", "LEASE_NOT_OWNED");
    }
    task.state = "succeeded";
    task.result = result;
    task.workerId = null;
    task.leaseUntil = null;
    task.updatedAt = iso(this.clock());
    this.events.push({ taskId, type: "succeeded", workerId, at: task.updatedAt });
    return structuredClone(task);
  }

  async fail(taskId, workerId, error) {
    const task = this.tasks.get(taskId);
    if (!task || task.state !== "running" || task.workerId !== workerId) {
      throw new ThorError("Worker does not own this running task", "LEASE_NOT_OWNED");
    }
    const retry = task.attempts < task.maxAttempts;
    task.state = retry ? "queued" : "failed";
    task.lastError = String(error?.message ?? error).slice(0, 2000);
    task.workerId = null;
    task.leaseUntil = null;
    task.updatedAt = iso(this.clock());
    this.events.push({ taskId, type: retry ? "retry_queued" : "failed", workerId, error: task.lastError, at: task.updatedAt });
    return structuredClone(task);
  }

  async cancel(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) throw new ThorError("Task not found", "TASK_NOT_FOUND");
    if (task.state === "running" || task.state === "succeeded") {
      throw new ThorError("Running or completed tasks cannot be cancelled by this operation", "INVALID_CANCEL");
    }
    task.state = "cancelled";
    task.updatedAt = iso(this.clock());
    this.events.push({ taskId, type: "cancelled", at: task.updatedAt });
    return structuredClone(task);
  }
}

export class ThorOrchestrator {
  constructor({ store, clock = () => Date.now(), leaseMs = 60_000 }) {
    if (!store) throw new ThorError("A task store is required", "STORE_REQUIRED");
    if (!Number.isInteger(leaseMs) || leaseMs < 1_000) throw new ThorError("leaseMs must be at least 1000", "INVALID_LEASE");
    this.store = store;
    this.clock = clock;
    this.leaseMs = leaseMs;
  }

  async submit({ id, projectId, title, instruction, dependsOn = [], maxAttempts = 3, priority = 100 }) {
    if (!id?.trim() || !projectId?.trim() || !title?.trim() || !instruction?.trim()) {
      throw new ThorError("id, projectId, title and instruction are required", "INVALID_TASK");
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) {
      throw new ThorError("maxAttempts must be between 1 and 10", "INVALID_ATTEMPTS");
    }
    if (!Array.isArray(dependsOn) || dependsOn.includes(id) || new Set(dependsOn).size !== dependsOn.length) {
      throw new ThorError("Dependencies must be unique and cannot include the task itself", "INVALID_DEPENDENCIES");
    }
    const existing = await this.store.getTask(id);
    if (existing) throw new ThorError("Task already exists", "TASK_EXISTS");
    for (const dependencyId of dependsOn) {
      if (!await this.store.getTask(dependencyId)) throw new ThorError(`Dependency not found: ${dependencyId}`, "DEPENDENCY_NOT_FOUND");
    }
    const now = iso(this.clock());
    return this.store.createTask({
      id, projectId, title, instruction, dependsOn, priority,
      state: "queued", attempts: 0, maxAttempts,
      workerId: null, leaseUntil: null, result: null, lastError: null,
      createdAt: now, updatedAt: now,
    });
  }

  async runOne(workerId, executor) {
    if (!workerId?.trim() || typeof executor !== "function") {
      throw new ThorError("workerId and executor are required", "INVALID_WORKER");
    }
    const task = await this.store.claimNext(workerId, this.leaseMs);
    if (!task) return { claimed: false };
    try {
      const result = await executor(structuredClone(task), {
        heartbeat: () => this.store.heartbeat(task.id, workerId, this.leaseMs),
      });
      const completed = await this.store.finish(task.id, workerId, result ?? null);
      return { claimed: true, task: completed };
    } catch (error) {
      const updated = await this.store.fail(task.id, workerId, error);
      return { claimed: true, task: updated, error: updated.lastError };
    }
  }

  async snapshot() {
    const tasks = await this.store.listTasks();
    const counts = Object.fromEntries(TASK_STATES.map(state => [state, tasks.filter(task => task.state === state).length]));
    return { total: tasks.length, counts, tasks };
  }
}
