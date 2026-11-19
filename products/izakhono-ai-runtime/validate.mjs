import fs from 'node:fs';
import path from 'node:path';
const root = path.dirname(new URL(import.meta.url).pathname);
const compose = fs.readFileSync(path.join(root, 'compose.yml'), 'utf8');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
for (const value of ['ollama/ollama:latest','127.0.0.1:11434:11434','izakhono_model_data','qwen2.5-coder:3b','no-new-privileges:true']) {
  if (!compose.includes(value)) throw new Error('model-runtime-compose-missing:' + value);
}
for (const value of ['No AI-credit wallet','generationMode=local-model','Never expose the Ollama endpoint','Hosted model APIs and `approved_external` endpoints are disabled','Public HTTPS model endpoints, API-key provider fallbacks and external provider rotation are rejected','Public hostnames are rejected; no public-host allowlist exists']) {
  if (!readme.includes(value)) throw new Error('model-runtime-acceptance-contract-missing:' + value);
}
if (readme.includes('IZAKHONO_MODEL_TRUSTED_HOSTS') || readme.includes('approved_external')) throw new Error('external-model-allowlist-documentation-present');\nconsole.log(JSON.stringify({status:'passed',service:'izakhono-model',exposure:'loopback-only',model:'qwen2.5-coder:3b',credits:false}));
