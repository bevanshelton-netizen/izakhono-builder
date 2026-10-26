import {NextResponse} from 'next/server';
import {dbFetch,slugify} from '@/lib/server-db';

export async function POST(request:Request){
  try{
    const body=await request.json();
    const businessName=String(body?.businessName||'').trim();
    const businessEmail=String(body?.email||'').trim().toLowerCase();
    const ownerUserId=body?.ownerUserId ? String(body.ownerUserId) : null;
    if(!businessName || !businessEmail || !businessEmail.includes('@')) return NextResponse.json({error:'Business name and a valid email are required.'},{status:400});
    const baseSlug=slugify(businessName);
    const existing=await dbFetch(`business_engine_workspaces?select=id,slug&business_email=eq.${encodeURIComponent(businessEmail)}&limit=1`);
    let workspace=existing?.[0];
    if(!workspace){
      const created=await dbFetch('business_engine_workspaces?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({business_name:businessName,business_email:businessEmail,slug:baseSlug,owner_user_id:ownerUserId})});
      workspace=created?.[0];
    }
    const job=await dbFetch('business_engine_jobs?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:workspace.id,job_type:'onboarding',status:'queued',priority:10,payload:{businessName,businessEmail}})});
    const jobId=job?.[0]?.id;
    if(jobId){
      const now=new Date().toISOString();
      await dbFetch('business_engine_job_steps',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([
        {job_id:jobId,step_key:'identity',title:'Create business identity',status:'completed',completed_at:now},
        {job_id:jobId,step_key:'workspace',title:'Activate growth workspace',status:'completed',completed_at:now},
        {job_id:jobId,step_key:'provisioning',title:'Queue infrastructure provisioning',status:'queued'},
        {job_id:jobId,step_key:'growth',title:'Prepare growth configuration',status:'queued'}
      ])});
    }
    return NextResponse.json({ok:true,workspaceId:workspace.id,jobId,status:'onboarding'});
  }catch(error:any){
    console.error('Business Engine onboarding failed',error);
    return NextResponse.json({error:error?.message||'Unable to activate workspace.'},{status:500});
  }
}
