import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

export async function GET(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let query = supabaseAdmin
      .from('contracts')
      .select('*, party_b:party_b_id(contact_name, company_name)')
      .order('created_at', { ascending: false });

    if (session.role !== 'admin') {
      query = query.eq('party_b_id', session.userId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('GET /api/contracts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const body = await request.json();

    const { data, error } = await supabaseAdmin
      .from('contracts')
      .insert([{
        contract_type: body.contract_type || 'customer_msa',
        party_b_id: body.party_b_id,
        corp_premium_request_id: body.corp_premium_request_id || null,
        effective_date: body.effective_date || null,
        expiry_date: body.expiry_date || null,
        contract_value: body.contract_value ? parseFloat(body.contract_value) : null,
        status: 'draft',
        document_url: body.document_url || null,
      }])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/contracts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'Contract ID required' }, { status: 400 });

    // Non-admin can only sign (update status to 'signed')
    if (session.role !== 'admin') {
      const allowed = { status: 'signed', signed_document_url: true, signed_at: true };
      const keys = Object.keys(updates);
      if (!keys.every(k => k in allowed)) {
        return NextResponse.json({ error: 'Unauthorized update' }, { status: 403 });
      }
      if (updates.status === 'signed') {
        updates.signed_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('contracts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('PATCH /api/contracts error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
