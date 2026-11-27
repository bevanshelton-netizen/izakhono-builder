import { planTopicPdfGeneration, type ResearchSource, type TopicPdfRequest } from '../products/topic-pdfs/src/generation-core';

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface TopicPdfWorkerEnv {
  DB: { prepare(sql: string): D1Statement };
  TOPIC_PDF_PIPELINE_ENABLED?: string;
  TOPIC_PDF_RESEARCH_URL?: string;
  TOPIC_PDF_RESEARCH_KEY?: string;
  IZAKHONO_SUPER_AI_URL?: string;
  IZAKHONO_SUPER_AI_INTERNAL_KEY?: string;
  IZAKHONO_SUPER_AI_WORKFLOW_KEY?: string;
  TOPIC_PDF_RENDER_URL?: string;
  TOPIC_PDF_RENDER_KEY?: string;
  TOPIC_PDF_BUCKET?: { put(key: string, value: ArrayBuffer | Uint8Array, options?: Record<string, unknown>): Promise<unknown> };
}

type ClaimedJob = {
  id: string;
  request_json: string;
  plan_json: string;
  attempt_count: number;
};

function safeObject(value: unknown): Record<string, any> | null {
  if (typeof value === 'string') {
    const raw = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { const parsed = JSON.parse(raw); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null; } catch { return null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
}

async function responseObject(response: Response): Promise<Record<string, any>> {
  const raw = await response.text();
  if (raw.length > 250_000) throw new Error('Provider response exceeded the 250 KB limit.');
  const parsed = safeObject(raw);
  if (!parsed) throw new Error('Provider returned invalid JSON.');
  if (!response.ok) throw new Error('Provider returned HTTP ' + response.status + '.');
  return parsed;
}

function extractStructured(data: Record<string, any>): Record<string, any> | null {
  return safeObject(data.output?.text || data.answer || data.result || data);
}

function normalizeSources(value: unknown): ResearchSource[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 30) {
    throw new Error('Research adapter must return between 2 and 30 evidence sources.');
  }
  const accessedAt = new Date().toISOString().slice(0, 10);
  return value.map((item: any, index: number) => {
    const url = String(item?.url || '').trim();
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Research source ' + (index + 1) + ' has an invalid URL.'); }
    if (parsed.protocol !== 'https:') throw new Error('Research sources must use HTTPS.');
    const supports = Array.isArray(item?.supports)
      ? item.supports.map((entry: unknown) => String(entry).trim().slice(0, 300)).filter(Boolean).slice(0, 12)
      : [];
    if (!item?.title || !item?.publisher || !supports.length) {
      throw new Error('Research source ' + (index + 1) + ' is missing title, publisher or supported claims.');
    }
    return {
      title: String(item.title).slice(0, 240),
      publisher: String(item.publisher).slice(0, 160),
      url: parsed.toString(),
      publishedAt: item.publishedAt ? String(item.publishedAt).slice(0, 40) : undefined,
      accessedAt,
      supports,
      rightsNote: 'Source metadata recorded for verification. Facts may be paraphrased; no third-party text or images are licensed by this record.',
    };
  });
}

function validateDraft(value: Record<string, any>, request: TopicPdfRequest, sources: ResearchSource[]) {
  const sections = Array.isArray(value.sections) ? value.sections : [];
  if (sections.length < 5 || sections.length > 40) throw new Error('Generated guide must contain between 5 and 40 developed sections.');
  const normalized = sections.map((section: any) => ({
    heading: String(section?.heading || '').trim().slice(0, 180),
    body: String(section?.body || '').trim().slice(0, 18_000),
  }));
  if (normalized.some(section => section.heading.length < 3 || section.body.length < 350)) {
    throw new Error('Every generated section must contain a heading and at least 350 characters of developed prose.');
  }
  const totalWords = normalized.reduce((sum, section) => sum + section.body.split(/\s+/).filter(Boolean).length, 0);
  if (totalWords < 1800) throw new Error('Generated guide is too short: minimum 1,800 words across developed sections.');
  return {
    title: String(value.title || request.topic).trim().slice(0, 180),
    subtitle: String(value.subtitle || request.readerOutcome).trim().slice(0, 260),
    author: 'Bevan Shelton',
    language: request.language,
    geography: request.countryOrJurisdiction || 'International / jurisdiction-neutral',
    version: '0.1-editorial-draft',
    sections: normalized,
    sources,
    editorialNotes: Array.isArray(value.editorialNotes)
      ? value.editorialNotes.map((note: unknown) => String(note).slice(0, 500)).slice(0, 20)
      : [],
    rightsReviewed: false,
    factualReviewPassed: false,
    specialistReviewPassed: false,
    editorialApproval: false,
    saleEligible: false,
  };
}

async function providerJson(url: string, headers: Record<string, string>, body: unknown): Promise<Record<string, any>> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  return responseObject(response);
}

