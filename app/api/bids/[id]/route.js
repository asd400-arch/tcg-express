import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

export async function DELETE(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: bid } = await supabaseAdmin
    .from('express_bids')
    .select('id, driver_id, status')
    .eq('id', id)
    .single();

  if (!bid) return NextResponse.json({ error: 'Bid not found' }, { status: 404 });
  if (bid.driver_id !== session.userId) return NextResponse.json({ error: 'Not your bid' }, { status: 403 });
  if (bid.status !== 'pending') return NextResponse.json({ error: 'Can only withdraw pending bids' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('express_bids')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
