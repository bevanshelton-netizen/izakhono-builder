import fs from 'node:fs';

const workflow = JSON.parse(fs.readFileSync('replica-engine/workflow.json','utf8'));
const expected = ['recon','architect','design','build','backend','test','diff','entrepreneur','brand','launch','deploy'];
const actual = workflow.stages.map(s => s.id);
if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('Replica Engine stage contract mismatch');
if (workflow.rules.clean_room !== true) throw new Error('Clean-room rule must remain enabled');
if (workflow.rules.public_live_default !== false) throw new Error('Public live must default to false');
if (workflow.rules.source_of_truth !== 'izakhono-internal') throw new Error('Internal source-of-truth rule missing');
if (workflow.builder_handoff.endpoint !== '/api/build-anything') throw new Error('Builder handoff endpoint mismatch');
console.log('[PASS] IZAKHONO REPLICA ENGINE v1 contract is intact.');
