import { promises as fs } from 'node:fs';

const errors=[],warnings=[];
const contractOnly=process.argv.includes('--contract-only');
function req(name){if(!String(process.env[name]||'').trim())errors.push(name+' is required')}
function parseMap(name){
  try{const x=JSON.parse(process.env[name]||'{}');if(!x||typeof x!=='object'||Array.isArray(x))throw new Error();return x}
  catch{errors.push(name+' must be a JSON object mapping bearer tokens to actor IDs');return{}}
}
if(!contractOnly){
  if(process.env.FINANCE_ALLOW_INSECURE_LOCAL!=='false')errors.push('FINANCE_ALLOW_INSECURE_LOCAL must be false on NODE01');
  req('FINANCE_ADMIN_TOKEN');req('FINANCE_INGEST_TOKEN');
  const makers=parseMap('FINANCE_MAKER_TOKENS_JSON'),checkers=parseMap('FINANCE_CHECKER_TOKENS_JSON');
  if(!Object.keys(makers).length)errors.push('at least one maker token is required');
  if(!Object.keys(checkers).length)errors.push('at least one checker token is required');
  const makerIds=new Set(Object.values(makers).map(String));
  for(const id of Object.values(checkers).map(String))if(makerIds.has(id))errors.push('maker and checker actor IDs must be distinct');
  let key=String(process.env.FINANCE_DATA_KEY_B64||'').trim();
  const keyFile=String(process.env.FINANCE_DATA_KEY_FILE||'').trim();
  if(!key&&keyFile){try{key=(await fs.readFile(keyFile,'utf8')).trim()}catch{errors.push('FINANCE_DATA_KEY_FILE is not readable')}}
  if(!key)errors.push('FINANCE_DATA_KEY_B64 or FINANCE_DATA_KEY_FILE is required');
  else {try{if(Buffer.from(key,'base64').length!==32)errors.push('finance data key must decode to exactly 32 bytes')}catch{errors.push('finance data key is not valid base64')}}
  if(String(process.env.FINANCE_DATA_FILE||'/data/finance-core.enc').includes('/tmp/'))warnings.push('data file should not use /tmp in production');
}
const result={ok:errors.length===0,product:'IZAKHONO FINANCE CORE',version:'0.2.0',owned_target:'NODE01',contract_only:contractOnly,errors,warnings};
console.log(JSON.stringify(result,null,2));
if(errors.length)process.exit(1);
