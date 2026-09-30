import {MemoryRateLimitStore,allowRate} from './rate-limit';

const s=new MemoryRateLimitStore();
if(!await allowRate(s,'test',2,60000,1000)) throw new Error('first request blocked');
if(!await allowRate(s,'test',2,60000,2000)) throw new Error('second request blocked');
if(await allowRate(s,'test',2,60000,3000)) throw new Error('third request allowed');
if(!await allowRate(s,'test',2,60000,62001)) throw new Error('new window blocked');
console.log('IZAKHONO rate-limit tests passed');
