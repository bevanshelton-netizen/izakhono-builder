export type DnsRecord={name:string;type:string;ttl:number;content:string;disabled?:boolean};
export interface PowerDnsClient { replaceRecords(zone:string,records:DnsRecord[]):Promise<void>; deleteZone?(zone:string):Promise<void>; }
export class PowerDnsProvider {
  constructor(private client:PowerDnsClient){}
  async publish(zone:string,records:unknown[]){await this.client.replaceRecords(zone,records as DnsRecord[]);}
  async remove(zone:string){if(this.client.deleteZone) await this.client.deleteZone(zone);}
}
