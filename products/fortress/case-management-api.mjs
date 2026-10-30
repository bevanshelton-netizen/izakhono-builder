const STATUSES = Object.freeze(['ALERT_CREATED','TRIAGED','INVESTIGATING','ESCALATED','RESOLVED','CLOSED']);
const DECISIONS = Object.freeze(['ALLOW','ALLOW_WITH_MONITORING','CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);
const PRIORITIES = Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const DISPOSITIONS = Object.freeze(['CONFIRMED_FRAUD','SUSPECTED_FRAUD','FALSE_POSITIVE','CUSTOMER_PROTECTION','MERCHANT_COMPROMISE','ACCOUNT_TAKEOVER','SCAM_ATTEMPT','MULE_ACTIVITY','POLICY_VIOLATION','NO_ACTION']);
const TRANSITIONS = Object.freeze({ ALERT_CREATED:['TRIAGED'], TRIAGED:['INVESTIGATING'], INVESTIGATING:['ESCALATED','RESOLVED'], ESCALATED:['INVESTIGATING','RESOLVED'], RESOLVED:['CLOSED'], CLOSED:[] });
const CONSEQUENTIAL = new Set(['CHALLENGE','HOLD_FOR_REVIEW','BLOCK','ESCALATE']);
const RPCS = Object.freeze({ create:'fortress_create_case', transition:'fortress_transition_case', assign:'fortress_assign_case', evidence:'fortress_add_case_evidence' });
function safety(){ return {sandboxOnly:true,liveMoneyMovement:false}; }
function fail(error,details={}){ return {ok:false,error,...details,safety:safety()}; }
function validId(v){ return typeof v==='string' && v.trim().length>0; }
function validUuid(v){ return typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }

export function validateCreateCase(input={}){
 if(!input||typeof input!=='object') return fail('INVALID_CASE');
 if(!validId(input.caseNumber)) return fail('CASE_NUMBER_REQUIRED');
 if(!validId(input.subjectId)) return fail('SUBJECT_ID_REQUIRED');
 if(input.riskEventId!==undefined&&!validUuid(input.riskEventId)) return fail('RISK_EVENT_ID_INVALID');
 if(!PRIORITIES.includes(input.priority??'MEDIUM')) return fail('PRIORITY_INVALID');
 if(!DECISIONS.includes(input.decision)) return fail('DECISION_INVALID');
 if(!Number.isFinite(input.riskScore)||input.riskScore<0||input.riskScore>100) return fail('RISK_SCORE_INVALID');
 if(CONSEQUENTIAL.has(input.decision)&&(!Array.isArray(input.reasonCodes)||input.reasonCodes.length===0)) return fail('REASON_CODES_REQUIRED');
 if(input.safety?.liveMoneyMovement===true) return fail('LIVE_MONEY_MOVEMENT_FORBIDDEN');
 return {ok:true,safety:safety()};
}

export function buildCreateCase(input={}){
 const v=validateCreateCase(input); if(!v.ok)return v;
 return {ok:true,operation:'create_case',rpc:RPCS.create,payload:{p_case_number:input.caseNumber,p_risk_event_id:input.riskEventId??null,p_subject_id:input.subjectId,p_merchant_id:input.merchantId??null,p_transaction_id:input.transactionId??null,p_priority:input.priority??'MEDIUM',p_decision:input.decision,p_risk_score:input.riskScore,p_reason_codes:input.reasonCodes??[],p_metadata:input.metadata??{}},safety:safety()};
}

export function validateTransition(fromStatus,toStatus,{evidenceCount=0,disposition=null}={}){
 if(!STATUSES.includes(fromStatus)||!STATUSES.includes(toStatus)) return fail('STATUS_INVALID');
 if(!TRANSITIONS[fromStatus].includes(toStatus)) return fail('TRANSITION_NOT_ALLOWED',{fromStatus,toStatus});
 if(toStatus==='CLOSED'&&evidenceCount<1)return fail('CLOSURE_EVIDENCE_REQUIRED');
 if(toStatus==='RESOLVED'&&!DISPOSITIONS.includes(disposition))return fail('RESOLUTION_DISPOSITION_REQUIRED');
 return {ok:true,safety:safety()};
}

export function buildTransition({caseId,fromStatus,toStatus,evidenceCount=0,disposition=null,actorId,reason}={}){
 if(!validId(caseId))return fail('CASE_ID_REQUIRED');
 if(!validId(actorId))return fail('ACTOR_ID_REQUIRED');
 const v=validateTransition(fromStatus,toStatus,{evidenceCount,disposition}); if(!v.ok)return v;
 return {ok:true,operation:'transition_case',rpc:RPCS.transition,payload:{p_case_id:caseId,p_to_status:toStatus,p_actor_id:actorId,p_disposition:disposition,p_reason:reason??null},safety:safety()};
}

export function buildEvidence({caseId,evidenceType,referenceId,contentHash,actorId,metadata={}}={}){
 if(!validId(caseId))return fail('CASE_ID_REQUIRED');
 if(!validId(evidenceType)||!validId(referenceId)||!validId(contentHash))return fail('EVIDENCE_FIELDS_REQUIRED');
 if(!validId(actorId))return fail('ACTOR_ID_REQUIRED');
 return {ok:true,operation:'add_case_evidence',rpc:RPCS.evidence,payload:{p_case_id:caseId,p_evidence_type:evidenceType,p_reference_id:referenceId,p_content_hash:contentHash,p_actor_id:actorId,p_metadata:metadata},safety:safety()};
}

export function buildAssignment({caseId,assignedTo,actorId}={}){
 if(!validId(caseId)||!validId(assignedTo)||!validId(actorId))return fail('ASSIGNMENT_FIELDS_REQUIRED');
 return {ok:true,operation:'assign_case',rpc:RPCS.assign,payload:{p_case_id:caseId,p_assigned_to:assignedTo,p_actor_id:actorId},safety:safety()};
}

export function assertDecisionSafety(decision,reasonCodes=[]){
 if(!DECISIONS.includes(decision))return fail('DECISION_INVALID');
 if(CONSEQUENTIAL.has(decision)&&(!Array.isArray(reasonCodes)||reasonCodes.length===0))return fail('REASON_CODES_REQUIRED');
 return {ok:true,safety:safety()};
}

export {STATUSES,DECISIONS,PRIORITIES,DISPOSITIONS,TRANSITIONS,RPCS};