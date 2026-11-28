import { PublisherEvidenceService, EvidenceServiceError, type EvidenceActor, type PublisherEvidenceRecord, type PublisherEvidenceStore, type EvidenceMutation, type EvidenceMutationResult } from './publisher-evidence-service';
const expect=(ok:boolean,message:string)=>{if(!ok)throw new Error(message)};
const tenant={platformId:'platform:1',entityId:'tenant:1'};
const publisher:EvidenceActor={principalRef:'principal:publisher',tenant,publisherId:'publisher:1',role:'publisher'};
const reviewer:EvidenceActor={principalRef:'principal:reviewer',tenant,publisherId:null,role:'administrator'};
const now='2026-11-27T12:00:00.000Z';
class Store implements PublisherEvidenceStore {
 record:PublisherEvidenceRecord={evidenceId:'evidence:1',requestId:'request:1',publisherId:'publisher:1',tenant,kind:'domain_control',opaqueRef:'ref:placeholder',status:'awaiting_submission',submittedBy:'',submittedAt:'',reviewedBy:null,reviewedAt:null,reviewDecisionRef:null,reasonCode:null,version:1};
 receipts=new Map<string,{fp:string;record:PublisherEvidenceRecord}>();
 async lookupIdempotency(_t:typeof tenant,key:string,fp:string):Promise<Extract<EvidenceMutationResult,{status:'replayed'|'conflict'}>|null>{const r=this.receipts.get(key);return !r?null:r.fp===fp?{status:'replayed',record:r.record,replayed:true}:{status:'conflict'};}
 async get():Promise<PublisherEvidenceRecord|null>{return this.record;}
 async commit(input:EvidenceMutation):Promise<EvidenceMutationResult>{if(input.expectedVersion!==this.record.version)return {status:'conflict'};this.record=input.next;this.receipts.set(input.idempotencyKey,{fp:input.requestFingerprint,record:this.record});return {status:'committed',record:this.record,replayed:false};}
}
async function main(){
 let actor=publisher;const store=new Store();let storageChecks=0;const authCalls:string[]=[];
 const service=new PublisherEvidenceService({sessions:{verify:async()=>actor},authorization:{authorize:async x=>{authCalls.push(x.permission);return {allowed:true,decisionRef:'auth:1',principalRef:x.principalRef,tenant:x.tenant,resourceRef:x.resourceRef,permission:x.permission,policyVersion:'policy:v1',decidedAt:now}}},storage:{verifyReference:async x=>{storageChecks++;return x.opaqueRef==='ref:immutable-object'&&x.requestId==='request:1'&&x.publisherId==='publisher:1'&&x.tenant.entityId===tenant.entityId}},store,now:()=>now});
 const submit={credential:'session',evidenceId:'evidence:1',requestId:'request:1',publisherId:'publisher:1',kind:'domain_control' as const,opaqueRef:'ref:immutable-object',expectedVersion:1,idempotencyKey:'submit:1',correlationRef:'corr:1'};
 actor={...publisher,publisherId:'publisher:other'};let ownerDenied='';try{await service.submit(submit);}catch(e){ownerDenied=(e as EvidenceServiceError).code;}expect(ownerDenied==='EVIDENCE_AUTHORIZATION_DENIED','publisher cannot submit evidence against another publisher record');actor=publisher;
 const result=await service.submit(submit);
 expect(result.status==='committed'&&result.record.status==='submitted'&&result.record.version===2,'publisher must submit opaque evidence and advance version');
 expect(storageChecks===1&&authCalls[0]==='publishing.evidence.submit','submission must verify scoped storage and exact permission');
 const replay=await service.submit(submit);expect(replay.status==='replayed','identical submission retry must replay');
 actor=reviewer;
 const reviewed=await service.review({credential:'review-session',evidenceId:'evidence:1',decision:'accept',reasonCode:'DOMAIN_CONTROL_CONFIRMED',expectedVersion:2,idempotencyKey:'review:1',correlationRef:'corr:2'});
 expect(reviewed.status==='committed'&&reviewed.record.status==='accepted'&&reviewed.record.reviewedBy===reviewer.principalRef,'reviewer acceptance must be immutable and attributed');
 expect(authCalls.includes('publishing.evidence.review'),'review must require distinct reviewer permission');
 let stale='';try{await service.review({credential:'review-session',evidenceId:'evidence:1',decision:'reject',reasonCode:'REJECTED',expectedVersion:2,idempotencyKey:'review:2',correlationRef:'corr:3'});}catch(e){stale=(e as EvidenceServiceError).code;}
 expect(stale==='EVIDENCE_VERSION_CONFLICT','stale review must conflict');
 actor=publisher;let denied='';try{await service.review({credential:'session',evidenceId:'evidence:1',decision:'reject',reasonCode:'REJECTED',expectedVersion:3,idempotencyKey:'review:3',correlationRef:'corr:4'});}catch(e){denied=(e as EvidenceServiceError).code;}
 expect(denied==='EVIDENCE_AUTHORIZATION_DENIED','publisher cannot review evidence');
 console.log('IZAKHONO PUBLISHER EVIDENCE SERVICE: PASS');
}
void main();
