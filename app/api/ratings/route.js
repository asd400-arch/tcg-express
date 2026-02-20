import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase-server';
import { getSession } from '../../../lib/auth';

export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { job_id, rating, review } = await request.json();
  if (!job_id || !rating) return NextResponse.json({ error: 'Job ID and rating required' }, { status: 400 });

  const { data: job } = await supabaseAdmin
    .from('express_jobs')
    .select('id, client_id, assigned_driver_id, status')
    .eq('id', job_id)
    .single();

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  const reviewerRole = session.role;
  const reviewData = {
    job_id,
    rating: Math.min(5, Math.max(1, parseInt(rating))),
    review: review || null,
    reviewer_role: reviewerRole,
  };

  if (reviewerRole === 'client') {
    reviewData.client_id = session.userId;
    reviewData.driver_id = job.assigned_driver_id;
  } else {
    reviewData.driver_id = session.userId;
    reviewData.client_id = job.client_id;
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
