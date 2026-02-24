// Input validation & sanitization utilities

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_TAG_RE = /<[^>]*>/g;

/** Strip HTML/script tags from a string */
export function stripTags(str) {
  if (typeof str !== 'string') return '';
  return str.replace(HTML_TAG_RE, '').trim();
}

/** Validate and sanitize a string field */
export function cleanString(val, maxLen = 500) {
  if (val == null) return null;
  if (typeof val !== 'string') return null;
  return stripTags(val).slice(0, maxLen);
}

/** Validate a required string field */
export function requireString(val, fieldName, maxLen = 500) {
  if (val == null || typeof val !== 'string') {
    return { error: `${fieldName} is required` };
  }
  const cleaned = stripTags(val).slice(0, maxLen);
  if (!cleaned) {
    return { error: `${fieldName} is required` };
  }
  return { value: cleaned };
}

/** Validate a positive finite number */
export function requirePositiveNumber(val, fieldName) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || typeof num !== 'number' || !isFinite(num) || num <= 0) {
    return { error: `${fieldName} must be a positive number` };
  }
  return { value: num };
}

/** Validate a non-negative finite number */
export function requireNonNegativeNumber(val, fieldName) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || typeof num !== 'number' || !isFinite(num) || num < 0) {
    return { error: `${fieldName} must be a non-negative number` };
  }
  return { value: num };
}

/** Validate a number within range */
export function requireNumberInRange(val, fieldName, min, max) {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || typeof num !== 'number' || !isFinite(num) || num < min || num > max) {
    return { error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { value: num };
}

/** Validate UUID format */
export function requireUUID(val, fieldName) {
  if (!val || typeof val !== 'string' || !UUID_RE.test(val)) {
    return { error: `${fieldName} must be a valid UUID` };
  }
  return { value: val };
}

/** Optionally validate UUID (null is OK) */
export function optionalUUID(val, fieldName) {
  if (val == null || val === '') return { value: null };
  return requireUUID(val, fieldName);
}

/** Validate email format */
export function requireEmail(val, fieldName = 'Email') {
  if (!val || typeof val !== 'string') {
    return { error: `${fieldName} is required` };
  }
  const email = val.trim().toLowerCase().slice(0, 254);
  if (!EMAIL_RE.test(email)) {
    return { error: `${fieldName} is not valid` };
  }
  return { value: email };
}

/** Validate enum membership */
export function requireEnum(val, allowed, fieldName) {
  if (!val || !allowed.includes(val)) {
    return { error: `${fieldName} must be one of: ${allowed.join(', ')}` };
  }
  return { value: val };
}

/** Validate latitude */
export function requireLatitude(val, fieldName = 'Latitude') {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || !isFinite(num) || num < -90 || num > 90) {
    return { error: `${fieldName} must be between -90 and 90` };
  }
  return { value: num };
}

/** Validate longitude */
export function requireLongitude(val, fieldName = 'Longitude') {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (num == null || !isFinite(num) || num < -180 || num > 180) {
    return { error: `${fieldName} must be between -180 and 180` };
  }
  return { value: num };
}

/**
 * Run multiple validations and return the first error or all values.
 * Usage: const { error, values } = validateAll(
 *   ['jobId', requireUUID(body.jobId, 'Job ID')],
 *   ['amount', requirePositiveNumber(body.amount, 'Amount')],
 * );
 */
export function validateAll(...fields) {
  const values = {};
  for (const [key, result] of fields) {
    if (result.error) return { error: result.error };
    values[key] = result.value;
  }
  return { values };
}
