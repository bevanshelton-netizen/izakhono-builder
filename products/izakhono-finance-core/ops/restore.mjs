import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

if(process.env.FINANCE_RESTORE_APPROVED!=='YES'){
  console.error('Restore blocked: set FINANCE_RESTORE_APPROVED=YES for an explicitly authorised restore.');
  process.exit(2);
}
const manifestPath=process.argv[2];
if(!manifestPath){console.error('Usage: node restore.mjs <backup.manifest.json>');process.exit(2)}
const data=process.env.FINANCE_DATA_FILE||'/data/finance-core.enc';
const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
if(manifest.schema!=='izakhono.finance-core.backup.v1')throw new Error('unsupported backup manifest');
const backup=path.join(path.dirname(manifestPath),manifest.file);
const blob=await fs.readFile(backup);
const hash=crypto.createHash('sha256').update(blob).digest('hex');
if(hash!==manifest.sha256)throw new Error('backup checksum mismatch');
await fs.mkdir(path.dirname(data),{recursive:true,mode:0o700});
try{
  const current=await fs.readFile(data);
  const safety=data+'.pre-restore-'+new Date().toISOString().replace(/[:.]/g,'-');
  await fs.writeFile(safety,current,{mode:0o600,flag:'wx'});
  console.log('SAFETY_COPY='+safety);
}catch(e){if(e.code!=='ENOENT')throw e}
const tmp=data+'.restore-'+process.pid+'.tmp';
await fs.writeFile(tmp,blob,{mode:0o600});
await fs.rename(tmp,data);
console.log(JSON.stringify({ok:true,restored:data,sha256:hash,bytes:blob.length},null,2));
