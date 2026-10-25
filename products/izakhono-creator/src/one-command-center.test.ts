import { handleOneCommandCenter } from './one-command-center';

const response = await handleOneCommandCenter(new Request('https://example.test/api/one/command-center'), {
  DB: {
    prepare() { return { bind() { return { all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }; } }; },
    batch: async () => ({}),
  },
} as any);
const body = await response.json() as any;
if (response.status !== 200 || body.schema !== 'izakhono.one/command-center-v1' || body.publicLive !== false || !Array.isArray(body.projects)) throw new Error('Command Center contract failed');
console.log('IZAKHONO ONE Command Center: PASS');
