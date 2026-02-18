import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PREFIXES = ['jobs/', 'chat/'];

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId');
    const uploadPath = formData.get('path');

    if (!file || !userId || !uploadPath) {
      return NextResponse.json({ error: 'Missing file, userId, or path' }, { status: 400 });
    }

    // Verify user exists and is active
    const { data: user } = await supabaseAdmin
      .from('express_users')
      .select('id, is_active')
      .eq('id', userId)
      .single();

    if (!user || !user.is_active) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Validate path prefix
    if (!ALLOWED_PREFIXES.some(prefix => uploadPath.startsWith(prefix))) {
      return NextResponse.json({ error: 'Invalid upload path' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    // Convert to buffer for upload
    const buffer = Buffer.from(await file.arrayBuffer());

    let result = await supabaseAdmin.storage
      .from('express-uploads')
      .upload(uploadPath, buffer, { contentType: file.type, upsert: true });

    if (result.error) {
      // Try creating bucket if it doesn't exist
      await supabaseAdmin.storage.createBucket('express-uploads', { public: true });
      result = await supabaseAdmin.storage
        .from('express-uploads')
        .upload(uploadPath, buffer, { contentType: file.type, upsert: true });
      if (result.error) {
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
      }
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('express-uploads')
      .getPublicUrl(uploadPath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
