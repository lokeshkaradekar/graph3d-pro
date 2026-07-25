/**
 * Shared brand constants for transactional email.
 *
 * The accent color intentionally matches the app's own `--accent`
 * design token (#3b82f6) used throughout the Graph3D UI — emails should
 * look like they came from the same product, not a generic mailer.
 */
export const APP_NAME = "Graph3D";
export const APP_URL = process.env["APP_URL"] ?? "https://graph3d.app";
export const SUPPORT_EMAIL = process.env["SUPPORT_EMAIL"] ?? "support@graph3d.app";

/** Resend accepts "Display Name <address>" directly in the `from` field. */
export const FROM_EMAIL =
  process.env["RESEND_FROM"] ?? `${APP_NAME} <noreply@graph3d.app>`;

export const BRAND = {
  accent: "#3b82f6",
  ink: "#0f172a",
  inkSoft: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  surface: "#f8fafc",
  danger: "#e11d48",
  white: "#ffffff",
} as const;
