/**
 * Zero-commission promo: drivers get 0% commission for 30 days
 * after their first completed delivery.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} driverId
 * @param {number} defaultRate - fallback commission rate (e.g. 15)
 * @returns {Promise<number>} effective commission rate
 */
export async function getCommissionRate(supabase, driverId, defaultRate) {
  try {
    const { data: firstJob } = await supabase
      .from('express_jobs')
      .select('completed_at')
      .eq('assigned_driver_id', driverId)
      .in('status', ['completed', 'confirmed', 'delivered'])
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    // No prior completed job → this is their first delivery → 0%
    if (!firstJob?.completed_at) {
      console.log(`[commission] zero-commission: first delivery for driver ${driverId}`);
      return 0;
    }

    const daysSinceFirst = (Date.now() - new Date(firstJob.completed_at).getTime()) / 86400000;
    if (daysSinceFirst < 30) {
      console.log(
        `[commission] zero-commission period applied for driver ${driverId} (first delivery: ${firstJob.completed_at}, ${Math.floor(daysSinceFirst)} days ago)`,
      );
      return 0;
    }

    return defaultRate;
  } catch (err) {
    console.error('[commission] zero-commission check failed, using default:', err?.message);
    return defaultRate;
  }
}
