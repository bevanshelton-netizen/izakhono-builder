import { DnsProvider } from './core';
import { PowerDnsProvider, PowerDnsClient } from './powerdns';

export type DnsProvisionResult={zone:string;published:boolean;verified:boolean};

export async function provisionDns(provider:DnsProvider,zone:string,nameservers:string[]):Promise<DnsProvisionResult>{
  if(!zone) throw new Error('zone required');
  await provider.publish(zone,nameservers.map((content)=>({name:zone,type:'NS',ttl:300,content})));
  return {zone,published:true,verified:false};
}

export function powerDns(provider:PowerDnsClient){ return new PowerDnsProvider(provider); }
