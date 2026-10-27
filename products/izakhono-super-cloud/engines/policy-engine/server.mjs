import http from 'node:http';
const PORT=Number(process.env.PORT||8195), ADMIN_TOKEN=process.env.SUPER_CLOUD_ADMIN_TOKEN||'';
function json(res,status,b){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(b));}
function auth(req){return !ADMIN_TOKEN||req.headers.authorization===`Bearer ${ADMIN_TOKEN}`;}
async function body(req){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
function evaluate(x){
 const violations=[];
 if(x.environment==='production'&&!x.productionEvidence)violations.push('production_evidence_required');
 if(x.tenantId&&x.targetTenantId&&x.tenantId!==x.targetTenantId)violations.push('tenant_isolation_violation');
 if(x.capacityClass==='external-fallback'&&x.allowExternalFallback!==true)violations.push('external_fallback_not_explicitly_allowed');
 if(Number(x.replicas||1)>Number(x.maxReplicas||100))violations.push('quota_exceeded');
 return {allowed:violations.length===0,violations,policyVersion:'1.0.0',evaluatedAt:new Date().toISOString()};
}
const server=http.createServer(async(req,res)=>{
 if(req.url==='/health'&&req.method==='GET')return json(res,200,{ok:true,engine:'policy-engine'});
 if(!auth(req))return json(res,401,{error:'unauthorized'});
 if(req.url==='/v1/status'&&req.method==='GET')return json(res,200,{engine:'policy-engine',policyVersion:'1.0.0'});
 if(req.url==='/v1/evaluate'&&req.method==='POST')return json(res,200,evaluate(await body(req)));
 return json(res,404,{error:'not_found'});
});
server.listen(PORT,()=>console.log(`policy-engine listening on ${PORT}`));
