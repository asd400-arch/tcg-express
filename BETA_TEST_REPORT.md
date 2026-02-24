# Beta Test Report — TCG Express

**Date:** 2026-02-25
**Build:** Next.js 16.1.6 (Turbopack) — Production build PASSING
**Branch:** master

---

## Phase 1: Critical Fixes

### 1. Driver Login — Password Not Sanitized
**Status:** FIXED (commits `47fad05`, `4c94754`)

**Root Cause:** Two issues:
- CSRF origin check was blocking login POST requests (ran before public path bypass)
- Beta accounts (`beta-driver1@techchainglobal.com / Beta2026!`) had plain-text passwords in DB that were never bcrypt-hashed. `bcrypt.compare("Beta2026!", "Beta2026!")` fails because the stored value is not a valid bcrypt hash.

**Fix:**
- Moved PUBLIC_API_PATHS check before CSRF validation in middleware.js
- Restored plain-text password fallback with auto-upgrade: on successful plain-text match, password is hashed with `bcrypt.hash(password, 12)` and saved to DB
- Increased login rate limit from 5/min to 10/min
- Password is never sanitized/stripped — goes raw into `bcrypt.compare()`

### 2. Wallet Balance Mismatch ($185.50 shown vs -$142.50 actual)
**Status:** FIXED (commit `f5aa685`)

**Root Cause:** Legacy `/api/bids/[id]/accept` route created escrow in `express_transactions` but **never debited `wallets.balance`** or created `wallet_transactions` records. The wallet page reads `wallet.balance` from DB, which was never decremented.

**Fix:**
- Rewrote `/api/bids/[id]/accept` to use atomic `process_bid_acceptance` RPC (same as `/api/wallet/pay` and instant-accept)
- All bid acceptance paths now atomically: lock wallet → check balance → debit → accept bid → assign job → create escrow
- Added wallet balance check to `POST /api/jobs` — blocks job creation when `balance < budget_min`
- Added client-side balance check in job creation form with insufficient balance modal

**Note:** Historical balance for beta-customer1 needs manual DB correction via Supabase SQL Editor. Going forward, all paths are correct.

### 3. Vehicle Bid Validation
**Status:** FIXED (commits `7ab43e6`, `eae997a`)

**Root Cause:** Two issues:
- `checkVehicleFit()` was missing from bid and instant-accept routes
- Legacy vehicle keys (`van`, `truck`) returned index -1 from `getVehicleModeIndex()`, causing validation bypass

**Fix:**
- Added `LEGACY_VEHICLE_MAP` and `normalizeVehicleKey()` to convert old keys (van→van_1_7m, truck→lorry_10ft, etc.)
- `checkVehicleFit()` uses numeric index comparison (`driverIdx >= jobIdx`) — not string comparison
- Applied to both `/api/bids` POST and `/api/jobs/[id]/instant-accept` POST

### 4. Signature Save on Mobile
**Status:** FIXED (commit `07e29d7`)

**Fix:** Replaced `fetch(dataUrl)` blob conversion with `atob()` + manual `Uint8Array` construction for mobile browser compatibility. Added `ensureBucket()` auto-create for Supabase Storage.

### 5. Mobile Header Overlap
**Status:** FIXED (commit `07e29d7`)

**Fix:** Added 80px top padding on driver jobs and my-jobs pages so content clears the fixed header.

---

## Phase 2: Feature Testing Summary

### Authentication
| Test | Route | Status |
|------|-------|--------|
| Customer login | POST /api/auth/login | FIXED — bcrypt + plain-text fallback |
| Driver login | POST /api/auth/login | FIXED — auto-upgrade to bcrypt on first login |
| Admin login | POST /api/auth/login | OK — same route, role-based redirect |
| Signup | POST /api/auth/signup | OK — bcrypt hash, email verification |
| CSRF protection | middleware.js | FIXED — login/signup excluded from CSRF check |
| Rate limiting | login: 10/min, signup: 5/hr | OK |

### Job Creation
| Test | Status |
|------|--------|
| Create job with sufficient balance | OK — job inserted, drivers notified |
| Create job with insufficient balance (API) | FIXED — returns 400 with available/required amounts |
| Create job with insufficient balance (UI) | FIXED — modal shows Required/Balance/Shortfall + "Top Up Now" |
| Vehicle type validation | OK — validated against VALID_VEHICLE_KEYS + legacy keys |

### Bid Flow
| Test | Status |
|------|--------|
| Driver places bid | OK — rate limited (20/min), UUID validated |
| Driver instant-accept | OK — atomic RPC, vehicle validation, wallet debit |
| Customer accepts bid via /api/wallet/pay | OK — atomic RPC, coupon support, idempotent |
| Customer accepts bid via /api/bids/[id]/accept | FIXED — now uses atomic RPC (was the balance mismatch root cause) |
| Insufficient balance on bid accept | FIXED — modal with shortfall + "Top Up Now" + auto-retry via sessionStorage |
| Vehicle size enforcement | OK — motorcycle cannot bid on van/lorry jobs |