async function appendEvent(env: TopicPdfWorkerEnv, jobId: string, eventType: string, detail: unknown) {
  await env.DB.prepare(
    'INSERT INTO topic_pdf_generation_events(id,job_id,event_type,actor,detail_json,created_at) VALUES(?,?,?,?,?,?)',
  ).bind(
    'tpdfe_' + crypto.randomUUID().replaceAll('-', ''),
    jobId,
    eventType,
    'system:topic-pdf-worker',
    JSON.stringify(detail),
    new Date().toISOString(),
  ).run();
}

async function claimOne(env: TopicPdfWorkerEnv): Promise<ClaimedJob | null> {
  const now = new Date();
  const lease = new Date(now.getTime() + 5 * 60_000).toISOString();
  return env.DB.prepare(
    `UPDATE topic_pdf_generation_jobs
     SET status='scoping', lease_until=?, attempt_count=attempt_count+1, updated_at=?
     WHERE id=(
       SELECT id FROM topic_pdf_generation_jobs
       WHERE status IN ('requested','scoping','research_required','drafting')
         AND (next_attempt_at IS NULL OR next_attempt_at<=?)
         AND (lease_until IS NULL OR lease_until<?)
       ORDER BY created_at ASC LIMIT 1
     )
     AND status IN ('requested','scoping','research_required','drafting')
     RETURNING id,request_json,plan_json,attempt_count`,
  ).bind(lease, now.toISOString(), now.toISOString(), now.toISOString()).first<ClaimedJob>();
}

/**
 * One job per cron tick. All expensive integrations are explicitly configured
 * and the pipeline remains inert unless TOPIC_PDF_PIPELINE_ENABLED=true.
 */
