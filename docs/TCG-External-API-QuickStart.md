# TCG Express — Posting deliveries from your own system

Three ways to get your delivery jobs onto TCG Express. Pick the one that fits today; move up when volume grows.

## 1. Web app (no setup) — 2 minutes per job
Register at https://app.techchainglobal.com (Google sign-in works) → Post a job → verified drivers bid → you pick → track door to door, invoice auto-generated.
Launch offer: code **FIRST10** — up to S$10 off each of your first 10 jobs (max S$100). No top-up needed. Requires company name, UEN and a Singapore mobile number in Settings.

## 2. Send us a list (no setup) — for 5+ jobs at a time
Email a spreadsheet (or WhatsApp a list) with one row per delivery and we post them under your account the same day. Use the template `TCG-bulk-jobs-template.csv`:

| column | required | example |
|---|---|---|
| pickup_address | yes | 1 Kallang Sector #04-01, Singapore 349276 |
| pickup_contact | yes | Alan |
| pickup_phone | yes | 91234567 |
| delivery_address | yes | 5 Toh Guan Rd E #02-03, Singapore 608831 |
| delivery_contact | yes | Ms Lim |
| delivery_phone | yes | 98765432 |
| item_description | yes | 2 x server chassis |
| weight_kg | no | 18 |
| vehicle_required | no | motorcycle / car / mpv / van_1_7m / van_2_4m / lorry_10ft … (blank = any) |
| pickup_by | no | 2026-09-28T14:00:00+08:00 (at least 30 min ahead) |
| deliver_by | no | 2026-09-28T17:00:00+08:00 |
| budget_min / budget_max | no | 12 / 18 — leave blank for our estimate |
| external_order_id | no | your own reference; prevents duplicates |
| instructions | no | "call on arrival, loading bay B" |

Email: admin@techchainglobal.com · WhatsApp: the TCG Express business number.

## 3. API (for integrations) — Shopify, WooCommerce, your WMS, Zapier
`POST https://app.techchainglobal.com/api/external/orders`
Header: `Authorization: Bearer <your API key>` · `Content-Type: application/json`
Ask us for a key — it is linked to your TCG business account, so jobs appear in your dashboard and are paid from your wallet like any other job.

```bash
curl -X POST https://app.techchainglobal.com/api/external/orders \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "external_order_id": "PO-10021",
    "item_description": "2 x server chassis",
    "weight_kg": 18,
    "vehicle_required": "van_1_7m",
    "pickup_address": "1 Kallang Sector #04-01, Singapore 349276",
    "pickup_contact": "Alan", "pickup_phone": "91234567",
    "delivery_address": "5 Toh Guan Rd E #02-03, Singapore 608831",
    "delivery_contact": "Ms Lim", "delivery_phone": "98765432",
    "pickup_by": "2026-09-28T14:00:00+08:00",
    "deliver_by": "2026-09-28T17:00:00+08:00",
    "urgency": "standard"
  }'
```
Response (HTTP 201): `{ "success": true, "job_id": "…", "job_number": "TCG-2026-00031", "status": "open", "tracking_url": "https://app.techchainglobal.com/track/…" }`
Status check: `GET /api/external/orders?order_id=PO-10021` (same header).
Duplicate `external_order_id` → HTTP 409 with the existing job.
Shopify / Lazada / Shopee order payloads are accepted as-is (tell us which platform when we issue the key).

**Zapier / Make (no code):** trigger = new order in your store or a new row in Google Sheets → action = *Webhooks: POST* to the URL above with the header and the JSON fields mapped from the row. Every new row becomes a TCG job within a minute.

**Status updates back to you:** driver assigned, picked up, delivered, confirmed — available on your dashboard now; webhook push to your URL on request.
