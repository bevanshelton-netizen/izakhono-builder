export interface HostProviderEnv {
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  OWNED_RUNTIME_URL?: string;
  OWNED_RUNTIME_TOKEN?: string;
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
  if(!r.ok || data.success===false) throw new Error('DNS provider failed: '+JSON.stringify(data.errors||data));
  return data;
}

function cfName(domain:string,name:string){ return name==='@' ? domain : name+'.'+domain; }

export async function applyCloudflareDns(domain:string, records:DnsRecord[], env:HostProviderEnv){
  const qs=new URLSearchParams({name:domain,match:'all',per_page:'50'});
  if(env.CLOUDFLARE_ACCOUNT_ID) qs.set('account.id',env.CLOUDFLARE_ACCOUNT_ID);
  const zones=await cf('/zones?'+qs.toString(),env);
  const zone=zones.result?.find((z:any)=>z.name===domain);
  if(!zone) throw new Error('DNS zone not found for '+domain);

  const results=[];
  for(const record of records){
    const name=cfName(domain,record.name);
    const lookup=new URLSearchParams({type:record.type,name,per_page:'100'});
    const existing=await cf('/zones/'+zone.id+'/dns_records?'+lookup.toString(),env);
    const current=existing.result?.[0];
    const payload:any={type:record.type,name,content:record.content,ttl:record.ttl??1,
      proxied:['A','AAAA','CNAME'].includes(record.type) ? Boolean(record.proxied) : false};
    if(record.priority!==undefined) payload.priority=record.priority;
    const result=current
      ? await cf('/zones/'+zone.id+'/dns_records/'+current.id,env,{method:'PATCH',body:JSON.stringify(payload)})
      : await cf('/zones/'+zone.id+'/dns_records',env,{method:'POST',body:JSON.stringify(payload)});
    results.push({name,type:record.type,action:current?'updated':'created',id:result.result?.id||current?.id||null});
  }
  return {zone_id:zone.id,records:results};
}

export async function provisionOwnedSite(input:{domain:string;source_ref?:string;site_id?:string},env:HostProviderEnv){
  if(!env.OWNED_RUNTIME_URL) throw new Error('OWNED_RUNTIME_URL is not configured');
  if(!env.OWNED_RUNTIME_TOKEN) throw new Error('OWNED_RUNTIME_TOKEN is not configured');
  const r=await fetch(new URL('/api/sites/provision',env.OWNED_RUNTIME_URL),{
    method:'POST',
    headers:{'content-type':'application/json','authorization':'Bearer '+env.OWNED_RUNTIME_TOKEN},
    body:JSON.stringify(input)
  });
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok || data.ok===false) throw new Error('IZAKHONO runtime failed ('+r.status+'): '+JSON.stringify(data));
  return data;
}
