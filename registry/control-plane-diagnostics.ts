import {normalizeDomain} from './core';

export type ControlPlaneDiagnostic={
 domain:string;
 checkedAt:string;
 dns:{ok:boolean;records:Record<string,string[]>;error?:string};
 https:{ok:boolean;status?:number;finalUrl?:string;elapsedMs:number;error?:string};
 evidence:string[];
 liveClaimEligible:boolean;
};

const DNS_ENDPOINT='https://cloudflare-dns.com/dns-query';
const DNS_TYPES=['A','AAAA','CNAME'] as const;
const literalIpv4=/^(?:\d{1,3}\.){3}\d{1,3}$/;

async function dnsQuery(domain:string,type:string){
 const url=`${DNS_ENDPOINT}?name=${encodeURIComponent(domain)}&type=${type}`;
 const response=await fetch(url,{headers:{accept:'application/dns-json'},redirect:'error'});
 if(!response.ok)throw new Error(`DNS resolver returned ${response.status}`);
 const data=await response.json() as {Status?:number;Answer?:Array<{data?:string}>};
 if(data.Status!==0 && data.Status!==3)throw new Error(`DNS status ${data.Status??'unknown'}`);
 return (data.Answer??[]).map(answer=>String(answer.data??'')).filter(Boolean);
}

export async function diagnoseControlPlane(domainInput:string):Promise<ControlPlaneDiagnostic>{
 const domain=normalizeDomain(domainInput);
 if(literalIpv4.test(domain))throw new Error('literal IP targets are not allowed');
 const checkedAt=new Date().toISOString();
 const records:Record<string,string[]>={};
 let dnsOk=true;let dnsError:string|undefined;
 try{for(const type of DNS_TYPES)records[type]=await dnsQuery(domain,type);if(!Object.values(records).some(values=>values.length))dnsOk=false;}catch(error){dnsOk=false;dnsError=error instanceof Error?error.message:String(error);}
 const started=Date.now();
 let httpsOk=false;let httpsStatus:number|undefined;let finalUrl:string|undefined;let httpsError:string|undefined;
 try{
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);
  const response=await fetch(`https://${domain}/`,{method:'GET',redirect:'follow',signal:controller.signal});
  clearTimeout(timeout);httpsStatus=response.status;finalUrl=response.url;httpsOk=response.ok;
 }catch(error){httpsError=error instanceof Error?error.message:String(error);}
 const evidence:string[]=[];
 if(dnsOk)evidence.push('dns_resolution_success');
 if(httpsOk)evidence.push('https_health_check');
 return {domain,checkedAt,dns:{ok:dnsOk,records,...dnsError?{error:dnsError}:{}},https:{ok:httpsOk,...httpsStatus!==undefined?{status:httpsStatus}:{},...finalUrl?{finalUrl}:{},elapsedMs:Date.now()-started,...httpsError?{error:httpsError}:{}},evidence,liveClaimEligible:dnsOk&&httpsOk};
}
