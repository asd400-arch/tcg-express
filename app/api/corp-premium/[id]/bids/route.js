import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

// GET: List bids for a corp premium request
export async function GET(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: req } = await supabaseAdmin
    .from('corp_premium_requests')
    .select('client_id, status')
    .eq('id', id)
    .single();

  if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });

  // Only admin or the request owner can see bids
  if (session.role !== 'admin' && req.client_id !== session.userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data, error } = await supabaseAdmin
    .from('corp_premium_bids')
    .select('*, partner:partner_id(contact_name, company_name, avg_rating)')
    .eq('request_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST: Submit a bid or update bid status
export async function POST(request, { params }) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  // Submit a new bid (driver/partner)
  if (action === 'submit') {
    if (session.role !== 'driver') {
      return NextResponse.json({ error: 'Only drivers/partners can submit bids' }, { status: 403 });
    }

    const { data: req } = await supabaseAdmin
      .from('corp_premium_requests')
      .select('status')
      .eq('id', id)
      .single();

    if (!req || req.status !== 'bidding_open') {
      return NextResponse.json({ error: 'Bidding is not open for this request' }, { status: 400 });
    }

    const { bid_amount, fleet_size, proposed_vehicles, proposal_text, certifications } = body;
    if (!bid_amount) return NextResponse.json({ error: 'Bid amount required' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('corp_premium_bids')
      .insert([{
        request_id: id,
        partner_id: session.userId,
        bid_amount: parseFloat(bid_amount),
        fleet_size: fleet_size || 1,
        proposed_vehicles: proposed_vehicles || [],
        proposal_text: proposal_text || null,
        certifications: certifications || [],
      }])
      .select('*, partner:partner_id(contact_name, company_name)')
      .single();

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'You have already submitted a bid' }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data });
  }

  // Admin actions: shortlist, accept, reject
  if (['shortlist', 'accept', 'reject'].includes(action)) {
    if (session.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { bid_id } = body;
    if (!bid_id) return NextResponse.json({ error: 'bid_id required' }, { status: 400 });

    const statusMap = { shortlist: 'shortlisted', accept: 'accepted', reject: 'rejected' };
    const newStatus = statusMap[action];

    const { data, error } = await supabaseAdmin
      .from('corp_premium_bids')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', bid_id)
      .eq('request_id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If accepting a bid, award the request and reject others
    if (action === 'accept') {
      await supabaseAdmin
        .from('corp_premium_requests')
        .update({ status: 'awarded', awarded_partner_id: data.partner_id, updated_at: new Date().toISOString() })
        .eq('id', id);

      // Reject other pending/shortlisted bids
      await supabaseAdmin
        .from('corp_premium_bids')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('request_id', id)
        .neq('id', bid_id)
        .in('status', ['pending', 'shortlisted']);
    }

    return NextResponse.json({ data });
  }

  // Update request status (admin)
  if (action === 'update_status') {
    if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const { status } = body;
    const validStatuses = ['bidding_open', 'bidding_closed', 'awarded', 'active', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('corp_premium_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
