export type AbuseCase={id:string;domain:string;category:'phishing'|'malware'|'spam'|'copyright'|'other';status:'open'|'review'|'resolved'|'rejected';reportedBy:string;createdAt:string;notes?:string};
export class MemoryAbuseStore{
 cases=new Map<string,AbuseCase>();
 create(input:Omit<AbuseCase,'id'|'createdAt'|'status'>){
  const id='abuse-'+crypto.randomUUID(); const item={...input,id,createdAt:new Date().toISOString(),status:'open' as const}; this.cases.set(id,item); return item;
 }
 update(id:string,status:AbuseCase['status'],notes?:string){const c=this.cases.get(id);if(!c)throw new Error('case not found');const next={...c,status,notes:c.notes??notes};this.cases.set(id,next);return next;}
}
