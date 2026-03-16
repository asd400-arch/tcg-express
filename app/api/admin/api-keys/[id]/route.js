export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';

// PATCH — 활성/비활성 토글
export async function PATCH(request, { params }) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const { error } = await supabaseAdmin
    .from('external_api_keys')
    .update({ is_active: body.is_active })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// DELETE
export async function DELETE(request, { params }) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin.from('external_api_keys').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
