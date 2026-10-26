const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function dbConfig(){
  if(!url || !key) throw new Error('Business Engine database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return {url:url.replace(/\/$/,''),key};
}

export async function dbFetch(path:string, init:RequestInit={}){
  const {url,key}=dbConfig();
  const headers=new Headers(init.headers);
  headers.set('apikey',key);
  headers.set('Authorization',`Bearer ${key}`);
  headers.set('Content-Type','application/json');
  const response=await fetch(`${url}/rest/v1/${path}`,{
    ...init,
    headers,
    cache:'no-store',
  });
  const text=await response.text();
  let data:any=null;
  try{data=text?JSON.parse(text):null}catch{data=text}
  if(!response.ok){
    const message=typeof data==='object'&&data?.message?data.message:`Database request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export function slugify(value:string){
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80) || 'business';
}
