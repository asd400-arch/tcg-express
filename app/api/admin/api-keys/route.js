export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';
import crypto from 'crypto';

// GET — 모든 API Keys 조회
export async function GET(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('external_api_keys')
    .select(`
      id, name, source, is_active, total_orders, last_used_at, created_at, webhook_url,
      client_id,
      api_key
    `)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // client 이름 가져오기 + api_key 마스킹
  const clientIds = [...new Set(data.map(k => k.client_id).filter(Boolean))];
  let clientMap = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabaseAdmin
      .from('express_users')
      .select('id, company_name, contact_name, email')
      .in('id', clientIds);
    clientMap = Object.fromEntries((clients || []).map(c => [c.id, c.company_name || c.contact_name]));
  }

  const masked = data.map(k => ({
    ...k,
    api_key_preview: k.api_key ? `${k.api_key.slice(0, 8)}...${k.api_key.slice(-4)}` : '—',
    api_key: undefined, // 절대 노출 안 함
    client_name: clientMap[k.client_id] || '—',
  }));

  return NextResponse.json({ data: masked });
}

// POST — 새 API Key 생성
export async function POST(request) {
  const session = getSession(request);
  if (!session || session.role !== 'admin') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { name, source, client_id, webhook_url } = body;

  if (!name || !client_id) return NextResponse.json({ error: 'name and client_id are required' }, { status: 400 });

  // API Key 생성: tcgx_ + 32자 랜덤 hex
  const rawKey = `tcgx_${crypto.randomBytes(24).toString('hex')}`;

  const { data, error } = await supabaseAdmin
    .from('external_api_keys')
    .insert([{ name, source: source || 'generic', client_id, webhook_url: webhook_url || null, api_key: rawKey }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // api_key는 생성 직후 1회만 반환
  return NextResponse.json({ success: true, id: data.id, api_key: rawKey }, { status: 201 });
}
