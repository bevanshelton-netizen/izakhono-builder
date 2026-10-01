export interface HostProviderEnv {
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  VERCEL_TOKEN?: string;
  VERCEL_TEAM_ID?: string;
}

type DnsRecord = {
  type: 'A'|'AAAA'|'CNAME'|'TXT'|'MX';
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
};

async function cf(path:string, env:HostProviderEnv, init:RequestInit={}){
  if(!env.CLOUDFLARE_API_TOKEN) throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  const r=await fetch('https://api.cloudflare.com/client/v4'+path,{
    ...init,
    headers:{'content-type':'application/json','authorization':'Bearer '+env.CLOUDFLARE_API_TOKEN,...(init.headers||{})}
  });
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok || data.success===false) throw new Error('Cloudflare API failed: '+JSON.stringify(data.errors||data));
  return data;
}

async function vercel(path:string, env:HostProviderEnv, init:RequestInit={}){
  if(!env.VERCEL_TOKEN) throw new Error('VERCEL_TOKEN is not configured');
  const url=new URL('https://api.vercel.com'+path);
  if(env.VERCEL_TEAM_ID) url.searchParams.set('teamId',env.VERCEL_TEAM_ID);
  const r=await fetch(url.toString(),{
    ...init,
    headers:{'content-type':'application/json','authorization':'Bearer '+env.VERCEL_TOKEN,...(init.headers||{})}
  });
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error('Vercel API failed ('+r.status+'): '+JSON.stringify(data));
  return data;
}

function cfName(domain:string,name:string){
  return name==='@' ? domain : name+'.'+domain;
}

export async function applyCloudflareDns(domain:string, records:DnsRecord[], env:HostProviderEnv){
  const qs=new URLSearchParams({name:domain,match:'all',per_page:'50'});
  if(env.CLOUDFLARE_ACCOUNT_ID) qs.set('account.id',env.CLOUDFLARE_ACCOUNT_ID);
  const zones=await cf('/zones?'+qs.toString(),env);
  const zone=zones.result?.find((z:any)=>z.name===domain);
  if(!zone) throw new Error('Cloudflare zone not found for '+domain);

  const results=[];
  for(const record of records){
    const name=cfName(domain,record.name);
    const lookup=new URLSearchParams({type:record.type,name,per_page:'100'});
    const existing=await cf('/zones/'+zone.id+'/dns_records?'+lookup.toString(),env);
    const current=existing.result?.[0];
    const payload:any={
      type:record.type,name,content:record.content,ttl:record.ttl??1,
      proxied:record.type==='A'||record.type==='AAAA'||record.type==='CNAME' ? Boolean(record.proxied) : false
    };
    if(record.priority!==undefined) payload.priority=record.priority;

    if(current){
      const updated=await cf('/zones/'+zone.id+'/dns_records/'+current.id,{
        ...env,
        // provider token is intentionally read from env only
      },{method:'PATCH',body:JSON.stringify(payload)});
      results.push({name,type:record.type,action:'updated',id:updated.result?.id||current.id});
    }else{
      const created=await cf('/zones/'+zone.id+'/dns_records',{...env},{method:'POST',body:JSON.stringify(payload)});
      results.push({name,type:record.type,action:'created',id:created.result?.id||null});
    }
  }
  return {zone_id:zone.id,records:results};
}

export async function attachVercelDomain(projectId:string,domain:string,env:HostProviderEnv){
  const result=await vercel('/v10/projects/'+encodeURIComponent(projectId)+'/domains',env,{
    method:'POST',
    body:JSON.stringify({name:domain})
  });
  return {
    domain,
    project_id:projectId,
    verified:Boolean(result.verified),
    verification:result.verification||[],
    redirect:result.redirect||null,
  };
}
