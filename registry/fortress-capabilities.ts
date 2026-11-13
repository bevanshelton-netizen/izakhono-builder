/** FORTRESS-signed, short-lived worker capability grants.
 * Token format: base64url(JSON claims).base64url(HMAC-SHA256(payload)).
 * The signing secret is provisioned only in the runtime secret store.
 */
export type FortressCapabilityClaims = {
  iss: 'IZAKHONO-FORTRESS';
  sub: string;
  aud: 'IZAKHONO-WORKER-SUPERVISOR';
  actions: string[];
  risk: 'low'|'medium'|'high';
  iat: number;
  nbf: number;
  exp: number;
  jti: string;
};
const decode = (value:string) => {
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
};
export async function verifyFortressCapabilityGrant(token:unknown,workerId:string,risk:string,secret?:string,nowSeconds=Math.floor(Date.now()/1000)){
  if(typeof token!=='string'||!secret)return {ok:false as const,reason:'FORTRESS capability grant or verifier secret missing'};
  const parts=token.split('.');
  if(parts.length!==2)return {ok:false as const,reason:'malformed capability grant'};
  let claims:FortressCapabilityClaims;
  try{claims=JSON.parse(new TextDecoder().decode(decode(parts[0])));if(!claims||typeof claims!=='object'||Array.isArray(claims))return {ok:false as const,reason:'invalid capability claims'};}catch{return {ok:false as const,reason:'invalid capability claims'};}
  if(typeof claims.sub!=='string'||typeof claims.aud!=='string'||claims.iss!=='IZAKHONO-FORTRESS'||claims.aud!=='IZAKHONO-WORKER-SUPERVISOR'||claims.sub!==workerId)return {ok:false as const,reason:'grant issuer, audience or worker identity mismatch'};
  if(!Array.isArray(claims.actions)||!claims.actions.includes('execute'))return {ok:false as const,reason:'execute capability not granted'};
  if(claims.risk!==risk)return {ok:false as const,reason:'grant risk does not match job risk'};
  if(!Number.isInteger(claims.iat)||!Number.isInteger(claims.nbf)||!Number.isInteger(claims.exp)||claims.exp<=nowSeconds||claims.nbf>nowSeconds||claims.iat>nowSeconds+30||claims.exp-claims.iat>900)return {ok:false as const,reason:'grant is expired, not yet valid, or exceeds 15-minute maximum lifetime'};
  if(typeof claims.jti!=='string'||claims.jti.length<12)return {ok:false as const,reason:'grant identifier missing'};
  try{
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(parts[0])));
    const supplied=decode(parts[1]);
    if(signature.length!==supplied.length)return {ok:false as const,reason:'invalid grant signature'};
    let mismatch=0;for(let i=0;i<signature.length;i++)mismatch|=signature[i]^supplied[i];
    if(mismatch!==0)return {ok:false as const,reason:'invalid grant signature'};
  }catch{return {ok:false as const,reason:'capability verifier unavailable'};}
  return {ok:true as const,claims};
}
