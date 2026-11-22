import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import postgres from 'postgres';

const adminUrl = process.env.OWNED_WORKER_TEST_ADMIN_URL || '';
const workerUrl = process.env.OWNED_WORKER_TEST_WORKER_URL || '';
const workerRole = 'owned_worker_gateway_ci';
const gatewayRole = 'owned_worker_gateway';
const contextSecret = Buffer.from(process.env.OWNED_WORKER_TEST_CONTEXT_SECRET || '', 'base64url');
const tenantSignature = tenantId => createHmac('sha256', contextSecret).update(String(tenantId)).digest('hex');

test('PostgreSQL enforces owned-worker tenant isolation and least-privilege grants', {
  skip: !adminUrl || !workerUrl ? 'Disposable PostgreSQL URLs are not configured' : false
}, async () => {
  const admin = postgres(adminUrl, { max: 1, prepare: false });
  const worker = postgres(workerUrl, { max: 2, prepare: false });
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const jobA = randomUUID();
  const jobB = randomUUID();
  const workerKey = 'ci-worker-' + randomUUID();
  const token = randomUUID() + randomUUID();
  const tokenHash = createHash('sha256').update(token).digest('hex');

  try {
    assert.ok(contextSecret.length >= 32, 'test tenant-context secret must be configured');
    await admin`insert into public.owned_worker_context_secret (singleton, secret)
      values (true, ${contextSecret})
      on conflict (singleton) do update set secret = excluded.secret, updated_at = now()`;
    await admin`
      insert into public.owned_worker_jobs
        (id, tenant_id, idempotency_key, worker_key, job_type, payload)
      values
        (${jobA}, ${tenantA}, ${'a-' + jobA}, ${workerKey}, 'ci_probe', '{}'::jsonb),
        (${jobB}, ${tenantB}, ${'b-' + jobB}, ${workerKey}, 'ci_probe', '{}'::jsonb)
    `;
    await admin`
      insert into public.owned_worker_credentials
        (tenant_id, worker_key, token_hash, capabilities)
      values
        (${tenantA}, ${workerKey}, ${tokenHash},
         array['job:claim','job:heartbeat','job:complete','job:fail'])
    `;

    const roleState = await admin`
      select r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls
      from pg_catalog.pg_roles r
      where r.rolname in (${gatewayRole}, ${workerRole})
      order by r.rolname
    `;
    assert.equal(roleState.length, 2, 'both the NOLOGIN group and CI login must exist');
    const group = roleState.find(row => row.rolname === gatewayRole);
    const login = roleState.find(row => row.rolname === workerRole);
    assert.equal(group.rolcanlogin, false, 'gateway group must not be directly login-capable');
    assert.equal(group.rolsuper, false);
    assert.equal(group.rolbypassrls, false);
    assert.equal(login.rolsuper, false, 'worker login must not be a superuser');
    assert.equal(login.rolbypassrls, false, 'worker login must not bypass RLS');
    const membership = await admin`select pg_has_role(${workerRole}, ${gatewayRole}, 'member') as member`;
    assert.equal(membership[0].member, true, 'CI login must inherit only through the gateway role');

    const privileges = await admin`
      select
        has_table_privilege(${workerRole}, 'public.owned_worker_credentials', 'SELECT') as credentials_select,
        has_table_privilege(${workerRole}, 'public.owned_worker_credentials', 'UPDATE') as credentials_update,
        has_table_privilege(${workerRole}, 'public.owned_worker_jobs', 'SELECT') as jobs_select,
        has_table_privilege(${workerRole}, 'public.owned_worker_jobs', 'INSERT') as jobs_insert,
        has_table_privilege(${workerRole}, 'public.owned_worker_jobs', 'UPDATE') as jobs_update,
        has_table_privilege(${workerRole}, 'public.owned_worker_jobs', 'DELETE') as jobs_delete,
        has_table_privilege(${workerRole}, 'public.owned_worker_events', 'SELECT') as events_select,
        has_table_privilege(${workerRole}, 'public.owned_worker_events', 'INSERT') as events_insert,
        has_table_privilege(${workerRole}, 'public.owned_worker_events', 'UPDATE') as events_update,
        has_table_privilege(${workerRole}, 'public.owned_worker_events', 'DELETE') as events_delete,
        has_function_privilege(${workerRole}, 'public.authenticate_owned_worker(text)', 'EXECUTE') as authenticate_execute,
        has_function_privilege(${workerRole}, 'public.touch_owned_worker_credential(text)', 'EXECUTE') as touch_execute,
        has_function_privilege(${workerRole}, 'public.set_owned_worker_tenant_context(uuid,text)', 'EXECUTE') as set_context_execute,
        has_table_privilege(${workerRole}, 'public.owned_worker_context_secret', 'SELECT') as context_secret_select
    `;
    const p = privileges[0];
    assert.equal(p.credentials_select, false, 'credentials must not be directly readable');
    assert.equal(p.credentials_update, false, 'credentials must not be directly mutable');
    assert.equal(p.jobs_select, true);
    assert.equal(p.jobs_insert, true);
    assert.equal(p.jobs_update, true);
    assert.equal(p.jobs_delete, false, 'worker must not delete jobs');
    assert.equal(p.events_select, true);
    assert.equal(p.events_insert, true);
    assert.equal(p.events_update, false, 'events must be append-only to the worker role');
    assert.equal(p.events_delete, false, 'events must not be deletable by the worker role');
    assert.equal(p.authenticate_execute, true);
    assert.equal(p.touch_execute, true);
    assert.equal(p.set_context_execute, true);
    assert.equal(p.context_secret_select, false, 'runtime login must not read the context-signing secret');

    await assert.rejects(
      worker`select * from public.owned_worker_credentials`,
      error => error.code === '42501'
    );

    const authRows = await worker`select * from public.authenticate_owned_worker(${tokenHash})`;
    assert.equal(authRows.length, 1, 'narrow authentication function should resolve a valid credential');
    assert.equal(authRows[0].tenant_id, tenantA);
    assert.equal(authRows[0].worker_key, workerKey);
    const touched = await worker`select public.touch_owned_worker_credential(${tokenHash}) as ok`;
    assert.equal(touched[0].ok, true, 'narrow touch function should update a valid credential');

    const unscoped = await worker`select id from public.owned_worker_jobs`;
    assert.deepEqual(unscoped.map(row => row.id), [], 'missing tenant context must reveal no jobs');

    await worker.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantA}, ${tenantSignature(tenantA)})`;
      const visible = await tx`select id from public.owned_worker_jobs order by id`;
      assert.deepEqual(visible.map(row => row.id), [jobA], 'tenant A must not see tenant B jobs');

      const updated = await tx`
        update public.owned_worker_jobs set error_code = 'ci-tenant-a'
        where id = ${jobB}
        returning id
      `;
      assert.equal(updated.length, 0, 'tenant A must not update tenant B jobs');

      await tx`
        insert into public.owned_worker_events
          (tenant_id, job_id, worker_key, event_type, detail)
        values (${tenantA}, ${jobA}, ${workerKey}, 'ci_probe', '{}'::jsonb)
      `;
      const events = await tx`select job_id from public.owned_worker_events`;
      assert.deepEqual(events.map(row => row.job_id), [jobA], 'tenant A must read only its own events');
    });

    await assert.rejects(
      worker.begin(async tx => {
        await tx`select set_config('app.tenant_id', ${tenantA}, true)`;
        await tx`
          insert into public.owned_worker_jobs
            (tenant_id, idempotency_key, worker_key, job_type)
          values (${tenantB}, ${'cross-' + randomUUID()}, ${workerKey}, 'forbidden')
        `;
      }),
      error => error.code === '42501'
    );

    await assert.rejects(
      worker.begin(async tx => {
        await tx`select set_config('app.tenant_id', ${tenantA}, true)`;
        await tx`
          insert into public.owned_worker_events
            (tenant_id, job_id, worker_key, event_type)
          values (${tenantA}, ${jobB}, ${workerKey}, 'cross_tenant_reference')
        `;
      }),
      error => error.code === '23503'
    );

    await assert.rejects(
      worker.begin(async tx => {
        await tx`select set_config('app.tenant_id', ${tenantA}, true)`;
        await tx`delete from public.owned_worker_jobs where id = ${jobA}`;
      }),
      error => error.code === '42501'
    );
    await assert.rejects(
      worker.begin(async tx => {
        await tx`select set_config('app.tenant_id', ${tenantA}, true)`;
        await tx`update public.owned_worker_events set event_type = 'tampered' where job_id = ${jobA}`;
      }),
      error => error.code === '42501'
    );
  } finally {
    await worker.end({ timeout: 5 });
    await admin`delete from public.owned_worker_events where tenant_id in (${tenantA}, ${tenantB})`;
    await admin`delete from public.owned_worker_credentials where tenant_id in (${tenantA}, ${tenantB})`;
    await admin`delete from public.owned_worker_jobs where tenant_id in (${tenantA}, ${tenantB})`;
    await admin.end({ timeout: 5 });
  }
});
