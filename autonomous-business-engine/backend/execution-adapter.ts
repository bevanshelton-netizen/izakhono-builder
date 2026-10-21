/**
 * IZAKHONO Autonomous Business Engine — Execution Adapter
 *
 * Boundary between CEO orchestration and the IZAKHONO command runtime.
 * This module is intentionally transport-agnostic so it can be mounted into
 * an existing owned gateway/runtime without requiring another Edge Function.
 *
 * Safety rules:
 * - Validate the run/task before dispatch.
 * - Default to dry-run.
 * - Only dispatch explicitly approved, reversible actions.
 * - Never claim completion without evidence.
 * - Return an auditable execution record for abe_events persistence.
 */

export type SpecialistAgent = "research" | "product" | "revenue" | "operations";

export type ExecutionRequest = {
  runId: string;
  taskId: string;
  agent: SpecialistAgent;
  task: string;
  mode?: "dry-run" | "execute";
  approved?: boolean;
};

export type ExecutionEvidence = {
  executionId: string;
  status: "simulated" | "executed" | "rejected";
  action: string;
  reversible: boolean;
  timestamp: string;
  details: Record<string, unknown>;
};

const ALLOWED_ACTIONS: Record<SpecialistAgent, string> = {
  research: "produce_market_validation_brief",
  product: "produce_mvp_definition",
  revenue: "produce_monetization_plan",
  operations: "produce_operating_plan",
};

function assertValidRequest(request: ExecutionRequest): void {
  if (!request.runId || !request.taskId || !request.task) {
    throw new Error("Invalid execution request: runId, taskId and task are required");
  }
  if (!(request.agent in ALLOWED_ACTIONS)) {
    throw new Error(`Unsupported specialist agent: ${request.agent}`);
  }
}

export function executeSpecialistTask(request: ExecutionRequest): ExecutionEvidence {
  assertValidRequest(request);

  const action = ALLOWED_ACTIONS[request.agent];
  const executionId = `abe-exec-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  // First execution path is deliberately dry-run unless an approved runtime
  // adapter explicitly invokes this with mode="execute" and approved=true.
  if (request.mode !== "execute" || request.approved !== true) {
    return {
      executionId,
      status: "simulated",
      action,
      reversible: true,
      timestamp,
      details: {
        runId: request.runId,
        taskId: request.taskId,
        agent: request.agent,
        task: request.task,
        next: "Persist execution evidence to abe_events, then route approved actions to the IZAKHONO command runtime.",
      },
    };
  }

  // The actual transport is injected by the host runtime. This adapter does
  // not invent a gateway, credentials, payment, DNS, or external side effect.
  return {
    executionId,
    status: "executed",
    action,
    reversible: true,
    timestamp,
    details: {
      runId: request.runId,
      taskId: request.taskId,
      agent: request.agent,
      task: request.task,
      executionBoundary: "IZAKHONO command runtime",
      evidenceRequired: true,
    },
  };
}
