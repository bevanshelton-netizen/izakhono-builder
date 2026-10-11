export interface RuntimeProviderEnv {
  IZAKHONO_RUNTIME_URL?: string;
  IZAKHONO_RUNTIME_TOKEN?: string;
}

export async function provisionRuntime(input:{app:string;image:string;domain?:string;health_path?:string;digest?:string},env:RuntimeProviderEnv){
  if(!env.IZAKHONO_RUNTIME_URL) throw new Error('IZAKHONO_RUNTIME_URL is not configured');
  const headers:any={'content-type':'application/json'};
  if(env.IZAKHONO_RUNTIME_TOKEN) headers.authorization='Bearer '+env.IZAKHONO_RUNTIME_TOKEN;
  const r=await fetch(env.IZAKHONO_RUNTIME_URL.replace(/\/$/,'')+'/api/deployments',{method:'POST',headers,body:JSON.stringify(input)});
  const data:any=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error('IZAKHONO Runtime failed ('+r.status+'): '+JSON.stringify(data));
  return data;
}
