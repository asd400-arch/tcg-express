# TCG Express — WhatsApp Business upgrade (30 Sep 2026)

Scott's request: "왓츠앱 비지니스 어커운트로 업그레이드 하자".
Account actions (install, verify, backup/restore, linked devices, payments) are Scott's own steps. This file = decision, step list, and the exact texts to paste.

## 1. Decision

**Now: WhatsApp Business app (free) on the same TCG number.**
**Later (not now): WhatsApp Business Platform / Cloud API via a BSP.**

Why the app, not the API, today:

| | WhatsApp Business app | WhatsApp Business Platform (API via BSP) |
|---|---|---|
| Cost | Free | Meta per-message fees + BSP subscription (SG platforms typically S$50–200+/month) + Meta Business verification paperwork |
| SG message fees (Meta, per delivered message) | none | marketing US$0.0732 · utility US$0.0160 · authentication US$0.0160 · **service (free-form replies) US$0.0160 from 1 Oct 2026**, first 1,000 service messages per number per month free; inbound free; 72-h Click-to-WhatsApp window free |
| Who can message first | anyone we already talk to; cold outreach limited by the same anti-spam rules we hit on 26 Sep | only opted-in customers may receive business-initiated templates — cold outreach is a policy violation, so the API does **not** solve prospecting |
| Automation | greeting, away, quick replies, labels, catalog, broadcast lists (max 256 saved contacts) | chatbots, templates, multi-agent inbox, CRM |
| Devices | phone + up to 4 linked devices (WhatsApp Web/Desktop) | unlimited agents |
| Our rule "driver/customer notifications = app push only" | fits | would sit unused |

Our volume (≤15 sends/day, ~450/month) never reaches the API's break-even; the business tools we actually need (profile, hours, auto-replies, labels, short link) are all in the free app. Revisit the API only if (a) we want a shared multi-agent inbox, or (b) Scott decides to send transactional WhatsApp templates (job assigned / driver on the way) — then use **coexistence** (Cloud API + Business app on the same number; the app keeps working, 6 months of chats sync; broadcast lists and groups stop syncing).

Optional paid badge: Meta One business plans launched in Singapore in Sep 2026 (Essential S$17.99/month upward) — verified badge + impersonation protection. Not needed for launch; decide later.

## 2. Steps on Scott's phone (20–30 min)

Prerequisite: decide the number. Recommendation = **keep the current TCG WhatsApp number** (it is what drivers, promoters, sellers and Carousell contacts already have; chat history moves with it). A new dedicated SIM would reset every conversation and needs re-printing wherever the number appears.

1. Back up chats in the current WhatsApp: Settings → Chats → Chat backup → Back up now (Android = Google Drive, iPhone = iCloud; same Google/Apple account as the phone).
2. Install **WhatsApp Business** (Play Store / App Store). Do not uninstall the old app yet.
3. Open WhatsApp Business → Agree and continue → enter the **same number** → verify with the SMS code.
4. When offered, **restore** the backup (chats, media, groups and contacts move over). Chat history is copied; the number moves to the Business app and the old WhatsApp for that number stops working — that is expected.
5. Business profile (Settings → Business tools → Business profile): paste §3.
6. Business tools: Greeting message (§4), Away message (§5), Quick replies (§6), Labels (§7), Short link (§8). Catalog optional (§9).
7. Linked devices: the migration unlinks the WhatsApp Web session in the Tech Chain Global Chrome. **Do not re-link WhatsApp Web until Scott confirms the phone has no warnings** (existing rule after the 26 Sep block).
8. Uninstall the old WhatsApp app only after the Business app shows all chats.

If Scott keeps a personal WhatsApp on a different number, both apps can live on the same phone (one number per app).

## 3. Business profile (paste)

- Business name: `TCG Express`
- Category: `Delivery service` (if not offered: `Transportation service`)
- Description (≤ 512 chars):
  `Singapore B2B delivery marketplace by Tech Chain Global Pte Ltd (UEN 202005872W). Fixed-price jobs shown upfront – motorcycle, car, van and lorry – first available driver takes it. Businesses: 10 FREE deliveries with code FIRST10. Drivers: keep 100% of the fare for your first 30 days.`
- Address: optional. Registered office `21 Tan Quee Lan Street, #02-04 Heritage Place, Singapore 188108` — it is a registered-office address (no walk-ins), so leaving it blank is fine.
- Business hours: `Mon–Sat 09:00–19:00`, Sun closed (edit if different).
- Email: `admin@techchainglobal.com`
- Website: `https://app.techchainglobal.com`
- Profile photo: `/mnt/user-data/outputs/TCG-profile-1024.png` (app icon square; also in the repo marketing folder).

## 4. Greeting message (auto-sent to new contacts / after 14 days of silence)

```
Hi, this is TCG Express (Tech Chain Global). Thanks for messaging us.

Tell us which one you are and we'll reply shortly:
1) Business – I need a delivery (10 FREE deliveries with code FIRST10)
2) Driver – I want to join
3) Promoter / partner

Hours: Mon–Sat 9am–7pm. Web app: app.techchainglobal.com
```

