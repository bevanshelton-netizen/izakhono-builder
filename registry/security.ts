import { createHash, timingSafeEqual } from 'node:crypto';

export function sha256(value:string){return createHash('sha256').update(value).digest('hex');}
export function safeEqual(a:string,b:string){
 const aa=Buffer.from(a); const bb=Buffer.from(b);
 return aa.length===bb.length && timingSafeEqual(aa,bb);
}
export function bearerValid(header:string|undefined, expectedHash:string){
 if(!header?.startsWith('Bearer ')) return false;
 return safeEqual(sha256(header.slice(7)), expectedHash);
}