### Delivery Flow
| Test | Status |
|------|--------|
| Update job status (pickup/delivered) | OK — enum validated, rate limited |
| Upload pickup/delivery photos | OK — rate limited (20/min), MIME validated (images only) |
| Signature capture | FIXED — atob blob conversion for mobile, auto-create bucket |
| PDF invoice generation | OK — photos constrained with fit box |

### Payment Flow
| Test | Status |
|------|--------|
| Customer confirms delivery | OK — release_payment RPC, atomic |
| Driver wallet credited | OK — earning + wallet_transaction created |
| Escrow → paid transition | OK — idempotent, locked FOR UPDATE |

### Wallet
| Test | Status |
|------|--------|
| Balance display | OK — reads wallets.balance from DB directly |
| Monthly spent/earned | OK — aggregates from wallet_transactions |
| Top-up via PayNow | OK — QR generated, pending until confirmed |
| Withdrawal request | OK — balance check, daily/monthly limits, wallet_debit RPC |
| Top-up prefill from redirect | OK — ?topup= query param auto-opens modal |

### Reviews & Disputes
| Test | Status |
|------|--------|
| Submit review | OK — rate limited, UUID validated, rating range checked |
| Create dispute | OK — rate limited, enum/UUID/string validated |
| Resolve dispute | OK — refund/release atomic, error logs cleaned |

### Help Center
| Test | Status |
|------|--------|
| FAQ search | OK — /api/help endpoint |
| AI chatbot | OK — /api/help/chat |
| Ticket creation | OK — try/catch added, AI auto-response |

### RFQ / Corp Premium
| Test | Status |
|------|--------|
| RFQ upload | OK — PDF allowed for rfq bucket |
| Corp Premium submission | OK — /api/corp-premium |

---

## Phase 3: Code Quality

### Build
- `npm run build` — **PASSING** (108 pages, 0 errors)
- TypeScript compilation — **OK**
- Turbopack production build — **9.3s compile time**

### Error Handling
- **7 API route files** were missing try/catch blocks — **FIXED** (commit `f07bd83`)
  - admin/stripe-status, admin/geo-zones (4 handlers), coupons (2), support/tickets (2), banners (2), consolidation-groups (2), bids/[id] DELETE

### Sensitive Logging
- **12 console.error statements** were logging DB error codes, details, and hints — **FIXED**
  - Simplified to log only error.message
  - Files: disputes/route.js, disputes/resolve/route.js, wallet/topup/route.js, jobs/[id]/route.js
- **1 debug console.log** in `checkVehicleFit` — **REMOVED**

### Parameterized Queries
- All Supabase queries use `.eq('field', value)` pattern (parameterized) ✅
- 2 uses of `.or()` with string interpolation use `session.userId` from verified JWT — **safe by design** (Supabase `.or()` requires string syntax)
- Warehouse inventory search filter — **previously fixed** to sanitize input before `.or()` interpolation

---

## Commits in This Sprint

| Commit | Description |
|--------|-------------|
| `f07bd83` | Add try/catch to 7 API routes, clean verbose error logs, remove debug log |
| `f5aa685` | Wallet balance — atomic bid acceptance, job creation balance check |
| `47fad05` | Restore plain-text password fallback with auto-upgrade to bcrypt |
| `4c94754` | Exclude login/signup from CSRF check + increase login rate limit to 10/min |
| `eae997a` | Vehicle validation with legacy key support + insufficient balance modal |
| `7ab43e6` | Enforce vehicle size validation on both Bid and Accept endpoints |
| `b5f6b5c` | CSRF origin allow Vercel URLs + fix Accept $null budget display |
| `b92c5a7` | Correct column names in RLS migration |
| `ffb7bc9` | Security hardening — input validation, CSRF, rate limiting, RLS tightening |
| `ece1704` | Defensive coding — atomic transactions, idempotency, race guards |
| `07e29d7` | Fix signature save, wallet error recipient, mobile header overlap |

---

## Known Issues / Follow-up Items

1. **Historical wallet balance** for beta-customer1 is wrong ($185.50) due to past legacy bid acceptances that bypassed wallet debit. Needs manual DB correction via Supabase SQL Editor.
2. **migrate-passwords.sql** should be run to batch-upgrade any remaining plain-text passwords in the DB.
3. **sameSite: 'strict'** cookie may cause issues with cross-site navigation (e.g., clicking links from emails). Monitor and consider reverting to 'lax' if users report being logged out after clicking email links.
4. **RLS policies** from `security-hardening-rls.sql` need to be verified as applied in production Supabase.
