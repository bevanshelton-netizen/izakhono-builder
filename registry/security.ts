const encoder=new TextEncoder();
function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function sha256(value:string){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
export function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
export async function bearerValid(header:string|undefined,expectedHash:string){if(!header?.startsWith('Bearer '))return false;return safeEqual(await sha256(header.slice(7)),expectedHash);}
