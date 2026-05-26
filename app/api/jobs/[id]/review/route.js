import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-server';
import { getSession } from '../../../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../../../lib/rate-limiters';
import { requireNumberInRange, cleanString } from '../../../../../lib/validate';

export async function POST(request, { params }) {
  try {
    const session = getSession(request);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const blocked = applyRateLimit(rateLimiters.general, session.userId);
    if (blocked) return blocked;

    const { id: jobId } = await params;
    const body = await request.json();

    const ratingCheck = requireNumberInRange(body.rating, 'Rating', 1, 5);
    if (ratingCheck.error) return NextResponse.json({ error: ratingCheck.error }, { status: 400 });

    const rating = Math.round(ratingCheck.value);
    const review_text = cleanString(body.comment || body.review_text || body.review, 2000);

    const { data: job } = await supabaseAdmin
      .from('express_jobs')
      .select('id, client_id, assigned_driver_id, status')
      .eq('id', jobId)
      .single();

    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (session.role === 'client' && job.client_id !== session.userId) {
      return NextResponse.json({ error: 'You are not authorized to review this job' }, { status: 403 });
    }
    if (!['confirmed', 'completed'].includes(job.status)) {
      return NextResponse.json({ error: 'Job must be completed before reviewing' }, { status: 400 });
    }

    const reviewData = {
      job_id: jobId,
      rating,
      review_text: review_text || null,
      reviewer_role: 'client',
      client_id: session.userId,
      driver_id: job.assigned_driver_id,
      reviewer_id: session.userId,
      reviewee_id: job.assigned_driver_id,
    };

    const { data, error } = await supabaseAdmin
      .from('express_reviews')
      .insert([reviewData])
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (job.assigned_driver_id) {
      const { data: allReviews } = await supabaseAdmin
        .from('express_reviews')
        .select('rating')
        .eq('driver_id', job.assigned_driver_id);

      if (allReviews?.length) {
        const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        await supabaseAdmin
          .from('express_users')
          .update({ driver_rating: Math.round(avg * 10) / 10 })
          .eq('id', job.assigned_driver_id);
      }
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error('POST /api/jobs/[id]/review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
