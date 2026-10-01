import {randomBytes,randomUUID} from 'node:crypto';

export type Session={id:string,deviceId:string,operatorId:string,token:string,expiresAt:string};
const sessions=new Map<string,Session>();

export function createGraphicsSession(deviceId:string,operatorId:string){
 const id='gfx_'+randomUUID();
 const token=randomBytes(32).toString('hex');
 const expires=new Date(Date.now()+15*60_000).toISOString();
 const s={id,deviceId,operatorId,token,expiresAt:expires};
 sessions.set(id,s);
 return {sessionId:id,expiresAt:expires,websocketUrl:'/api/graphics/ws?session='+encodeURIComponent(id)+'&token='+encodeURIComponent(token),iceServers:[]};
}

export function getGraphicsSession(id:string,token:string){
 const s=sessions.get(id);
 if(!s||s.token!==token||Date.parse(s.expiresAt)<Date.now())return null;
 return s;
}

export function closeGraphicsSession(id:string){sessions.delete(id)}
