// Anti-abuse gate for launch promo codes (FIRST10, HANSIK10, …).
//
// 1. Business verification: the account must carry a Singapore mobile number,
//    a company name and a valid UEN before a listed code can be applied.
// 2. Cross-account cap: coupon uses are counted across every client account that
//    shares the same UEN, mobile number or company name — so a second account
//    with a new email does not get a second S$100.
//
// Which codes are gated: express_settings key 'promo_require_uen_codes'
// (comma-separated), default FIRST10,HANSIK10.

import { supabaseAdmin } from './supabase-server';

const DEFAULT_GATED_CODES = ['FIRST10', 'HANSIK10'];

// ACRA business (8 digits + letter), local company (yyyy + 5 digits + letter),
// other entities (T/S/R + yy + 2 letters + 4 digits + letter), e.g. 53053108M, 202005872W, T09LL0001B
export const UEN_REGEX = /^(\d{8}[A-Z]|\d{9}[A-Z]|[TSR]\d{2}[A-Z]{2}\d{4}[A-Z])$/;

export function normalizeUEN(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function normalizePhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 10 && d.startsWith('65')) d = d.slice(2);
  return d;
}

export function normalizeCompany(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/\b(pte|ltd|limited|llp|llc|inc|co|company|singapore|sg)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

async function getGatedCodes() {
  try {
    const { data } = await supabaseAdmin.from('express_settings').select('value').eq('key', 'promo_require_uen_codes').maybeSingle();
    if (data?.value) {
      const raw = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
      const list = raw.replace(/[\[\]"']/g, '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (list.length) return list;
    }
  } catch {}
  return DEFAULT_GATED_CODES;
}

/**
 * @returns {Promise<{ok:true, linkedAccounts:number} | {ok:false, code:string, error:string}>}
 */
export async function checkPromoEligibility(promo, userId) {
  if (!promo || !userId) return { ok: true, linkedAccounts: 1 };
  const gated = await getGatedCodes();
  if (!gated.includes(String(promo.code || '').toUpperCase())) return { ok: true, linkedAccounts: 1 };

  const { data: u } = await supabaseAdmin
    .from('express_users')
    .select('id, role, phone, company_name, company_registration')
    .eq('id', userId)
    .single();
  if (!u) return { ok: false, code: 'no_account', error: 'Account not found' };

  const phone = normalizePhone(u.phone);
  const uen = normalizeUEN(u.company_registration);
  const companyRaw = String(u.company_name || '').trim();
  const company = normalizeCompany(companyRaw);

  const missing = [];
  if (!/^[3689]\d{7}$/.test(phone)) missing.push('Singapore mobile number');
  if (!companyRaw) missing.push('company name');
  if (!UEN_REGEX.test(uen)) missing.push('UEN (business registration number)');
  if (missing.length) {
    return {
      ok: false,
      code: 'profile_incomplete',
      error: `This offer is for registered Singapore businesses. Please add your ${missing.join(', ')} in Settings, then apply the code again.`,
    };
  }

  // Sibling accounts: same UEN, same mobile, or same company name (only safe characters go into the filter)
  const ors = [`company_registration.ilike.${uen}`, `phone.ilike.%${phone}`];
  if (company.length >= 4 && /^[A-Za-z0-9 .&'-]+$/.test(companyRaw)) ors.push(`company_name.ilike.${companyRaw}`);
  const ids = new Set([userId]);
  try {
    const { data: related } = await supabaseAdmin
      .from('express_users')
      .select('id, phone, company_name, company_registration')
      .eq('role', 'client')
      .or(ors.join(','));
    for (const r of related || []) {
      if (normalizeUEN(r.company_registration) === uen || normalizePhone(r.phone) === phone || (company.length >= 4 && normalizeCompany(r.company_name) === company)) {
        ids.add(r.id);
      }
    }
  } catch {}

  if (promo.per_user_limit) {
    const { count } = await supabaseAdmin
      .from('express_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', promo.id)
      .in('client_id', [...ids])
      .not('status', 'eq', 'cancelled');
    if ((count || 0) >= promo.per_user_limit) {
      return {
        ok: false,
        code: 'business_limit',
        error: `This offer has already been used ${promo.per_user_limit} times by your business${ids.size > 1 ? ' (across linked accounts)' : ''}.`,
      };
    }
  }
  return { ok: true, linkedAccounts: ids.size };
}
