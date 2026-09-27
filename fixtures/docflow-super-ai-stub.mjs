import http from 'node:http';

const server=http.createServer(async(req,res)=>{
  const parts=[];
  for await(const part of req) parts.push(part);
  let payload={};
  try{ payload=JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'); }catch{}

  const internal=req.headers['x-izakhono-ai-key'];
  const workflow=req.headers['x-izakhono-ai-workflow-key'];
  if(req.url!=='/api/v1/chat' || req.method!=='POST'){
    res.writeHead(404,{'content-type':'application/json'}); return res.end('{"ok":false}');
  }
  if(internal!=='ci-super-ai-internal' || workflow!=='ci-super-ai-workflow'){
    res.writeHead(403,{'content-type':'application/json'}); return res.end('{"ok":false,"error":"bad_keys"}');
  }
  if(payload.product!=='izakhono-docflow' || payload.access_mode!=='workflow' || payload.entity_id!=='ci'){
    res.writeHead(422,{'content-type':'application/json'}); return res.end('{"ok":false,"error":"bad_contract"}');
  }
  const messages=Array.isArray(payload.messages)?payload.messages:[];
  if(!messages.some(x=>x?.role==='system' && String(x?.content||'').includes('human review'))){
    res.writeHead(422,{'content-type':'application/json'}); return res.end('{"ok":false,"error":"missing_guardrail"}');
  }
  const answer=[
    '# SUPER AI CONTRACT OK',
    '',
    '> HUMAN REVIEW REQUIRED — CI contract draft.',
    '',
    '## Parties',
    'IZAKHONO AFRICA (PTY) LTD and CI Counterparty.',
    '',
    '## Scope',
    '[CI validation only]'
  ].join('\n');
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:true,capability:'chat',route:'owned',answer,output:{type:'text',text:answer}}));
});
server.listen(9595,'0.0.0.0',()=>console.log('super-ai-stub ready'));
