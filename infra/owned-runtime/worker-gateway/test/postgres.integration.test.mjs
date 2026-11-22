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

    const exposedFunctionGrants = await admin`
      select role_name, function_name,
        has_function_privilege(role_name, function_name, 'EXECUTE') as can_execute
      from (values
        ('anon', 'public.owned_worker_current_tenant_id()'),
        ('authenticated', 'public.owned_worker_current_tenant_id()'),
        ('service_role', 'public.owned_worker_current_tenant_id()'),
        ('anon', 'public.set_owned_worker_tenant_context(uuid,text)'),
        ('authenticated', 'public.set_owned_worker_tenant_context(uuid,text)'),
        ('service_role', 'public.set_owned_worker_tenant_context(uuid,text)'),
        ('anon', 'public.authenticate_owned_worker(text)'),
        ('authenticated', 'public.authenticate_owned_worker(text)'),
        ('service_role', 'public.authenticate_owned_worker(text)'),
        ('anon', 'public.touch_owned_worker_credential(text)'),
        ('authenticated', 'public.touch_owned_worker_credential(text)'),
        ('service_role', 'public.touch_owned_worker_credential(text)')
      ) as grants(role_name, function_name)
    `;
    assert.ok(exposedFunctionGrants.every(row => row.can_execute === false),
      'Supabase API roles must not execute gateway SECURITY DEFINER functions');

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

    // Arbitrary GUC writes cannot forge a signature for tenant B.
    await worker.begin(async tx => {
      await tx`select set_config('app.tenant_id', ${tenantB}, true)`;
      await tx`select set_config('app.tenant_signature', ${tenantSignature(tenantA)}, true)`;
      const forged = await tx`select id from public.owned_worker_jobs`;
      assert.deepEqual(forged.map(row => row.id), [], 'forged tenant context must fail closed');
      const forgedEvents = await tx`select job_id from public.owned_worker_events`;
      assert.equal(forgedEvents.length, 0, 'forged tenant context must not expose events');
    });
    await assert.rejects(
      worker`select public.set_owned_worker_tenant_context(${tenantB}, ${tenantSignature(tenantA)})`,
      error => error.code === '42501'
    );

    await assert.rejects(
      worker.begin(async tx => {
        await tx`select public.set_owned_worker_tenant_context(${tenantA}, ${tenantSignature(tenantA)})`;
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
        await tx`select public.set_owned_worker_tenant_context(${tenantA}, ${tenantSignature(tenantA)})`;
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
        await tx`select public.set_owned_worker_tenant_context(${tenantA}, ${tenantSignature(tenantA)})`;
        await tx`delete from public.owned_worker_jobs where id = ${jobA}`;
      }),
      error => error.code === '42501'
    );
    await assert.rejects(
      worker.begin(async tx => {
        await tx`select public.set_owned_worker_tenant_context(${tenantA}, ${tenantSignature(tenantA)})`;
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


test('PostgreSQL enforces competing claims, lease recovery, renewal, completion and bounded retries', {
  skip: !adminUrl || !workerUrl ? 'Disposable PostgreSQL URLs are not configured' : false
}, async () => {
  const admin = postgres(adminUrl, { max: 1, prepare: false });
  const workerA = postgres(workerUrl, { max: 1, prepare: false });
  const workerB = postgres(workerUrl, { max: 1, prepare: false });
  const tenantId = randomUUID();
  const workerKey = 'ci-lifecycle-' + randomUUID();
  const claimJobId = randomUUID();
  const retryJobId = randomUUID();
  const tokenA = createHash('sha256').update(randomUUID()).digest('hex');
  const tokenB = createHash('sha256').update(randomUUID()).digest('hex');

  const claim = async (client, leaseHash) => client.begin(async tx => {
    await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
    const rows = await tx`
      with candidate as (
        select id, status as previous_status
        from public.owned_worker_jobs
        where tenant_id = ${tenantId} and worker_key = ${workerKey}
          and ((status = 'queued' and not_before <= now())
            or (status = 'running' and lease_expires_at <= now()))
          and attempts < max_attempts
        order by priority desc, created_at asc
        for update skip locked
        limit 1
      )
      update public.owned_worker_jobs j
      set status = 'running', attempts = j.attempts + 1,
          lease_owner = ${workerKey}, lease_token_hash = ${leaseHash},
          lease_expires_at = now() + interval '60 seconds', updated_at = now()
      from candidate c
      where j.id = c.id and j.tenant_id = ${tenantId}
      returning j.id, j.attempts, j.max_attempts, c.previous_status
    `;
    if (rows[0]) {
      await tx`insert into public.owned_worker_events
        (tenant_id, job_id, worker_key, event_type, detail)
        values (${tenantId}, ${rows[0].id}, ${workerKey},
          ${rows[0].previous_status === 'running' ? 'lease_reclaimed' : 'claimed'},
          ${JSON.stringify({ attempt: rows[0].attempts })}::jsonb)`;
    }
    return rows[0] || null;
  });

  try {
    assert.ok(contextSecret.length >= 32, 'test tenant-context secret must be configured');
    await admin`insert into public.owned_worker_context_secret (singleton, secret)
      values (true, ${contextSecret})
      on conflict (singleton) do update set secret = excluded.secret, updated_at = now()`;
    await admin`
      insert into public.owned_worker_jobs
        (id, tenant_id, idempotency_key, worker_key, job_type, max_attempts)
      values
        (${claimJobId}, ${tenantId}, ${'claim-' + claimJobId}, ${workerKey}, 'ci_lifecycle', 3),
        (${retryJobId}, ${tenantId}, ${'retry-' + retryJobId}, ${workerKey}, 'ci_retry', 2)
    `;

    // Independent PostgreSQL sessions race for the same first job.
    const firstLeaseHash = createHash('sha256').update(tokenA).digest('hex');
    const secondLeaseHash = createHash('sha256').update(tokenB).digest('hex');
    const competing = await Promise.all([
      claim(workerA, firstLeaseHash),
      claim(workerB, secondLeaseHash)
    ]);
    const winners = competing.filter(Boolean);
    assert.equal(winners.length, 1, 'exactly one independent claimer may acquire the job');
    assert.equal(winners[0].id, claimJobId);
    assert.equal(Number(winners[0].attempts), 1);

    const winningClient = competing[0] ? workerA : workerB;
    const winningLeaseHash = competing[0] ? firstLeaseHash : secondLeaseHash;
    const renewed = await winningClient.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
      return tx`update public.owned_worker_jobs
        set lease_expires_at = now() + interval '60 seconds', updated_at = now()
        where id = ${claimJobId} and tenant_id = ${tenantId}
          and worker_key = ${workerKey} and status = 'running'
          and lease_token_hash = ${winningLeaseHash} and lease_expires_at > now()
        returning id`;
    });
    assert.equal(renewed.length, 1, 'the current lease holder can renew its live lease');

    await admin`update public.owned_worker_jobs
      set lease_expires_at = now() - interval '1 second' where id = ${claimJobId}`;
    const staleRenewal = await winningClient.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
      return tx`update public.owned_worker_jobs
        set lease_expires_at = now() + interval '60 seconds'
        where id = ${claimJobId} and tenant_id = ${tenantId}
          and status = 'running' and lease_token_hash = ${winningLeaseHash}
          and lease_expires_at > now() returning id`;
    });
    assert.equal(staleRenewal.length, 0, 'an expired lease cannot be renewed');

    const reclaimedToken = createHash('sha256').update(randomUUID()).digest('hex');
    const reclaimed = await claim(winningClient, reclaimedToken);
    assert.equal(reclaimed.id, claimJobId, 'an expired lease can be reclaimed');
    assert.equal(Number(reclaimed.attempts), 2, 'reclaim increments the attempt count');

    const completed = await winningClient.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
      const rows = await tx`update public.owned_worker_jobs
        set status = 'completed', result = '{"verified":true}'::jsonb,
            completed_at = now(), updated_at = now(),
            lease_owner = null, lease_token_hash = null, lease_expires_at = null
        where id = ${claimJobId} and tenant_id = ${tenantId}
          and worker_key = ${workerKey} and status = 'running'
          and lease_token_hash = ${reclaimedToken} and lease_expires_at > now()
        returning id`;
      if (rows[0]) await tx`insert into public.owned_worker_events
        (tenant_id, job_id, worker_key, event_type, detail)
        values (${tenantId}, ${claimJobId}, ${workerKey}, 'completed', '{"result_recorded":true}'::jsonb)`;
      return rows;
    });
    assert.equal(completed.length, 1, 'the current live lease can complete the job');

    // Exercise retry scheduling and terminal failure at the configured attempt limit.
    const retryFirstToken = randomUUID() + randomUUID();
    const retryFirstHash = createHash('sha256').update(retryFirstToken).digest('hex');
    const retryFirst = await claim(workerA, retryFirstHash);
    assert.equal(retryFirst.id, retryJobId);
    assert.equal(Number(retryFirst.attempts), 1);
    const scheduled = await workerA.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
      const rows = await tx`update public.owned_worker_jobs
        set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
            not_before = case when attempts >= max_attempts then not_before
              else now() + (least(30, greatest(1, attempts * 5)) * interval '1 minute') end,
            error_code = 'ci_retryable', error_message = 'retry test',
            updated_at = now(), lease_owner = null, lease_token_hash = null, lease_expires_at = null
        where id = ${retryJobId} and tenant_id = ${tenantId}
          and worker_key = ${workerKey} and status = 'running'
          and lease_token_hash = ${retryFirstHash} and lease_expires_at > now()
        returning status`;
      if (rows[0]) await tx`insert into public.owned_worker_events
        (tenant_id, job_id, worker_key, event_type, detail)
        values (${tenantId}, ${retryJobId}, ${workerKey}, 'retry_scheduled', '{"attempt":1}'::jsonb)`;
      return rows;
    });
    assert.equal(scheduled[0].status, 'queued', 'first failure schedules a retry');
    await admin`update public.owned_worker_jobs set not_before = now()
      where id = ${retryJobId} and tenant_id = ${tenantId}`;

    const retrySecondToken = randomUUID() + randomUUID();
    const retrySecondHash = createHash('sha256').update(retrySecondToken).digest('hex');
    const retrySecond = await claim(workerB, retrySecondHash);
    assert.equal(retrySecond.id, retryJobId);
    assert.equal(Number(retrySecond.attempts), 2);
    const terminal = await workerB.begin(async tx => {
      await tx`select public.set_owned_worker_tenant_context(${tenantId}, ${tenantSignature(tenantId)})`;
      const rows = await tx`update public.owned_worker_jobs
        set status = case when attempts >= max_attempts then 'failed' else 'queued' end,
            error_code = 'ci_terminal', error_message = 'terminal retry test',
            updated_at = now(), lease_owner = null, lease_token_hash = null, lease_expires_at = null
        where id = ${retryJobId} and tenant_id = ${tenantId}
          and worker_key = ${workerKey} and status = 'running'
          and lease_token_hash = ${retrySecondHash} and lease_expires_at > now()
        returning status`;
      if (rows[0]) await tx`insert into public.owned_worker_events
        (tenant_id, job_id, worker_key, event_type, detail)
        values (${tenantId}, ${retryJobId}, ${workerKey}, 'failed', '{"attempt":2}'::jsonb)`;
      return rows;
    });
    assert.equal(terminal[0].status, 'failed', 'failure at max_attempts is terminal');
    const retryState = await admin`select status, attempts, max_attempts from public.owned_worker_jobs where id = ${retryJobId}`;
    assert.equal(retryState[0].status, 'failed');
    assert.equal(Number(retryState[0].attempts), 2);
    const retryEvents = await admin`select event_type from public.owned_worker_events
      where tenant_id = ${tenantId} and job_id = ${retryJobId} order by id`;
    assert.ok(retryEvents.some(row => row.event_type === 'retry_scheduled'));
    assert.ok(retryEvents.some(row => row.event_type === 'failed'));

    const events = await admin`select event_type from public.owned_worker_events
      where tenant_id = ${tenantId} and job_id = ${claimJobId} order by id`;
    assert.ok(events.some(row => row.event_type === 'claimed'));
    assert.ok(events.some(row => row.event_type === 'lease_reclaimed'));
    assert.ok(events.some(row => row.event_type === 'completed'));
  } finally {
    await workerA.end({ timeout: 5 });
    await workerB.end({ timeout: 5 });
    await admin`delete from public.owned_worker_events where tenant_id = ${tenantId}`;
    await admin`delete from public.owned_worker_jobs where tenant_id = ${tenantId}`;
    await admin.end({ timeout: 5 });
  }
});
