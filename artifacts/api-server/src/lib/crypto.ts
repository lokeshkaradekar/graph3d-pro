/**
 * Cryptographic utilities for Graph3D Auth
 *
 * All raw tokens (session, verification, reset) are:
 *   1. Generated with crypto.randomBytes (CSPRNG)
 *   2. Stored in the database ONLY as SHA-256 hashes
 *   3. Sent to the user via cookie or email as raw hex
 *
 * This means a full database dump cannot be replayed — an attacker
 * would need to reverse SHA-256 from a 32-byte random input.
 */
import { createHash, randomBytes } from "crypto";

/** Generate a cryptographically secure random hex token */
export function generateToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("hex");
}

/** SHA-256 hash a token for safe database storage */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a short random ID (URL-safe, alphanumeric) */
export function generateShortId(byteLength = 8): string {
  return randomBytes(byteLength).toString("base64url");
}

/** Generate a share token for public graph links */
export function generateShareToken(): string {
  return randomBytes(12).toString("base64url"); // 16 URL-safe chars
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * Use this when comparing secrets/tokens.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Get client IP from request (handles proxies) */
export function getClientIp(
  headers: Record<string, string | string[] | undefined>,
  remoteAddress?: string,
): string | null {
  const forwarded = headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(",")[0]!.trim();
  }
  return remoteAddress ?? null;
}

/** Current period identifier for usage tracking (YYYY-MM) */
export function currentMonthPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Current year period identifier for usage tracking (YYYY) */
export function currentYearPeriod(): string {
  return String(new Date().getUTCFullYear());
}
