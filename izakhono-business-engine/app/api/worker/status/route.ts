import { NextResponse } from 'next/server';
import { syncProvisionerStatuses } from '../../../../lib/orchestrator';

export async function POST() {
  try {
    const result = await syncProvisionerStatuses();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Provisioner status sync failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
