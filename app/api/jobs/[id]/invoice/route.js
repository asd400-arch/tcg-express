import { NextResponse } from 'next/server';
import { getSession } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { generateInvoice } from '../../../../../lib/generate-invoice';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Verify job exists and user has access
    const { data: job, error } = await supabaseAdmin
      .from('express_jobs')
      .select('client_id, assigned_driver_id, status')
      .eq('id', id)
      .single();

    if (error || !job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Only client, assigned driver, or admin can generate invoice
    const isOwner = job.client_id === session.userId || job.assigned_driver_id === session.userId;
    if (!isOwner && session.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Job must be at least delivered
    if (!['delivered', 'confirmed', 'completed'].includes(job.status)) {
      return NextResponse.json({ error: 'Job must be delivered before generating invoice' }, { status: 400 });
    }

    const url = await generateInvoice(id);
    return NextResponse.json({ url });
  } catch (err) {
    console.error('POST /api/jobs/[id]/invoice error:', err);
    return NextResponse.json({ error: 'Failed to generate invoice' }, { status: 500 });
  }
}
