import { Domain, RegistryAdapter, normalizeDomain } from './core';

export type AuthorityResult={transactionId:string;status:'submitted'|'confirmed';expiresAt?:string};

export interface AuthorityTransport {
  check(name:string):Promise<boolean>;
  register(domain:Domain):Promise<AuthorityResult>;
  renew(name:string,years:number):Promise<AuthorityResult>;
  transfer(name:string,authCode:string):Promise<AuthorityResult>;
}

export class ExternalRegistryAdapter implements RegistryAdapter {
  constructor(private transport:AuthorityTransport){}
  availability(name:string){return this.transport.check(normalizeDomain(name));}
  async register(domain:Domain){const result=await this.transport.register({...domain,name:normalizeDomain(domain.name)}); return {transactionId:result.transactionId,confirmed:result.status==='confirmed'};}
  async renew(name:string,years:number){const result=await this.transport.renew(normalizeDomain(name),years); if(!result.expiresAt) throw new Error('authority renewal expiry missing'); return {transactionId:result.transactionId,expiresAt:result.expiresAt};}
  async transfer(name:string,authCode:string){const result=await this.transport.transfer(normalizeDomain(name),authCode); return {transactionId:result.transactionId};}
}
