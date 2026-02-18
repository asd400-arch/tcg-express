import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PREFIXES = ['jobs/', 'chat/', 'kyc/'];

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const uploadPath = formData.get('path');

    if (!file || !uploadPath) {
      return NextResponse.json({ error: 'Missing file or path' }, { status: 400 });
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
