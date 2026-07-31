import { supabaseAdmin } from './supabase-server';

/**
 * Promote a driver's inquiry thread to the main job_chat.
 *
 * Called right after process_bid_acceptance succeeds.
 * Must NEVER block or fail the assignment — all errors are logged and swallowed.
 *
 * Steps:
 *  1. chat_messages: set thread_type='job_chat' for all inquiry messages
 *     WHERE job_id AND driver_id = winner (covers both driver AND client replies)
 *  2. job_chat_reads: merge each user's inquiry read row into the main
 *     (driver_id=NULL) row, keeping the later last_read_at, then delete
 *     the inquiry row.
 */
export async function promoteInquiry(jobId, driverId) {
  try {
    // 1. Promote messages — filter by driver_id (not sender_id) so client
    //    replies in this thread are also promoted.
    const { error: msgErr, count } = await supabaseAdmin
      .from('chat_messages')
      .update({ thread_type: 'job_chat' })
      .eq('job_id', jobId)
      .eq('driver_id', driverId)
      .eq('thread_type', 'inquiry');

    if (msgErr) {
      console.error('[promote-inquiry] message update failed:', msgErr.message, { jobId, driverId });
      return;
    }
    console.log(`[promote-inquiry] promoted ${count ?? '?'} messages job=${jobId} driver=${driverId}`);

    // 2. Merge read rows — for each user who has an inquiry read row for this
    //    driver, upsert into the main (driver_id=NULL) row keeping the later
    //    last_read_at, then delete the inquiry row.
    const { data: inquiryReads, error: readErr } = await supabaseAdmin
      .from('job_chat_reads')
      .select('id, user_id, last_read_at')
      .eq('job_id', jobId)
      .eq('driver_id', driverId);

    if (readErr) {
      console.error('[promote-inquiry] read rows fetch failed:', readErr.message, { jobId, driverId });
      return;
    }

    for (const row of inquiryReads || []) {
      // Fetch existing main read row for this user
      const { data: mainRow } = await supabaseAdmin
        .from('job_chat_reads')
        .select('last_read_at')
        .eq('job_id', jobId)
        .eq('user_id', row.user_id)
        .is('driver_id', null)
        .maybeSingle();

      const mainTs = mainRow?.last_read_at ? new Date(mainRow.last_read_at) : new Date(0);
      const inquiryTs = new Date(row.last_read_at);
      const keepTs = mainTs > inquiryTs ? mainRow.last_read_at : row.last_read_at;

      // Upsert main row with the later timestamp
      await supabaseAdmin
        .from('job_chat_reads')
        .upsert(
          { job_id: jobId, user_id: row.user_id, driver_id: null, last_read_at: keepTs },
          { onConflict: 'job_id,user_id,driver_id' },
        );

      // Delete inquiry row
      await supabaseAdmin
        .from('job_chat_reads')
        .delete()
        .eq('id', row.id);
    }

    console.log(`[promote-inquiry] merged ${inquiryReads?.length ?? 0} read rows job=${jobId} driver=${driverId}`);
  } catch (err) {
    console.error('[promote-inquiry] unexpected error:', err, { jobId, driverId });
  }
}
