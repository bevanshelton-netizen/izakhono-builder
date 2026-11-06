import assert from 'node:assert/strict';
import { jarvisRoute } from './jarvis.js';

class FakeStatement {
  constructor(private sql: string, private db: FakeDatabase) {}
  bind(..._values: unknown[]) { return this; }
  async run() { this.db.statements.push(this.sql); return { success: true }; }
  async all<T>() { this.db.statements.push(this.sql); return { results: [] as T[] }; }
  async first<T>() { this.db.statements.push(this.sql); return null as T | null; }
}
class FakeDatabase {
  statements: string[] = [];
  prepare(sql: string) { return new FakeStatement(sql, this); }
}
const env = (DB: FakeDatabase) => ({ DB });
async function call(db: FakeDatabase, path: string, method = 'GET', body?: unknown, authorized = true) {
  const req = new Request('https://jarvis.test' + path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return jarvisRoute(req, env(db) as any, new URL(req.url), async () => authorized);
}

async function main() {\n  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/executive');
    assert.equal(result?.status, 200);
    const data = await result!.json() as any;
    assert.equal(data.ok, true);
    assert.equal(data.metrics.tasks.queued, 0);
    assert.equal(data.sources.find((source: any) => source.id === 'finance').status, 'not-connected');
    assert.ok(data.limitations.some((item: string) => item.includes('not inferred')));
    assert.ok(db.statements.some(sql => sql.includes('FROM jarvis_action_proposals')));
  }

  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/agents');
    assert.equal(result?.status, 200);
    const data = await result!.json() as any;
    assert.equal(data.items.length, 5);
    assert.ok(data.items.every((agent: any) => agent.execution === 'reasoning-only'));
    assert.ok(data.items.every((agent: any) => agent.tools.length === 0));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/tasks', 'POST', {
      agent_id: 'business-analyst',
      task_type: 'analysis',
      title: 'Analyse operating performance',
      instruction: 'Use only the supplied information and identify assumptions.',
      priority: 'high',
      idempotency_key: 'test-task-001',
    });
    assert.equal(result?.status, 201);
    const data = await result!.json() as any;
    assert.equal(data.task.status, 'queued');
    assert.equal(data.task.agent_id, 'business-analyst');
    assert.ok(db.statements.some(sql => sql.includes('INSERT INTO jarvis_tasks')));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/tasks', 'POST', {
      agent_id: 'research-briefing',
      task_type: 'business_report',
      title: 'Invalid agent-task pairing',
      instruction: 'This should be rejected.',
    });
    assert.equal(result?.status, 400);
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/agents', 'GET', undefined, false);
    assert.equal(result?.status, 401);
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/actions/jact_test/execute', 'POST', {
      expected_payload_hash: 'sha256:invalid',
    }, false);
    assert.equal(result?.status, 401);
    assert.ok(!db.statements.some(sql => sql.includes('INSERT INTO jarvis_action_executions')));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/context');
    assert.equal(result?.status, 200);
    assert.ok(db.statements.some(sql => sql.includes('FROM jarvis_context_records')));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/context', 'POST', {
      scope: 'company',
      record_type: 'company_profile',
      title: 'IZAKHONO Africa',
      content: 'Manufacturing and group operations reference.',
      tags: ['company', 'manufacturing'],
    });
    assert.equal(result?.status, 201);
    const data = await result!.json() as any;
    assert.equal(data.record.scope, 'company');
    assert.ok(db.statements.some(sql => sql.includes('INSERT INTO jarvis_context_records')));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/context', 'POST', {
      scope: 'project',
      record_type: 'project_brief',
      title: 'KORA Network',
      content: 'Project reference without project identifier.',
    });
    assert.equal(result?.status, 400);
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/tasks', 'POST', {
      agent_id: 'business-analyst',
      task_type: 'analysis',
      title: 'Cross-owner context must be rejected',
      instruction: 'Do not accept unowned context.',
      context_ids: ['jctx_not_owned'],
    });
    assert.equal(result?.status, 400);
    assert.ok(!db.statements.some(sql => sql.includes('INSERT INTO jarvis_tasks')));
  }
  {
    const db = new FakeDatabase();
    const result = await call(db, '/api/jarvis/v1/context', 'POST', {
      scope: 'company',
      record_type: 'company_profile',
      title: 'Unauthorised write',
      content: 'Must not be persisted.',
    }, false);
    assert.equal(result?.status, 401);
    assert.ok(!db.statements.some(sql => sql.includes('INSERT INTO jarvis_context_records')));
  }
  console.log('JARVIS context, orchestration and action-boundary contract tests passed.');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
