-- ============================================================
-- Help Center System Migration
-- FAQ, Support Tickets, Messages, Chatbot Sessions
-- ============================================================

-- Drop old support tables from phase 8 if they exist (replaced by this migration)
DROP TABLE IF EXISTS express_support_messages CASCADE;
DROP TABLE IF EXISTS express_support_tickets CASCADE;

-- ============================================================
-- 1. faq_categories
-- ============================================================
CREATE TABLE faq_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(100) NOT NULL,
  title_ko VARCHAR(100),
  description TEXT,
  icon VARCHAR(10),
  display_order INTEGER NOT NULL DEFAULT 0,
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'customer', 'driver')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. faq_articles
-- ============================================================
CREATE TABLE faq_articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES faq_categories(id) ON DELETE CASCADE,
  slug VARCHAR(200) NOT NULL UNIQUE,
  question TEXT NOT NULL,
  question_ko TEXT,
  answer TEXT NOT NULL,
  answer_ko TEXT,
  keywords TEXT[],
  ai_context TEXT,
  target_audience VARCHAR(20) NOT NULL DEFAULT 'all' CHECK (target_audience IN ('all', 'customer', 'driver')),
  display_order INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  not_helpful_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. support_tickets
-- ============================================================
CREATE TABLE support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_number VARCHAR(20) UNIQUE,
  user_id UUID NOT NULL REFERENCES express_users(id) ON DELETE CASCADE,
  subject VARCHAR(300) NOT NULL,
  category VARCHAR(50) NOT NULL,
  priority VARCHAR(10) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
  contact_email VARCHAR(200),
  contact_phone VARCHAR(20),
  description TEXT,
  attachments JSONB NOT NULL DEFAULT '[]',
  chat_history JSONB NOT NULL DEFAULT '[]',
  ai_summary TEXT,
  assigned_to UUID REFERENCES express_users(id),
  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5)),
  related_job_id UUID,
  related_payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. support_messages
-- ============================================================
CREATE TABLE support_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('user', 'agent', 'system')),
  sender_id UUID,
  message TEXT NOT NULL,
  attachments JSONB NOT NULL DEFAULT '[]',
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. chatbot_sessions
-- ============================================================
CREATE TABLE chatbot_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES express_users(id) ON DELETE SET NULL,
  session_token VARCHAR(100),
  messages JSONB NOT NULL DEFAULT '[]',
  message_count INTEGER NOT NULL DEFAULT 0,
  resolved BOOLEAN NOT NULL DEFAULT false,
  escalated_to_ticket UUID REFERENCES support_tickets(id),
  topics TEXT[],
  satisfaction_rating INTEGER CHECK (satisfaction_rating IS NULL OR (satisfaction_rating >= 1 AND satisfaction_rating <= 5)),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

-- faq_categories
CREATE INDEX idx_faq_categories_order ON faq_categories(display_order);

-- faq_articles
CREATE INDEX idx_faq_articles_category ON faq_articles(category_id);
CREATE INDEX idx_faq_articles_keywords ON faq_articles USING GIN(keywords);
CREATE INDEX idx_faq_articles_audience ON faq_articles(target_audience);

-- support_tickets
CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_number ON support_tickets(ticket_number);

-- support_messages
CREATE INDEX idx_support_messages_ticket ON support_messages(ticket_id);

