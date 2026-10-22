import http from 'node:http';
import { createUser, login, revoke } from './auth.mjs';

const host = process.env.MAIL_AUTH_LISTEN_HOST || '127.0.0.1';
const port = Number(process.env.MAIL_AUTH_LISTEN_PORT || 8789);

function json(res, status, body, extra = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra });
  res.end(JSON.stringify(body));
}
async function body(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if (size > 32768) throw new Error('body_too_large'); chunks.push(chunk); }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
function token(req) { const h=String(req.headers.authorization||''); return h.startsWith('Bearer ')?h.slice(7):''; }

export function startAuthApi() {
  const server = http.createServer(async (req,res) => {
    const path = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    try {
      if (req.method==='GET' && path==='/healthz') return json(res,200,{ok:true,service:'izakhono-mail-auth'});
      if (req.method==='POST' && path==='/v1/auth/bootstrap') {
        const input=await body(req);
        return json(res,201,{ok:true,user:createUser({address:input.address,password:input.password,displayName:input.display_name||'Bevan Shelton'})});
      }
      if (req.method==='POST' && path==='/v1/auth/login') {
        const input=await body(req); const result=login({address:input.address,password:input.password});
        return json(res,200,{ok:true,...result});
      }
      if (req.method==='POST' && path==='/v1/auth/logout') {
        return json(res,200,{ok:true,revoked:revoke(token(req))});
      }
      return json(res,404,{ok:false,error:'not_found'});
    } catch(error) {
      const message=String(error?.message||error);
      return json(res,message==='body_too_large'?413:message==='Invalid credentials'?401:400,{ok:false,error:message});
    }
  });
  server.listen(port,host,()=>console.log(`[IZAKHONO MAIL] auth API listening on ${host}:${port}`));
  return server;
}

if (process.argv[1]?.endsWith('auth-api.mjs')) startAuthApi();
