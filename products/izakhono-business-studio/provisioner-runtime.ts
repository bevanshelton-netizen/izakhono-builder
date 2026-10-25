export const CAPABILITIES = ['IDEA','BRAND','WEBSITE','DOMAIN','DNS','SSL','MAIL','PAYMENTS','CRM','MARKETING','PROVISIONING'] as const;
export type Capability = typeof CAPABILITIES[number];
export type JobStatus = 'QUEUED'|'VALIDATED'|'RUNNING'|'BLOCKED'|'FAILED'|'PROVISIONED'|'LIVE_VERIFIED';
export type EvidenceStatus = 'PENDING'|'PASSED'|'FAILED';

export interface Blueprint { schemaVersion:'1.0'; business:{name:string;description:string}; score:number; workflow:Capability[]; outputs:string[]; status:'BLUEPRINT_GENERATED'|'PROVISIONING_PENDING'|'PROVISIONED'|'LIVE_VERIFIED'; }
export interface Evidence { capability:Capability; status:EvidenceStatus; reference?:string; checkedAt?:string; }
export interface ProvisionerJob { schemaVersion:'1.0'; jobId:string; blueprint:string; requestedCapabilities:Capability[]; status:JobStatus; evidence:Evidence[]; createdAt:string; updatedAt:string; }

export function validateBlueprint(value:unknown):asserts value is Blueprint {
  if (!value || typeof value !== 'object') throw new Error('blueprint must be an object');
  const b=value as Record<string,unknown>; const business=b.business as Record<string,unknown>|undefined;
  if (b.schemaVersion!=='1.0') throw new Error('unsupported blueprint schemaVersion');
  if (!business || typeof business.name!=='string' || !business.name.length || typeof business.description!=='string' || !business.description.length) throw new Error('invalid business');
  if (!Number.isInteger(b.score) || Number(b.score)<0 || Number(b.score)>100) throw new Error('score must be an integer from 0 to 100');
  if (!Array.isArray(b.workflow) || !b.workflow.length || b.workflow.some(c=>!isCapability(c)) || new Set(b.workflow).size!==b.workflow.length) throw new Error('invalid workflow capabilities');
  if (!Array.isArray(b.outputs) || b.outputs.some(o=>typeof o!=='string' || !o.length)) throw new Error('invalid outputs');
  if (!['BLUEPRINT_GENERATED','PROVISIONING_PENDING','PROVISIONED','LIVE_VERIFIED'].includes(String(b.status))) throw new Error('invalid blueprint status');
}

export function validateRequestedCapabilities(blueprint:Blueprint, requested:readonly string[]):asserts requested is Capability[] {
  if (!Array.isArray(requested) || !requested.length) throw new Error('at least one capability is required');
  if (new Set(requested).size!==requested.length) throw new Error('requested capabilities must be unique');
  for (const capability of requested) { if (!isCapability(capability)) throw new Error(`unsupported capability: ${capability}`); if (!blueprint.workflow.includes(capability)) throw new Error(`capability not present in blueprint workflow: ${capability}`); }
}

export function createProvisionerJob(blueprint:Blueprint, requestedCapabilities:readonly string[], jobId:string, now=new Date().toISOString()):ProvisionerJob {
  validateBlueprint(blueprint); if (!/^[A-Za-z0-9._:-]+$/.test(jobId)) throw new Error('invalid jobId'); validateRequestedCapabilities(blueprint,requestedCapabilities);
  return {schemaVersion:'1.0',jobId,blueprint:'blueprint.example.json',requestedCapabilities:[...requestedCapabilities],status:'QUEUED',evidence:requestedCapabilities.map(capability=>({capability,status:'PENDING'})),createdAt:now,updatedAt:now};
}

export function validateJob(job:ProvisionerJob):void {
  if (job.schemaVersion!=='1.0' || !/^[A-Za-z0-9._:-]+$/.test(job.jobId) || !job.blueprint) throw new Error('invalid job envelope');
  if (!['QUEUED','VALIDATED','RUNNING','BLOCKED','FAILED','PROVISIONED','LIVE_VERIFIED'].includes(job.status)) throw new Error('invalid job status');
  validateRequestedCapabilities({schemaVersion:'1.0',business:{name:'validation',description:'validation'},score:0,workflow:job.requestedCapabilities,outputs:[],status:'PROVISIONING_PENDING'},job.requestedCapabilities);
  if (job.evidence.length!==job.requestedCapabilities.length) throw new Error('evidence must cover every requested capability');
  const capabilities=job.evidence.map(e=>e.capability); if (new Set(capabilities).size!==capabilities.length || !job.requestedCapabilities.every(c=>capabilities.includes(c))) throw new Error('evidence capabilities must exactly match requested capabilities');
}

export function markValidated(job:ProvisionerJob, checkedAt=new Date().toISOString()):ProvisionerJob { validateJob(job); if(job.status!=='QUEUED') throw new Error('only QUEUED jobs can be validated'); return {...job,status:'VALIDATED',updatedAt:checkedAt}; }
export function startJob(job:ProvisionerJob, startedAt=new Date().toISOString()):ProvisionerJob { validateJob(job); if(job.status!=='VALIDATED') throw new Error('only VALIDATED jobs can start'); return {...job,status:'RUNNING',updatedAt:startedAt}; }

export function recordEvidence(job:ProvisionerJob, capability:Capability, status:EvidenceStatus, reference?:string, checkedAt=new Date().toISOString()):ProvisionerJob {
  validateJob(job); if(!job.requestedCapabilities.includes(capability)) throw new Error(`capability is not requested: ${capability}`); if(job.status!=='RUNNING') throw new Error('evidence can only be recorded for RUNNING jobs');
  const evidence=job.evidence.map(item=>item.capability===capability?{...item,status,...(reference?{reference}:{}),checkedAt}:item);
  const hasFailure=evidence.some(item=>item.status==='FAILED'); const allPassed=evidence.every(item=>item.status==='PASSED');
  return {...job,evidence,status:hasFailure?'FAILED':allPassed?'PROVISIONED':'RUNNING',updatedAt:checkedAt};
}

export function verifyLive(job:ProvisionerJob, acceptanceReference:string, checkedAt=new Date().toISOString()):ProvisionerJob {
  validateJob(job); if(job.status!=='PROVISIONED') throw new Error('LIVE_VERIFIED requires PROVISIONED status'); if(!acceptanceReference.trim()) throw new Error('live acceptance evidence is required');
  return {...job,status:'LIVE_VERIFIED',updatedAt:checkedAt,evidence:job.evidence.map(item=>item.capability==='PROVISIONING'?{...item,reference:acceptanceReference,checkedAt}:item)};
}

function isCapability(value:unknown):value is Capability{return typeof value==='string' && (CAPABILITIES as readonly string[]).includes(value);}
