/**
 * V-43 / A2-17 — minimal IPv4 + IPv4-CIDR allowlist matcher.
 *
 * Hand-rolled (no `ip-range-check` dependency) to avoid a dep-add gate
 * for a ~25-line need. Supports:
 *   - exact IPv4:        "203.0.113.4"
 *   - IPv4 CIDR ranges:  "203.0.113.0/24", "10.0.0.0/8"
 *   - CSV of the above:  "203.0.113.4,10.0.0.0/8"
 *
 * IPv6 is gracefully skipped (returns no-match) — admin allowlists are
 * IPv4 in practice, and silently mis-parsing an IPv6 literal as IPv4
 * would be worse than an explicit no-match. If IPv6 support is ever
 * needed, switch to a vetted library (tracked as a future follow-up).
 *
 * Security note: a malformed allowlist entry is treated as "matches
 * nothing" (fail-closed for that entry) — a typo in config can only
 * make the allowlist MORE restrictive, never less.
 */

/** Parse a dotted-quad IPv4 string into a 32-bit unsigned integer, or null. */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    // Reject empty, non-numeric, leading-zero-ambiguous, or out-of-range octets.
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    result = (result << 8) | octet;
  }
  // >>> 0 coerces to unsigned 32-bit (left-shift can produce negatives in JS).
  return result >>> 0;
}

/**
 * Does `ip` match a single allowlist `entry` (exact IPv4 or IPv4 CIDR)?
 */
function matchesEntry(ip: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (!trimmed) return false;

  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false; // non-IPv4 client (e.g. IPv6) → no match

  if (trimmed.includes('/')) {
    // CIDR range.
    const [network, prefixStr] = trimmed.split('/');
    const prefix = Number(prefixStr);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return false;

    const networkInt = ipv4ToInt(network);
    if (networkInt === null) return false;

    if (prefix === 0) return true; // 0.0.0.0/0 matches everything
    // Build the prefix mask. (prefix is 1..32 here, so the shift is safe.)
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (networkInt & mask);
  }

  // Exact IPv4 match.
  const entryInt = ipv4ToInt(trimmed);
  return entryInt !== null && entryInt === ipInt;
}

/**
 * V-43 — is `ip` allowed by the CSV `allowlist`?
 *
 * Returns `true` when the allowlist is empty/undefined (feature disabled —
 * all IPs allowed) OR when `ip` matches at least one CSV entry.
 *
 * @param ip         the client IP (from x-forwarded-for[0] or socket addr)
 * @param allowlist  CSV of IPv4 / IPv4-CIDR entries; empty = disabled
 */
export function isIpAllowed(ip: string | undefined, allowlist: string): boolean {
  const csv = (allowlist ?? '').trim();
  if (!csv) return true; // feature disabled — no restriction

  if (!ip) return false; // allowlist active but we can't determine the IP → deny

  return csv
    .split(',')
    .some((entry) => matchesEntry(ip, entry));
}
