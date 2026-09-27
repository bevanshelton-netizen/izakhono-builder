import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here=dirname(fileURLToPath(import.meta.url));
const html=await readFile(join(here,"index.html"));
const port=Number(process.env.PORT || 8787);
const host=process.env.HOST || "0.0.0.0";

function secureHeaders(type){
  return {
    "content-type":type,
    "cache-control":"no-store",
    "x-content-type-options":"nosniff",
    "referrer-policy":"no-referrer",
    "x-frame-options":"DENY",
    "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=()",
    "content-security-policy":"default-src 'self' 'unsafe-inline' data: blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  };
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url || "/", "http://localhost");
  if(url.pathname==="/health"){
    res.writeHead(200,{...secureHeaders("application/json; charset=utf-8"),"cache-control":"no-store"});
    res.end(JSON.stringify({ok:true,service:"IZAKHONO BUSINESS AI",version:"0.3.1",runtime:"owned-node01",privacy:"local-first"}));
    return;
  }
  if(url.pathname==="/" || url.pathname==="/index.html"){
    res.writeHead(200,secureHeaders("text/html; charset=utf-8"));
    res.end(html);
    return;
  }
  res.writeHead(404,secureHeaders("text/plain; charset=utf-8"));
  res.end("Not found");
});

server.listen(port,host,()=>{ console.log("IZAKHONO BUSINESS AI owned runtime listening on "+host+":"+port); });
