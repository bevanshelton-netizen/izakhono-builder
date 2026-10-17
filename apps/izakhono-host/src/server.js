import http from "node:http";

const port = Number(process.env.PORT || 8788);
const service = {
  name: "IZAKHONO HOST",
  engine: "izakhono-host",
  version: "0.1.0",
  owned_first: true,
  public_live: false,
  capabilities: [
    "tenant-control-plane","web-hosting","business-email","dns",
    "tls","databases","backups","monitoring","reseller-hosting","registrar-adapters"
  ]
};

const server = http.createServer((req,res)=>{
  res.setHeader("content-type","application/json; charset=utf-8");
  res.setHeader("cache-control","no-store");
  if(req.url==="/health"){
    res.writeHead(200);
    return res.end(JSON.stringify({ok:true,...service}));
  }
  if(req.url==="/api/v1/capabilities"){
    res.writeHead(200);
    return res.end(JSON.stringify(service));
  }
  res.writeHead(404);
  res.end(JSON.stringify({error:"not_found"}));
});

server.listen(port,"0.0.0.0",()=>console.log(`IZAKHONO HOST engine listening on ${port}`));
