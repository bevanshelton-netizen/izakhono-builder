export interface RateLimitStore { get(key:string):Promise<{count:number;windowStart:number}|undefined>; put(key:string,value:{count:number;windowStart:number}):Promise<void>; }

export class MemoryRateLimitStore implements RateLimitStore {
 private values=new Map<string,{count:number;windowStart:number}>();
 async get(key:string){return this.values.get(key)}
 async put(key:string,value:{count:number;windowStart:number}){this.values.set(key,value)}
}

export async function allowRate(store:RateLimitStore,key:string,limit:number,windowMs:number,now=Date.now()){
 const current=await store.get(key);
 if(!current || now-current.windowStart>=windowMs){
  await store.put(key,{count:1,windowStart:now}); return true;
 }
 if(current.count>=limit) return false;
 await store.put(key,{count:current.count+1,windowStart:current.windowStart}); return true;
}