export async function processOneTopicPdfJob(env: TopicPdfWorkerEnv): Promise<{ processed: boolean; jobId?: string; status?: string; reason?: string }> {
  if (env.TOPIC_PDF_PIPELINE_ENABLED !== 'true') return { processed: false, reason: 'pipeline-disabled' };
  if (!env.TOPIC_PDF_RESEARCH_URL || !env.TOPIC_PDF_RESEARCH_KEY ||
      !env.IZAKHONO_SUPER_AI_URL || !env.IZAKHONO_SUPER_AI_INTERNAL_KEY || !env.IZAKHONO_SUPER_AI_WORKFLOW_KEY) {
    return { processed: false, reason: 'research-or-ai-provider-not-configured' };
  }

  const job = await claimOne(env);
  if (!job) return { processed: false, reason: 'queue-empty' };
  try {
    const request = JSON.parse(job.request_json) as TopicPdfRequest;
    const plan = planTopicPdfGeneration(request);
    if (plan.status === 'blocked') {
      await env.DB.prepare("UPDATE topic_pdf_generation_jobs SET status='blocked',lease_until=NULL,updated_at=? WHERE id=?")
        .bind(new Date().toISOString(), job.id).run();
      await appendEvent(env, job.id, 'request.blocked', { reason: 'restricted-topic-recheck' });
      return { processed: true, jobId: job.id, status: 'blocked' };
    }

    await env.DB.prepare("UPDATE topic_pdf_generation_jobs SET status='research_required',updated_at=? WHERE id=?")
      .bind(new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, 'research.started', { topic: request.topic });

    const research = await providerJson(env.TOPIC_PDF_RESEARCH_URL, {
      authorization: 'Bearer ' + env.TOPIC_PDF_RESEARCH_KEY,
      'x-izakhono-workflow': 'topic-pdf-research-v1',
    }, {
      task: 'research_topic_pdf',
      topic: request.topic,
      readerOutcome: request.readerOutcome,
      audience: request.audience,
      language: request.language,
      jurisdiction: request.countryOrJurisdiction || 'International',
      requirements: [
        'Return 2-30 current, authoritative HTTPS sources, prioritising official primary sources and original research.',
        'Do not fabricate sources, URLs, dates, publishers or claims.',
        'For every source return title, publisher, URL, publication/update date if known, and specific claims it supports.',
        'Flag jurisdiction limits, contradictory evidence, uncertainty and stale material.',
        'Return JSON with sources array and researchLimitations array.',
      ],
    });
    const researchData = extractStructured(research);
    if (!researchData) throw new Error('Research adapter response did not contain a JSON evidence object.');
    const sources = normalizeSources(researchData.sources);
    const researchRecord = {
      sources,
      limitations: Array.isArray(researchData.researchLimitations)
        ? researchData.researchLimitations.map((item: unknown) => String(item).slice(0, 700)).slice(0, 30)
        : [],
      collectedAt: new Date().toISOString(),
      provider: 'configured-IZAKHONO-research-adapter',
    };
    await env.DB.prepare('UPDATE topic_pdf_generation_jobs SET research_json=?,status=\'drafting\',updated_at=? WHERE id=?')
      .bind(JSON.stringify(researchRecord), new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, 'research.completed', { sourceCount: sources.length, limitationCount: researchRecord.limitations.length });

    const instruction = [
      'You are the editorial drafting engine for the IZAKHONO $7 Topic PDF Publishing Programme.',
      'Create a substantial, original, practical guide, not a thin summary or a list of slogans.',
      'Return ONLY strict JSON with keys: title, subtitle, sections (array of heading/body), editorialNotes (array).',
      'Produce 5-20 sections and at least 1,800 words total. Each section body must be developed explanatory prose with examples and actionable steps.',
      'Use only evidence supported by the supplied source ledger. Do not invent facts, citations, statistics, experts or quotations.',
      'Cite source identifiers in prose as [S1], [S2], etc. Do not claim specialist, factual, rights or editorial approval.',
      'Respect jurisdiction and language. If evidence is insufficient, explain the limitation and flag it in editorialNotes.',
      'The named author is Bevan Shelton. This output is an unapproved editorial draft, never a saleable publication.',
      'Reader brief: ' + JSON.stringify(request),
      'Editorial plan: ' + JSON.stringify(plan),
      'Verified source candidates: ' + JSON.stringify(sources),
      'Research limitations: ' + JSON.stringify(researchRecord.limitations),
    ].join('\n\n');
    const aiUrl = env.IZAKHONO_SUPER_AI_URL.replace(/\/+$/, '') + '/api/v1/generate';
    const generated = await providerJson(aiUrl, {
      'x-izakhono-ai-key': env.IZAKHONO_SUPER_AI_INTERNAL_KEY,
      'x-izakhono-ai-workflow-key': env.IZAKHONO_SUPER_AI_WORKFLOW_KEY,
    }, {
      entity_id: 'izakhono-africa',
      product: 'izakhono-builder',
      access_mode: 'workflow',
      capability: 'reasoning',
      messages: [
        { role: 'system', content: 'Return strict JSON only. Follow the editorial constraints exactly. Never claim human review.' },
        { role: 'user', content: instruction },
      ],
    });
    const draftData = extractStructured(generated);
    if (!draftData) throw new Error('IZAKHONO SUPER AI did not return a structured manuscript.');
    const manuscript = validateDraft(draftData, request, sources);
    await env.DB.prepare(
      "UPDATE topic_pdf_generation_jobs SET manuscript_json=?,status='quality_review',lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?",
    ).bind(JSON.stringify(manuscript), new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, 'draft.generated', {
      title: manuscript.title,
      sectionCount: manuscript.sections.length,
      wordCount: manuscript.sections.reduce((sum, section) => sum + section.body.split(/\s+/).filter(Boolean).length, 0),
      sourceCount: sources.length,
      saleEligible: false,
      requiredNext: plan.risk.requiresSpecialistReview ? 'qualified-specialist-and-editorial-review' : 'factual-rights-and-editorial-review',
    });
    return { processed: true, jobId: job.id, status: 'quality_review' };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 900);
    const attempts = Number(job.attempt_count || 1);
    const failed = attempts >= 3;
    const retryAt = new Date(Date.now() + Math.min(60, 5 * attempts) * 60_000).toISOString();
    await env.DB.prepare(
      "UPDATE topic_pdf_generation_jobs SET status=?,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?",
    ).bind(failed ? 'failed' : 'requested', failed ? null : retryAt, message, new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, failed ? 'job.failed' : 'job.retry_scheduled', { attempt: attempts, error: message });
    return { processed: true, jobId: job.id, status: failed ? 'failed' : 'requested', reason: message };
  }
}

