import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const data=process.env.FINANCE_DATA_FILE||'/data/finance-core.enc';
const outDir=process.argv[2]||process.env.FINANCE_BACKUP_DIR||'/data/backups';
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const blob=await fs.readFile(data);
const hash=crypto.createHash('sha256').update(blob).digest('hex');
await fs.mkdir(outDir,{recursive:true,mode:0o700});
const backup=path.join(outDir,'finance-core-'+stamp+'.enc');
const manifest=backup+'.manifest.json';
await fs.writeFile(backup,blob,{mode:0o600,flag:'wx'});
await fs.writeFile(manifest,JSON.stringify({schema:'izakhono.finance-core.backup.v1',created_at:new Date().toISOString(),source:data,file:path.basename(backup),bytes:blob.length,sha256:hash,encrypted:true},null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({ok:true,backup,manifest,sha256:hash,bytes:blob.length},null,2));
