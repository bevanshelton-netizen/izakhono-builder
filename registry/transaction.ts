import {Domain,RegistryStore,RegistryAdapter,transitionDomain} from './core';
import {DnsProvider} from './core';
import {provisionDns} from './dns';

export type RegistrationResult={domain:Domain;authorityTransactionId:string;authorityConfirmed:boolean;dnsPublished:boolean;dnsVerified:boolean};

export async function registerAuthoritatively(store:RegistryStore,adapter:RegistryAdapter,dns:DnsProvider,domain:Domain):Promise<RegistrationResult>{
 const available=await adapter.availability(domain.name);
 if(!available) throw new Error('domain unavailable at authoritative registry');
 const authority=await adapter.register(domain);
 if(authority.transactionId==='') throw new Error('authority transaction missing');
 const confirmed=authority.confirmed;
 if(!confirmed) throw new Error('authority registration not confirmed');
 const live=await transitionDomain(store,domain.name,'ok','authority');
 const dnsResult=await provisionDns(dns,domain.name,domain.nameservers);
 return {domain:live,authorityTransactionId:authority.transactionId,authorityConfirmed:confirmed,dnsPublished:dnsResult.published,dnsVerified:dnsResult.verified};
}
