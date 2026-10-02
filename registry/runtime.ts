import { WORKER_INDEX, WorkerSpec } from "./workers";
import { ENGINE_INDEX, EngineSpec } from "./engines";

export type JobStatus = "queued"|"running"|"succeeded"|"failed"|"blocked";
export type Job = { id:string; workerId:string; input:unknown; status:JobStatus; attempts:number; createdAt:string; updatedAt:string; };
export type EngineContext = { requestId:string; actorId?:string; dryRun?:boolean; metadata?:Record<string,string>; };
export type EngineHandler = (input:unknown, ctx:EngineContext)=>Promise<unknown>|unknown;
export type WorkerHandler = (job:Job, ctx:EngineContext)=>Promise<unknown>|unknown;

export class ParallelInternetRuntime {
  private readonly engines = new Map<string,EngineHandler>();
  private readonly workers = new Map<string,WorkerHandler>();

  registerEngine(spec:EngineSpec, handler:EngineHandler) {
    if (!ENGINE_INDEX[spec.id]) throw new Error(`Unknown engine: ${spec.id}`);
    if (this.engines.has(spec.id)) throw new Error(`Engine already registered: ${spec.id}`);
    this.engines.set(spec.id,handler);
    return this;
  }

  registerWorker(spec:WorkerSpec, handler:WorkerHandler) {
    if (!WORKER_INDEX[spec.id]) throw new Error(`Unknown worker: ${spec.id}`);
    if (this.workers.has(spec.id)) throw new Error(`Worker already registered: ${spec.id}`);
    this.workers.set(spec.id,handler);
    return this;
  }

  async run(job:Job, ctx:EngineContext) {
    const spec=WORKER_INDEX[job.workerId];
    if (!spec) throw new Error(`Unknown worker: ${job.workerId}`);
    if (spec.risk==="high" && !ctx.dryRun && !spec.humanGate) throw new Error(`High-risk worker missing gate: ${spec.id}`);
    const handler=this.workers.get(spec.id);
    if (!handler) return {status:"blocked" as const, reason:"worker-handler-not-installed", workerId:spec.id};
    const output=await handler(job,ctx);
    return {status:"succeeded" as const, workerId:spec.id, output};
  }

  engine(id:string) {
    const spec=ENGINE_INDEX[id];
    if (!spec) throw new Error(`Unknown engine: ${id}`);
    const handler=this.engines.get(id);
    if (!handler) throw new Error(`Engine handler not installed: ${id}`);
    return {spec,handler};
  }
}

export function createRuntime() { return new ParallelInternetRuntime(); }