Send to: Everyone not in address book (recommended) or Everyone.

## 5. Away message (outside business hours)

```
Thanks for your message. We're away right now (Mon–Sat 9am–7pm) and will reply on the next working day.

Urgent issue with a live job? Use the Support chat inside the TCG Express app – it reaches us faster.
```

Schedule: Outside of business hours.

## 6. Quick replies (Business tools → Quick replies; type "/" in a chat to use)

| Shortcut | Message |
|---|---|
| `/driver` | `To drive with TCG Express: 1) sign up at app.techchainglobal.com/signup?role=driver (or the iPhone app "TCG Express"), 2) upload licence + vehicle photo, 3) approval within 1 working day. Fixed-price B2B jobs – see the fare, tap Accept, go. Keep 100% of the fare for your first 30 days. Bonus: S$20 after your 1st completed delivery, S$50 more after 5.` |
| `/android` | `Android: our app is in a 2-week closed test. Tell me the Gmail address you use on your phone, I'll add you as a tester, then open play.google.com/apps/testing/com.techchainglobal.express and tap "Become a tester" → Install. Until then the web app works in Chrome: app.techchainglobal.com` |
| `/customer` | `TCG Express is fixed-price business delivery in Singapore: post the job, see the fare before you confirm, the first available driver takes it – no bidding. Your first 10 deliveries are free (up to S$10 off each, code FIRST10, company UEN required). Sign up: app.techchainglobal.com` |
| `/howmuch` | `Fares are fixed and shown before you post. Rough guide within Singapore: motorcycle from S$6, car from S$11, MPV from S$16, 1.7 m van from S$30, 2.4 m van from S$42, 10 ft lorry from S$65 (distance beyond 10 km and express/urgent add on). Post the job in the app to see your exact fare.` |
| `/refer` | `Refer a driver: share your referral code from Profile → Share. You get S$50 when they complete 3 deliveries, they get S$20 at their first. No limit on referrals.` |
| `/withdraw` | `Payout: when the customer confirms delivery, the fare goes into your in-app wallet. Request a withdrawal to your bank and we process it within 3 days. Bonus credits are not withdrawable.` |
| `/promoter` | `Promoter role: S$12/hour + S$2 per business sign-up through your personal QR code, in business zones such as Tai Seng, Ubi, Sim Lim and Jurong. Tell me your name, preferred zone and available days and I'll set you up.` |
| `/crossborder` | `Cross-border SG → Johor Bahru / Kuala Lumpur is opening as a quote-based service in October. Drivers need VEP RFID, Malaysia insurance cover and a passport; customs paperwork is handled by our declaring agents. Reply with your vehicle type and VEP status and I'll register your interest.` |
| `/support` | `For a problem with a live job (pickup, address, damage, payment), please open the Support chat inside the TCG Express app – the job details are attached automatically and our team answers there. Job number helps.` |
| `/thanks` | `Thanks – noted. I'll get back to you within the day. – Scott, TCG Express` |

## 7. Labels (Business tools → Labels)

`Driver – new` · `Driver – approved` · `Driver – Android tester` · `Customer – lead` · `Customer – active` · `Promoter` · `Partner / vendor` · `Carousell seller` · `Cross-border` · `Follow-up`

## 8. Short link + QR (Business tools → Short link)

Default message: `Hi TCG Express, I'm interested in: delivery / driving / partnership`

Use the generated `wa.me/message/…` link and QR on: the promoter one-pager and QR cards, LinkedIn company page "Contact", the website footer, the driver dashboard help card, van decals. **Not** on Carousell (no phone numbers/URLs there).

## 9. Catalog (optional, later)

Three items with the v6 banners as images: `Fixed-price business delivery (motorcycle to lorry)`, `10 FREE deliveries – code FIRST10`, `Drive with TCG Express`. Prices "Contact for price".

## 10. Operating rules that stay (anti-spam)

- ≤15 outbound conversations per day, 3–5 minutes apart, first message without links. Business app does not raise these limits.
- Broadcast lists only reach people who saved our number → ask drivers/customers to save the number (greeting message + app onboarding).
- Prefer inbound: short link/QR everywhere, Click-to-WhatsApp on the Facebook page once the page is set up (free 72-hour window even on the API later).
- Driver/customer notifications stay app-only (push + in-app). WhatsApp = prospects, partners and people who write to us.

## 11. When to revisit the API

Trigger: a second person answering chats full-time, or a decision to send transactional templates. Path: BSP with coexistence (e.g., 360dialog, SleekFlow, respond.io) → Meta Business Manager verification (ACRA BizFile PDF, techchainglobal.com domain) → templates → keep the app for 1:1. Budget from 1 Oct 2026: first 1,000 service messages/number/month free, then US$0.016 each in SG; marketing templates US$0.0732 each; BSP plan on top.
