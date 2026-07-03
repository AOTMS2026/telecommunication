// utils/phone.js
// Single source of truth for how phone numbers are stored across the app.
//
// Rule: leads are always stored as the last 10 digits only — no country
// code, no +, no spaces/dashes. This keeps matching (call-recording
// auto-link, dedupe on import, search) a simple exact-string comparison
// instead of a fuzzy regex.

/**
 * Normalize any phone-ish input down to its last 10 digits.
 * Returns '' if fewer than 10 digits are present.
 *
 *   "+91 98765-43210"   -> "9876543210"
 *   "0091-9876543210"   -> "9876543210"
 *   "919876543210"      -> "9876543210"  (12-digit with country code)
 *   "9876543210"        -> "9876543210"
 *   "12345"             -> ""            (too short to be a real number)
 */
function normalizePhone10(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 10) return digits; // leave short/invalid values untouched, don't lose data
  return digits.slice(-10);
}

/**
 * Build the full international-format number (91XXXXXXXXXX, no leading +)
 * from a stored lead phone, for external APIs (WhatsApp Cloud API, etc.)
 * that need the country code. Leads themselves are stored as bare 10
 * digits — see normalizePhone10 — so this is applied at the call site,
 * the same pattern already used by services/aiCaller/dialer.js for Exotel.
 */
function toIndiaE164(value) {
  const last10 = normalizePhone10(value);
  return last10.length === 10 ? `91${last10}` : last10;
}

module.exports = { normalizePhone10, toIndiaE164 };