-- chatbot_sessions
CREATE INDEX idx_chatbot_sessions_user ON chatbot_sessions(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE faq_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_sessions ENABLE ROW LEVEL SECURITY;

-- FAQ: public read for active items
CREATE POLICY "faq_categories_public_read" ON faq_categories
  FOR SELECT USING (is_active = true);

CREATE POLICY "faq_articles_public_read" ON faq_articles
  FOR SELECT USING (is_active = true);

-- Support tickets: users see and create only their own
CREATE POLICY "support_tickets_select_own" ON support_tickets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "support_tickets_insert_own" ON support_tickets
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Support messages: users see non-internal messages on their own tickets
CREATE POLICY "support_messages_select_own" ON support_messages
  FOR SELECT USING (
    is_internal = false
    AND ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "support_messages_insert_own" ON support_messages
  FOR INSERT WITH CHECK (
    sender_type = 'user'
    AND ticket_id IN (
      SELECT id FROM support_tickets WHERE user_id = auth.uid()
    )
  );

-- Chatbot sessions: users see only their own
CREATE POLICY "chatbot_sessions_select_own" ON chatbot_sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chatbot_sessions_insert_own" ON chatbot_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- TRIGGER: Auto-generate ticket_number on INSERT
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1001;

CREATE OR REPLACE FUNCTION fn_generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL THEN
    NEW.ticket_number := 'TCG-SUP-' || LPAD(nextval('support_ticket_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_generate_ticket_number();

-- Updated_at triggers
CREATE TRIGGER trg_faq_articles_updated_at
  BEFORE UPDATE ON faq_articles
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION fn_update_timestamp();

-- Enable realtime for support messages
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;

-- ============================================================
-- SEED: FAQ Categories
-- ============================================================

INSERT INTO faq_categories (slug, title, title_ko, description, icon, display_order, target_audience) VALUES
  ('booking',           'Booking & Orders',      '예약 및 주문',       'How to create, manage, and track delivery orders',                '📦', 1, 'all'),
  ('delivery',          'Delivery & Tracking',   '배송 및 추적',       'Delivery status, tracking, and estimated arrival times',          '🚚', 2, 'all'),
  ('payment',           'Payment & Wallet',      '결제 및 지갑',       'Top-ups, withdrawals, payment methods, and billing',              '💳', 3, 'all'),
  ('account',           'Account & Settings',    '계정 및 설정',       'Profile settings, security, and account management',              '👤', 4, 'all'),
  ('driver-onboarding', 'Become a Driver',       '드라이버 시작하기',     'Requirements, application process, and getting started',          '🏍️', 5, 'driver'),
  ('driver-earnings',   'Driver Earnings',       '드라이버 수입',       'How earnings work, commissions, bonuses, and payouts',            '💰', 6, 'driver'),
  ('safety',            'Safety & Insurance',    '안전 및 보험',       'Safety guidelines, insurance coverage, and incident reporting',    '🛡️', 7, 'all'),
  ('ev-green',          'EV & Green Points',     'EV 및 그린 포인트',   'Electric vehicles, green incentives, and sustainability rewards', '🌱', 8, 'all');

-- ============================================================
-- SEED: FAQ Articles
-- ============================================================

INSERT INTO faq_articles (category_id, slug, question, answer, keywords, ai_context, target_audience, display_order, is_pinned) VALUES

-- 1. How to book a delivery
((SELECT id FROM faq_categories WHERE slug = 'booking'),
'how-to-book-delivery',
'How do I book a delivery on TCG Express?',
'## Booking a Delivery

Follow these simple steps to create a new delivery job:

1. **Log in** to your TCG Express account
2. Click **"New Delivery"** from your dashboard
3. Fill in the delivery details:
   - **Pickup address** — where the item is collected
   - **Drop-off address** — the destination
   - **Package details** — dimensions (L × W × H) and weight
   - **Vehicle type** — auto-selected based on your package size
4. Choose your **job type**:
   - **Spot** — immediate one-off delivery
   - **Regular** — scheduled recurring deliveries
   - **Corporate Premium** — priority service with dedicated drivers
5. Review the **estimated fare** and click **Confirm Booking**
6. A driver will be matched and you can track your delivery in real-time

### Tips
- Use **SaveMode** to consolidate multiple deliveries into one trip and save up to 30%
- Pay with your **wallet balance** for faster checkout
- Apply a **promo code** before confirming to get discounts',
ARRAY['book', 'booking', 'create', 'order', 'delivery', 'new', 'how to', 'schedule'],
'User wants to know how to create a new delivery booking. Guide them through the New Delivery flow in the client dashboard.',
'customer', 1, true),

-- 2. Cancel a delivery
((SELECT id FROM faq_categories WHERE slug = 'booking'),
'how-to-cancel-delivery',
'How do I cancel a delivery? What is the cancellation policy?',
'## Cancelling a Delivery

You can cancel a delivery from your **My Deliveries** page:

1. Find the delivery you want to cancel
2. Click on the job to view details
3. Click **"Cancel Job"**

### Cancellation Policy

| Timing | Fee |
|--------|-----|
| Before driver accepts | **Free** — full refund |
| After driver accepts, before pickup | **$5 cancellation fee** |
| After pickup (in transit) | **Cannot cancel** — contact support |

### Refunds
- Wallet payments are refunded **instantly** to your wallet balance
- Card payments are refunded within **3-5 business days**
- If a driver cancels on their end, you receive a **full refund** with no fee

### Need Help?
If you need to cancel an in-transit delivery due to an emergency, please contact our support team immediately through the **Help Center** chat.',
ARRAY['cancel', 'cancellation', 'refund', 'policy', 'fee', 'abort'],
'User wants to cancel a delivery or understand cancellation fees. Check the job status first — if in transit, escalate to support.',
'customer', 2, false),

-- 3. Wallet top-up
((SELECT id FROM faq_categories WHERE slug = 'payment'),
'how-to-top-up-wallet',
'How do I top up my TCG Express wallet?',
'## Topping Up Your Wallet

Go to **Wallet** from the sidebar menu, then tap **Top Up**.

### Payment Methods

#### PayNow (Recommended — Free)
1. Select **PayNow** as payment method
2. Choose an amount ($50 – $10,000)
3. A **QR code** will be generated
4. Open your banking app (DBS, OCBC, UOB, etc.)
5. Scan the QR code and confirm payment
6. Your wallet is credited automatically within minutes

#### Credit/Debit Card
1. Select **Card** as payment method
2. Enter your card details (Visa, Mastercard, Amex)
3. Complete the payment
4. Balance is credited instantly

### Quick Top-Up Amounts
Choose from preset amounts: **$50, $100, $200, $500, $1,000**

### Limits
- Minimum top-up: **$10**
- Maximum top-up: **$10,000** per transaction
- PayNow QR expires after **30 minutes**

### Troubleshooting
- If your PayNow payment is not reflected after 10 minutes, contact support with your **PayNow reference number**
- Card payments are processed by Stripe and may show as "TCG Express" on your statement',
ARRAY['top up', 'topup', 'wallet', 'add money', 'fund', 'paynow', 'qr code', 'card', 'payment'],
'User wants to add funds to their wallet. Guide them to the Wallet page and explain PayNow QR or card top-up flow.',
'all', 1, true),

-- 4. Driver withdrawal
((SELECT id FROM faq_categories WHERE slug = 'driver-earnings'),
'how-to-withdraw-earnings',
'How do I withdraw my earnings as a driver?',
'## Withdrawing Your Earnings

Navigate to **Wallet** → tap **Withdraw**.

### Withdrawal Methods

| Method | Fee | Processing Time |
|--------|-----|----------------|
| **PayNow** | Free | 1–2 business days |
| **Bank Transfer** | $0.50 | 1–3 business days |

### Steps
1. Enter the withdrawal amount (minimum **$50**)
2. Select your preferred method (PayNow or Bank Transfer)
3. Verify your payout details
4. Confirm the withdrawal

### Setup Required
Before your first withdrawal, set up your payout details in **Wallet Settings**:
- **PayNow**: Enter your registered phone number, UEN, or NRIC
- **Bank Transfer**: Select your bank, enter account number and holder name

### Limits
- Minimum withdrawal: **$50**
- Maximum withdrawal: **$10,000** per transaction
- Daily limit: **$5,000**
- Monthly limit: **$50,000**

### Commission Structure
- Standard commission: **15%** platform fee
- EV drivers: **10%** platform fee (5% green discount)
- Your earning per job = Total fare − Platform commission

### When Are Earnings Available?
Earnings are credited to your wallet **immediately** after a delivery is marked as completed and confirmed by the customer.',
ARRAY['withdraw', 'withdrawal', 'earnings', 'payout', 'cash out', 'bank', 'paynow', 'commission', 'driver'],
'Driver wants to withdraw earnings. Guide them to wallet withdrawal flow. Mention commission rates and PayNow/bank options.',
'driver', 1, true),

-- 5. Become a driver
((SELECT id FROM faq_categories WHERE slug = 'driver-onboarding'),
'how-to-become-driver',
'How do I become a TCG Express driver?',
'## Become a TCG Express Driver

### Requirements
- Valid Singapore driving license (Class 3 or above)
- Registered vehicle (motorcycle, car, van, or lorry)
- Smartphone with GPS enabled
- Clean driving record
- Minimum age: **21 years old**

### Application Process
1. **Sign up** at TCG Express and select **"Driver"** role
2. Complete your **profile** with personal details
3. Submit **KYC documents**:
   - NRIC (front & back)
   - Driving license
   - Vehicle registration (log card)
   - Vehicle insurance certificate
   - Profile photo
4. **Verification** — our team reviews your application within **1-3 business days**
5. Once **approved**, you can start accepting delivery jobs

### What You Earn
- Keep **85%** of every delivery fare (15% platform commission)
- **EV drivers** keep **90%** (only 10% commission)
- Earn **Green Points** for every delivery
- Bonus incentives for peak hours and high ratings

### Vehicle Types Accepted

| Type | Examples |
|------|---------|
| Motorcycle | Scooters, sport bikes |
| Car | Sedan, hatchback |
| MPV | Toyota Innova, Honda Odyssey |
| Small Van | Toyota HiAce |
| Large Van | Mercedes Sprinter |
| 10ft Lorry | Canopy or open |
| 14ft Lorry | With tailgate |
| 24ft Lorry | For large moves |
| Refrigerated | Cold chain vehicles |',
ARRAY['driver', 'sign up', 'register', 'apply', 'become', 'onboarding', 'requirements', 'kyc', 'verification'],
'User wants to become a driver. Explain requirements, KYC process, and earning potential.',
'driver', 1, true),

-- 6. Damage claims
((SELECT id FROM faq_categories WHERE slug = 'safety'),
'damage-claims-compensation',
'What happens if my item is damaged during delivery? How do I file a claim?',
'## Damage Claims & Compensation

If your item is damaged during delivery, TCG Express provides a structured compensation process.

### How to File a Claim
1. Go to **My Deliveries** → select the affected job
2. Click **"Report Issue"** or **"Open Dispute"**
3. Provide:
   - Photos of the damaged item
   - Description of the damage
   - Original item value (with receipt if available)
4. Our team will investigate within **24-48 hours**

### Compensation Schedule

| Item Value | Maximum Compensation | Processing Time |
|-----------|---------------------|----------------|
| Up to $50 | **100%** of declared value | 3 business days |
| $50 – $200 | **Up to $200** | 5 business days |
| $200 – $500 | **Up to $400** | 7 business days |
| $500 – $1,000 | **Up to $750** | 10 business days |
| Over $1,000 | **Up to $1,000** (max liability cap) | 14 business days |

### Important Notes
- **Declare the value** of your items when booking for accurate coverage
- Items over **$1,000** in value should be insured separately
- Fragile items must be marked as **"Special Handling"** during booking
- Perishable goods and live animals are **excluded** from compensation
- Claims must be filed within **7 days** of delivery completion

### How Compensation Is Paid
- Compensation is credited directly to your **TCG Express wallet**
- For amounts over $500, you may request a **bank transfer**

### Dispute Resolution
If you disagree with the claim outcome:
1. Reply to the dispute with additional evidence
2. Request **escalation** to a senior support agent
3. Final decisions are made within **5 business days** of escalation

### Prevention Tips
- Use **Special Handling** for fragile items
- Add delivery instructions for careful handling
- Consider using a larger vehicle to avoid tight packing',
ARRAY['damage', 'damaged', 'broken', 'claim', 'compensation', 'insurance', 'dispute', 'refund', 'liability'],
'User has a damaged item and wants to file a claim. Guide them to the dispute flow and explain the compensation schedule. Escalate if item value is high.',
'all', 1, true);
