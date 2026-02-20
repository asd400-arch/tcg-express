import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PREFIXES = ['jobs/', 'chat/', 'kyc/', 'delivery/'];

async function ensureBucket() {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some(b => b.id === 'express-uploads');
  if (!exists) {
    await supabaseAdmin.storage.createBucket('express-uploads', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      fileSizeLimit: MAX_FILE_SIZE,
    });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    let uploadPath = formData.get('path');

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Detect content type
    const contentType = file.type || 'image/jpeg';

    // Auto-generate path if not provided
    if (!uploadPath) {
      const nameParts = (file.name || 'photo.jpg').split('.');
      const ext = nameParts.length > 1 ? nameParts.pop() : 'jpg';
      uploadPath = `jobs/${session.userId}/${Date.now()}.${ext}`;
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

    // Ensure bucket exists
    await ensureBucket();

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('express-uploads')
      .upload(uploadPath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('express-uploads')
      .getPublicUrl(uploadPath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload server error:', err);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
