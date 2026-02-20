import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-server';
import { getSession } from '../../../../lib/auth';

// GET: User's tickets or admin all tickets
export async function GET(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabaseAdmin.from('express_support_tickets').select('*, user:user_id(contact_name, email, role)');

  if (session.role !== 'admin') {
    query = query.eq('user_id', session.userId);
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  if (status) query = query.eq('status', status);

  query = query.order('updated_at', { ascending: false });
  const { data } = await query;
  return NextResponse.json({ data: data || [] });
}

// POST: Create ticket
export async function POST(request) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { category, subject, message } = await request.json();
  if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 });

  const { data: ticket, error } = await supabaseAdmin.from('express_support_tickets').insert([{
    user_id: session.userId,
    category,
    subject: subject || `${category} issue`,
    status: 'open',
  }]).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Add initial user message
  if (message) {
    await supabaseAdmin.from('express_support_messages').insert([{
      ticket_id: ticket.id,
      sender_id: session.userId,
      sender_type: 'user',
      content: message,
    }]);
  }

  // AI auto-response
  const aiResponse = getAiResponse(category, message || subject || '');
  await supabaseAdmin.from('express_support_messages').insert([{
    ticket_id: ticket.id,
    sender_type: 'ai',
    content: aiResponse,
  }]);

  await supabaseAdmin.from('express_support_tickets')
    .update({ status: 'ai_handled', ai_resolved: false, updated_at: new Date().toISOString() })
    .eq('id', ticket.id);

  return NextResponse.json({ data: ticket });
}

function getAiResponse(category, message) {
  const lower = message.toLowerCase();
  const responses = {
    delivery: {
      default: "I can help with your delivery issue! Here are some common solutions:\n\n1. **Track your delivery** - Go to My Jobs and tap on the job to see live tracking\n2. **Contact your driver** - Use the chat feature in the job detail page\n3. **Cancel/modify** - You can cancel before pickup from the job detail page\n\nIf this doesn't resolve your issue, tap 'Connect to Agent' below.",
      cancel: "To cancel a delivery:\n1. Go to My Jobs\n2. Open the job you want to cancel\n3. Tap 'Cancel Job'\n\nNote: Cancellation after pickup may incur a fee. If you need a refund, tap 'Connect to Agent' below.",
      track: "To track your delivery:\n1. Go to My Jobs\n2. Tap on your active job\n3. The live map shows your driver's location in real-time\n\nIf the tracking isn't updating, the driver may be in an area with poor signal.",
    },
    payment: {
      default: "I can help with payment issues! Common solutions:\n\n1. **Check wallet balance** - Go to Wallet page to see your balance\n2. **Top up wallet** - Use PayNow or card to add funds\n3. **View transactions** - All payment history is in your Wallet page\n4. **Refunds** - Refunds are processed within 3-5 business days\n\nFor specific payment disputes, tap 'Connect to Agent' below.",
      refund: "Refund information:\n- Cancelled jobs before pickup: Full refund to wallet\n- Cancelled after pickup: Partial refund based on policy\n- Disputed deliveries: Reviewed by admin within 24 hours\n\nRefunds are credited to your wallet balance. For bank refunds, please contact an agent.",
      wallet: "Wallet help:\n- **Top up**: Go to Wallet > Top Up, choose amount, pay via PayNow\n- **Bonus**: Get bonus credits on larger top-ups ($100+)\n- **Points**: Earn 5% points on every completed delivery\n\nYour wallet balance is shown on your dashboard.",
    },
    account: {
      default: "Account help:\n\n1. **Update profile** - Go to Settings to change name, phone, etc.\n2. **Change password** - Settings > Change Password\n3. **KYC documents** - Drivers can upload/update KYC in Settings\n4. **Verification** - Admin reviews KYC within 24 hours\n\nFor account security issues, please tap 'Connect to Agent' below.",
      password: "To reset your password:\n1. Go to Settings\n2. Enter your current password\n3. Enter and confirm your new password\n4. Tap 'Change Password'\n\nIf you forgot your password, use the 'Forgot Password' link on the login page.",
    },
    driver: {
      default: "Driver support:\n\n1. **Bidding** - Browse available jobs, submit your bid amount\n2. **Earnings** - View your earnings breakdown in the Earnings page\n3. **Payouts** - Payouts are processed after delivery confirmation\n4. **KYC** - Upload documents in Settings for verification\n\nFor payout issues, tap 'Connect to Agent' below.",
    },
    other: {
      default: "I'll try to help! Here are some general tips:\n\n- Check the Help Center for FAQs\n- Make sure your app is up to date\n- Try logging out and back in for common issues\n\nIf you need further assistance, tap 'Connect to Agent' to chat with our support team.",
    },
  };

  const catResponses = responses[category] || responses.other;

  // Check for keyword matches
  for (const [key, response] of Object.entries(catResponses)) {
    if (key !== 'default' && lower.includes(key)) {
      return response;
    }
  }

  return catResponses.default;
}
