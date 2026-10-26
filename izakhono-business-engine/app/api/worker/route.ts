import { NextResponse } from 'next/server';
import { claimNextExecution, executeNextStep, finalizeExecution } from '../../../lib/orchestrator';

export async function POST() {
  try {
    const job = await claimNextExecution();
    if (!job) return NextResponse.json({ ok: true, message: 'No queued execution jobs.' });

    const result = await executeNextStep(job.id);
    const completed = await finalizeExecution(job.id);

    return NextResponse.json({ ok: true, job_id: job.id, step: result.step ?? null, completed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worker execution failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
