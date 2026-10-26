import {NextResponse} from 'next/server';
import {dbFetch} from '@/lib/server-db';

export async function POST(request:Request){
  try{
    const body=await request.json().catch(()=>({}));
    const business=String(body.business??'Your business').trim();
    const goal=String(body.goal??'Generate more qualified customers').trim();
    const budget=Math.max(0,Number(body.budget??5000));
    const workspaceId=body.workspaceId?String(body.workspaceId):'';
    const actions=[
      {channel:'Website & Conversion',priority:'high',action:'Create a conversion-focused landing page and lead form.'},
      {channel:'SEO Engine',priority:'high',action:'Publish a local-intent content cluster around the highest-value customer searches.'},
      {channel:'Paid Growth',priority:'high',action:`Allocate an initial paid-media test budget of R${Math.round(budget*0.6).toLocaleString()}.`},
      {channel:'Social Command',priority:'medium',action:'Create a 30-day content and engagement calendar.'},
      {channel:'CRM & WhatsApp',priority:'high',action:'Capture, qualify and route every new lead into the follow-up pipeline.'},
      {channel:'AI Operations',priority:'medium',action:'Run daily performance checks and surface recommended growth actions.'}
    ];
    let persistedJobId:string|undefined;
    let campaignId:string|undefined;
    if(workspaceId){
      const campaign=await dbFetch('business_engine_campaigns?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:workspaceId,name:`${business} Growth Engine`,objective:goal,channels:actions.map(a=>a.channel),monthly_budget_cents:Math.round(budget*100),status:'planned',generated_plan:{goal,budget,actions}})});
      campaignId=campaign?.[0]?.id;
      const job=await dbFetch('business_engine_jobs?select=*',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({workspace_id:workspaceId,job_type:'growth_plan',status:'completed',priority:20,payload:{business,goal,budget},result:{actions,campaignId},attempts:1,completed_at:new Date().toISOString()})});
      persistedJobId=job?.[0]?.id;
    }
    return NextResponse.json({id:`plan_${Date.now()}`,business,goal,budget,status:'ready',createdAt:new Date().toISOString(),campaignId,persistedJobId,actions});
  }catch(error:any){
    console.error('Business Engine growth plan failed',error);
    return NextResponse.json({error:error?.message||'Unable to create growth plan.'},{status:500});
  }
}
