import { node01DeploymentEvidenceRoute } from '../src/node01-deployment-agent';

const source = node01DeploymentEvidenceRoute.toString();
if (!source.includes('izakhono.deployment-evidence/v2')) throw new Error('deployment evidence schema missing');
if (!source.includes('revision !== candidate.revision')) throw new Error('exact revision gate missing');
if (!source.includes('internalHead !== candidate.internal_repository_head')) throw new Error('internal repository head gate missing');
if (!source.includes("httpStatus !== 200")) throw new Error('HTTPS 200 gate missing');
if (!source.includes('tlsVerified') || !source.includes('dnsVerified')) throw new Error('TLS/DNS gates missing');
if (!source.includes('rollbackVerified')) throw new Error('rollback gate missing');
if (!source.includes("stage='deployed'")) throw new Error('deployment promotion missing');
if (!source.includes('public_live: true')) throw new Error('public-live promotion missing');
console.log('NODE01 deployment evidence contract passed');
