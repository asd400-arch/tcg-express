import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../lib/rate-limiters';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_PREFIXES = ['jobs/', 'chat/', 'kyc/', 'delivery/', 'rfq/', 'disputes/'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',   // .xlsx
  'application/vnd.ms-excel',                                            // .xls
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword',                                                  // .doc
  'text/csv',                                                            // .csv
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOC_TYPES];

async function ensureBucket(name, options = {}) {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some(b => b.id === name);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(name, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      ...options,
    });
  } else if (options.allowedMimeTypes) {
    // Update existing bucket to ensure MIME types are current
    await supabaseAdmin.storage.updateBucket(name, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
      ...options,
    });
  }
}

export async function POST(request) {
  try {
    const session = getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const blocked = applyRateLimit(rateLimiters.upload, session.userId);
    if (blocked) return blocked;

    const formData = await request.formData();
    const file = formData.get('file');
    let uploadPath = formData.get('path');

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    // Detect and validate content type
    const contentType = file.type || 'application/octet-stream';

    // Validate file type (images for most uploads, PDFs for rfq/kyc)
    const isDocPath = uploadPath && (uploadPath.startsWith('rfq/') || uploadPath.startsWith('kyc/'));
    if (isDocPath) {
      if (!ALL_ALLOWED_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Invalid file type. Allowed: images, PDF, Excel, Word, CSV, PowerPoint' }, { status: 400 });
      }
    } else {
      if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
        return NextResponse.json({ error: 'Invalid file type. Only images allowed (JPEG, PNG, WebP, GIF)' }, { status: 400 });
      }
    }

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

    // Route to appropriate bucket based on prefix
    const isRfq = uploadPath.startsWith('rfq/');
    const bucket = isRfq ? 'rfq-attachments' : 'express-uploads';

    if (isRfq) {
      await ensureBucket('rfq-attachments', {
        allowedMimeTypes: ALL_ALLOWED_TYPES,
      });
    } else {
      await ensureBucket('express-uploads', {
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'],
      });
    }

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(uploadPath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError, '| bucket:', bucket, '| path:', uploadPath, '| contentType:', contentType, '| size:', buffer.length);
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(uploadPath);

    return NextResponse.json({ url: urlData.publicUrl });
  } catch (err) {
    console.error('Upload server error:', err);
    return NextResponse.json({ error: `Server error: ${err.message}` }, { status: 500 });
  }
}