export async function topicPdfOwnerReviewRoute(
  req: Request,
  env: TopicPdfWorkerEnv,
  url: URL,
  authorize: (request: Request) => Promise<boolean>,
): Promise<Response | null> {
  if (url.pathname === '/api/owner/topic-pdfs/review-queue' && req.method === 'GET') {
    if (!(await authorize(req))) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    const rows = await (env.DB as any).prepare(
      "SELECT id,request_json,plan_json,status,risk_level,attempt_count,last_error,created_at,updated_at FROM topic_pdf_generation_jobs WHERE status IN ('quality_review','specialist_review','ready_for_editor','failed') ORDER BY created_at ASC LIMIT 100",
    ).all();
    return new Response(JSON.stringify({ ok: true, items: rows.results || [] }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  const match = url.pathname.match(/^\/api\/owner\/topic-pdfs\/requests\/([a-zA-Z0-9_-]{8,80})\/review$/);
  if (!match || req.method !== 'POST') return null;
  if (!(await authorize(req))) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  let body: any;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ ok: false, error: 'Expected JSON body.' }), { status: 400, headers: { 'content-type': 'application/json' } }); }
  const reviewerName = String(body?.reviewerName || '').trim().slice(0, 120);
  const reviewerRole = String(body?.reviewerRole || '').trim().slice(0, 160);
  const decision = String(body?.decision || '');
  const notes = String(body?.notes || '').trim().slice(0, 3000);
  const specialistReviewerName = String(body?.specialistReviewerName || '').trim().slice(0, 120);
  const specialistCredentials = String(body?.specialistCredentials || '').trim().slice(0, 240);
  if (!reviewerName || !reviewerRole || !['changes_required','approved','rejected'].includes(decision)) {
    return new Response(JSON.stringify({ ok: false, error: 'Reviewer name, role and a valid decision are required.' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }
  const job = await env.DB.prepare('SELECT id,status,risk_level,plan_json FROM topic_pdf_generation_jobs WHERE id=? LIMIT 1').bind(match[1]).first<any>();
  if (!job || !['quality_review','specialist_review','ready_for_editor'].includes(job.status)) {
    return new Response(JSON.stringify({ ok: false, error: 'Request is not awaiting editorial review.' }), { status: 409, headers: { 'content-type': 'application/json' } });
  }
  const rights = body?.rightsReviewed === true;
  const factual = body?.factualReviewPassed === true;
  const specialist = body?.specialistReviewPassed === true;
  const editorial = body?.editorialApproval === true;
  const plan = safeObject(job.plan_json) || {};
  const specialistRequired = plan.risk?.requiresSpecialistReview === true;
  const allGates = rights && factual && editorial && (!specialistRequired || specialist);
  if (decision === 'approved' && specialistRequired && (!specialistReviewerName || !specialistCredentials)) {
    return new Response(JSON.stringify({ ok: false, error: 'A named specialist reviewer and their relevant credentials must be recorded for this high-stakes guide.' }), { status: 409, headers: { 'content-type': 'application/json' } });
  }
  if (decision === 'approved' && !allGates) {
    return new Response(JSON.stringify({ ok: false, error: 'Approval is blocked until every required rights, factual, specialist and editorial gate is explicitly passed.' }), { status: 409, headers: { 'content-type': 'application/json' } });
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO topic_pdf_review_decisions(id,job_id,reviewer_name,reviewer_role,decision,rights_reviewed,factual_review_passed,specialist_review_passed,editorial_approved,notes,specialist_reviewer_name,specialist_credentials,specialist_reviewed_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
  ).bind('tpdfr_' + crypto.randomUUID().replaceAll('-', ''), job.id, reviewerName, reviewerRole, decision, rights ? 1 : 0, factual ? 1 : 0, specialist ? 1 : 0, editorial ? 1 : 0, notes, specialistReviewerName || null, specialistCredentials || null, specialist ? now : null, now).run();
  const status = decision === 'approved' ? 'approved' : decision === 'rejected' ? 'blocked' : 'quality_review';
  await env.DB.prepare(
    'UPDATE topic_pdf_generation_jobs SET status=?,reviewer_name=?,reviewer_role=?,reviewed_at=?,lease_until=NULL,updated_at=? WHERE id=?',
  ).bind(status, reviewerName, reviewerRole, now, now, job.id).run();
  await appendEvent(env, job.id, 'editorial.review.' + decision, {
    reviewerName, reviewerRole, rightsReviewed: rights, factualReviewPassed: factual,
    specialistReviewPassed: specialist, editorialApproval: editorial, notes,
  });
  return new Response(JSON.stringify({ ok: true, request: { id: job.id, status, saleEligible: false } }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}


/** Render an approved manuscript into a private bucket; never publishes or emails it. */
export async function processOneApprovedTopicPdfJob(env: TopicPdfWorkerEnv): Promise<{ processed: boolean; jobId?: string; status?: string; reason?: string }> {
  if (env.TOPIC_PDF_PIPELINE_ENABLED !== 'true') return { processed: false, reason: 'pipeline-disabled' };
  if (!env.TOPIC_PDF_RENDER_URL || !env.TOPIC_PDF_RENDER_KEY || !env.TOPIC_PDF_BUCKET) {
    return { processed: false, reason: 'private-renderer-or-object-storage-not-configured' };
  }
  const now = new Date();
  const lease = new Date(now.getTime() + 3 * 60_000).toISOString();
  const job = await env.DB.prepare(
    `UPDATE topic_pdf_generation_jobs
     SET status='rendering',lease_until=?,render_attempt_count=render_attempt_count+1,updated_at=?
     WHERE id=(
       SELECT id FROM topic_pdf_generation_jobs
       WHERE status IN ('approved','rendering')
         AND manuscript_json IS NOT NULL
         AND pdf_storage_key IS NULL
         AND (next_attempt_at IS NULL OR next_attempt_at<=?)
         AND (lease_until IS NULL OR lease_until<?)
       ORDER BY updated_at ASC LIMIT 1
     )
     AND status IN ('approved','rendering')
     RETURNING id,request_json,plan_json,manuscript_json,render_attempt_count`,
  ).bind(lease, now.toISOString(), now.toISOString(), now.toISOString()).first<any>();
  if (!job) return { processed: false, reason: 'approved-render-queue-empty' };

  try {
    const manuscript = JSON.parse(job.manuscript_json);
    const endpoint = env.TOPIC_PDF_RENDER_URL.replace(/\\/+$/, '') + '/render';
    const rendered = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + env.TOPIC_PDF_RENDER_KEY,
      },
      body: JSON.stringify({ manuscript }),
      signal: AbortSignal.timeout(120_000),
    });
    if (!rendered.ok) throw new Error('Private renderer returned HTTP ' + rendered.status + '.');
    if (!(rendered.headers.get('content-type') || '').toLowerCase().includes('application/pdf')) {
      throw new Error('Private renderer did not return application/pdf.');
    }
    const pdf = new Uint8Array(await rendered.arrayBuffer());
    if (pdf.length < 1000 || pdf.length > 25 * 1024 * 1024 ||
        new TextDecoder().decode(pdf.slice(0, 5)) !== '%PDF-') {
      throw new Error('Private renderer returned an invalid or oversized PDF.');
    }
    const digest = await crypto.subtle.digest('SHA-256', pdf);
    const sha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    const storageKey = 'topic-pdfs/' + job.id + '/editorial-draft-' + sha256.slice(0, 16) + '.pdf';
    await env.TOPIC_PDF_BUCKET.put(storageKey, pdf, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, no-store' },
      customMetadata: { jobId: job.id, status: 'editorial-draft-not-for-sale', sha256 },
    });
    const plan = safeObject(job.plan_json) || {};
    const title = String(manuscript.title || 'topic-guide').slice(0, 180);
    const slugBase = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'topic-guide';
    const slug = slugBase + '-' + job.id.slice(-8);
    const publicationId = 'tpdfpub_' + crypto.randomUUID().replaceAll('-', '');
    const specialistPassed = plan.risk?.requiresSpecialistReview === true ? 1 : 0;
    await env.DB.prepare(
      `INSERT INTO topic_pdf_publications
       (id,job_id,slug,title,language,geography,version,storage_key,price_target_usd,status,rights_reviewed,factual_review_passed,specialist_review_passed,editorial_approved,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?, ?,7,'approved',1,1,?,?,?,?)`,
    ).bind(
      publicationId, job.id, slug, title,
      String(manuscript.language || 'English'),
      String(manuscript.geography || 'International'),
      String(manuscript.version || '1.0'),
      storageKey,
      specialistPassed,
      1,
      new Date().toISOString(),
      new Date().toISOString(),
    ).run();
    await env.DB.prepare(
      "UPDATE topic_pdf_generation_jobs SET status='approved',pdf_storage_key=?,pdf_sha256=?,pdf_bytes=?,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?",
    ).bind(storageKey, sha256, pdf.length, new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, 'pdf.rendered.private', {
      storageKey, sha256, bytes: pdf.length,
      watermark: 'EDITORIAL DRAFT — NOT FOR SALE',
      publicDistribution: false,
    });
    return { processed: true, jobId: job.id, status: 'approved' };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error).slice(0, 900);
    const attempts = Number(job.render_attempt_count || 1);
    const failed = attempts >= 3;
    const retryAt = new Date(Date.now() + Math.min(60, 5 * attempts) * 60_000).toISOString();
    await env.DB.prepare(
      "UPDATE topic_pdf_generation_jobs SET status=?,lease_until=NULL,next_attempt_at=?,last_error=?,updated_at=? WHERE id=?",
    ).bind(failed ? 'failed' : 'approved', failed ? null : retryAt, message, new Date().toISOString(), job.id).run();
    await appendEvent(env, job.id, failed ? 'pdf.render_failed' : 'pdf.render_retry_scheduled', { attempt: attempts, error: message });
    return { processed: true, jobId: job.id, status: failed ? 'failed' : 'approved', reason: message };
  }
}
