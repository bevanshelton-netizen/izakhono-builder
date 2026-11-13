export type WorkerRouteCredential='registry'|'qa-verifier'|'fortress-issuer';
export function workerRouteCredential(path:string):WorkerRouteCredential{
 if(path==='/fortress/grants/issue'||path==='/fortress/grants/revoke')return 'fortress-issuer';
 if(path==='/workers/verify')return 'qa-verifier';
 return 'registry';
}
export function workerRouteAuthorized(path:string,registry:boolean,qaVerifier:boolean,fortressIssuer:boolean):boolean{
 const credential=workerRouteCredential(path);
 return credential==='fortress-issuer'?fortressIssuer:credential==='qa-verifier'?qaVerifier:registry;
}
