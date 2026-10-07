const base = process.env.NODE01_URL || 'http://127.0.0.1:8940';
const health = await fetch(`${base}/health`);
if (!health.ok) throw new Error(`health failed: ${health.status}`);
const body = await health.json();
if (!body.ok || body.service !== 'NODE01-SW') throw new Error('invalid health response');
console.log('NODE01-SW smoke OK', body);
