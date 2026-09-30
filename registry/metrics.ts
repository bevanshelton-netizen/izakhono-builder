export type RegistryMetric={name:string;value:number;at:string};
export class RegistryMetrics{
 private values=new Map<string,number>();
 inc(name:string,amount=1){this.values.set(name,(this.values.get(name)||0)+amount);}
 snapshot():RegistryMetric[]{const at=new Date().toISOString();return [...this.values].map(([name,value])=>({name,value,at}));}
}
