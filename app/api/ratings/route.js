import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';
import { rateLimiters, applyRateLimit } from '../../../lib/rate-limiters';
import { requireUUID, requireNumberInRange, cleanString } from '../../../lib/validate';

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const blocked = applyRateLimit(rateLimiters.general, session.userId);
  if (blocked) return blocked;

  const body = await request.json();
  const jobIdCheck = requireUUID(body.job_id, 'Job ID');
  if (jobIdCheck.error) return NextResponse.json({ error: jobIdCheck.error }, { status: 400 });
  const ratingCheck = requireNumberInRange(body.rating, 'Rating', 1, 5);
  if (ratingCheck.error) return NextResponse.json({ error: ratingCheck.error }, { status: 400 });

  const job_id = jobIdCheck.value;
  const rating = Math.round(ratingCheck.value);
  const review_text = cleanString(body.review_text || body.review, 2000);

  const { data: job } = await supabaseAdmin
    .from('express_jobs')
    .select('id, client_id, assigned_driver_id, status')
    .eq('id', job_id)
    .single();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (session.role === 'client' && job.client_id !== session.userId) {
    return NextResponse.json({ error: 'You are not authorized to review this job' }, { status: 403 });
  }
  if (session.role === 'driver' && job.assigned_driver_id !== session.userId) {
    return NextResponse.json({ error: 'You are not authorized to review this job' }, { status: 403 });
  }

  const reviewerRole = session.role;
  const reviewData = {
    job_id,
    rating,
    review_text: review_text || null,
    reviewer_role: reviewerRole,
  };

  if (reviewerRole === 'client') {
    reviewData.client_id = session.userId;
    reviewData.driver_id = job.assigned_driver_id;
    reviewData.reviewer_id = session.userId;
    reviewData.reviewee_id = job.assigned_driver_id;
  } else {
    reviewData.driver_id = session.userId;
    reviewData.client_id = job.client_id;
    reviewData.reviewer_id = session.userId;
    reviewData.reviewee_id = job.client_id;
  }

  const { data, error } = await supabaseAdmin
    .from('express_reviews')
    .insert([reviewData])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update average rating
  const targetId = reviewerRole === 'client' ? job.assigned_driver_id : job.client_id;
  const ratingField = reviewerRole === 'client' ? 'driver_rating' : 'client_rating';
  const { data: allReviews } = await supabaseAdmin
    .from('express_reviews')
    .select('rating')
    .eq(reviewerRole === 'client' ? 'driver_id' : 'client_id', targetId);

  if (allReviews && allReviews.length > 0) {
    const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    await supabaseAdmin
      .from('express_users')
      .update({ [ratingField]: Math.round(avg * 10) / 10 })
      .eq('id', targetId);
  }

  return NextResponse.json({ data });
}
