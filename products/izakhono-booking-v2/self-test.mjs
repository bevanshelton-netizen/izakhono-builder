const base='http://localhost:8787';
const tests=[['health','/api/health'],['services','/api/services?businessId=demo'],['availability','/api/availability?serviceId=demo&from=2026-10-20T09:00:00Z&to=2026-10-20T10:00:00Z']];
for(const [name,path] of tests){const r=await fetch(base+path);if(!r.ok)throw new Error(`${name}: HTTP ${r.status}`);console.log(`PASS ${name}`)}
console.log('IZAKHONO BOOKING v2 smoke checks passed');
