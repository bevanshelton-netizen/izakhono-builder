import {normalizeDomain} from "./core";
export type EppCommand={command:"check"|"info"|"create"|"renew"|"delete"|"transfer";domain:string};
export function parseEpp(xml:string):EppCommand{const clean=xml.replace(/\s+/g," ");const m=clean.match(/<domain:(check|info|create|renew|delete|transfer)[^>]*>[\s\S]*?<domain:name[^>]*>([^<]+)<\/domain:name>/i);if(!m)throw new Error("unsupported EPP command");return {command:m[1].toLowerCase() as EppCommand["command"],domain:normalizeDomain(m[2])};}
export function eppGreeting(serverName:string){return `<?xml version="1.0" encoding="UTF-8"?><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><greeting><svID>${serverName}</svID><svDate>${new Date().toISOString()}</svDate></greeting></epp>`;}
export function eppResult(code:number,message:string,body=""){return `<?xml version="1.0" encoding="UTF-8"?><epp xmlns="urn:ietf:params:xml:ns:epp-1.0"><response><result code="${code}"><msg>${message}</msg></result>${body}</response></epp>`;}
