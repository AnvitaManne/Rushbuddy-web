/**
 * Pure org/email helpers (unit-testable; no I/O).
 */

/** Lowercase domain without `@`, or null if the address has no usable domain. */
export function extractEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
}

/** True when email’s domain is listed on the org (case-insensitive). */
export function emailDomainAllowed(email: string, emailDomains: string[]): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return emailDomains.some((d) => d.trim().toLowerCase() === domain);
}
