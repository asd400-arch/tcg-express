-- 30 Sep 2026 — driver bonus restructure (Scott's decision):
-- S$20 after the 1st completed delivery (code: processFirstJobBonus), S$50 after 5 (unchanged),
-- referral: referrer S$50 when the referred driver completes 3 deliveries, referred driver S$20 at their 1st.
-- Code deploys the new amounts for NEW sign-ups; this brings referrals that are still pending onto the new terms.
update referral_rewards
   set referrer_amount = 50, referred_amount = 20
 where status = 'pending' and trigger_event = 'first_delivery';
