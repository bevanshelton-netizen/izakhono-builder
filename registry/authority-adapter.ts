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
  register(domain:Domain){return this.transport.register({...domain,name:normalizeDomain(domain.name)});}
  renew(name:string,years:number){return this.transport.renew(normalizeDomain(name),years);}
  transfer(name:string,authCode:string){return this.transport.transfer(normalizeDomain(name),authCode);}
}
