import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

// ---------------------------------------------------------------------------
// GET — pending / hold bonuses with promoter + user info
// ---------------------------------------------------------------------------

export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('promoter_bonuses')
    .select(`
      id, promoter_id, user_id, amount, status, hold_reason, created_at,
      promoters ( code, full_name ),
      express_users!promoter_bonuses_user_id_fkey ( contact_name, phone )
    `)
    .in('status', ['pending', 'hold'])
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask phone — show only last 4 digits
  const masked = (data || []).map((b) => {
    const phone = b.express_users?.phone || '';
    const maskedPhone = phone.length >= 4 ? '****' + phone.slice(-4) : phone;
    return {
      ...b,
      promoter_code: b.promoters?.code || '',
      promoter_name: b.promoters?.full_name || '',
      user_name: b.express_users?.contact_name || '',
      user_phone: maskedPhone,
      promoters: undefined,
      express_users: undefined,
    };
  });

  return NextResponse.json({ data: masked });
}

// ---------------------------------------------------------------------------
// PATCH — batch approve / reject
// ---------------------------------------------------------------------------

export async function PATCH(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { action, ids, reject_reason } = await request.json();

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'action and ids[] are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
    }

    if (action === 'reject' && !reject_reason?.trim()) {
      return NextResponse.json({ error: 'reject_reason is required for rejection' }, { status: 400 });
    }

    let updates;
    if (action === 'approve') {
      updates = {
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: session.userId,
      };
    } else {
      updates = {
        status: 'rejected',
        hold_reason: reject_reason.trim(),
      };
    }

    const { data, error } = await supabaseAdmin
      .from('promoter_bonuses')
      .update(updates)
      .in('id', ids)
      .in('status', ['pending', 'hold'])
      .select('id, status');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: data?.length || 0 });
  } catch (err) {
    console.error('[promoter-bonuses] batch update error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
