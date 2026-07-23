/**
 * Application-wide constants.
 * Keep all magic numbers and feature names here — never hardcode them inline.
 */

// ── Session / Auth ────────────────────────────────────────────────────────────
export const COOKIE_NAME = "g3d_session";
export const SESSION_DAYS_DEFAULT = 1; // Regular session: 24h
export const SESSION_DAYS_REMEMBER = 30; // "Remember me": 30 days
export const BCRYPT_ROUNDS = 12;
export const MAX_FAILED_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

// ── Token TTLs ────────────────────────────────────────────────────────────────
export const EMAIL_VERIFICATION_HOURS = 24;
export const PASSWORD_RESET_HOURS = 1;

// ── Subscription / Billing ────────────────────────────────────────────────────
/** Days after payment failure before subscription is revoked */
export const GRACE_PERIOD_DAYS = 3;

/** Default free plan slug — used when a user has no subscription */
export const FREE_PLAN_SLUG = "free";

// ── Graphs ────────────────────────────────────────────────────────────────────
export const MAX_GRAPH_DATA_BYTES = 200 * 1024; // 200 KB
export const MAX_GRAPH_TITLE_LENGTH = 120;
export const MAX_GRAPH_DESCRIPTION_LENGTH = 500;
export const MAX_VERSIONS_KEPT = 50; // Oldest versions pruned beyond this

// ── Feature names ─────────────────────────────────────────────────────────────
// These are the canonical feature identifiers.
// NEVER check plan names (user.plan === 'pro'). ALWAYS check feature names.
export const FEATURES = {
  // 3D graphing features
  ADVANCED_3D: "advanced_3d",
  GPU_RENDERING: "gpu_rendering",
  ANIMATION: "animation",

  // Export
  HIGH_RESOLUTION_EXPORT: "high_resolution_export",
  EXPORT_VIDEO: "export_video",
  EXPORT_STL: "export_stl",

  // Projects
  PRIVATE_PROJECTS: "private_projects",
  UNLIMITED_PROJECTS: "unlimited_projects",

  // Sharing
  GRAPH_SHARING: "graph_sharing",
  EMBED_GRAPHS: "embed_graphs",

  // API
  API_ACCESS: "api_access",

  // AI
  AI_ASSISTANT: "ai_assistant",

  // Storage
  CLOUD_STORAGE: "cloud_storage",

  // Version history
  VERSION_HISTORY: "version_history",

  // Collaboration (future)
  TEAM_GRAPHS: "team_graphs",
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

// ── Rate Limits ───────────────────────────────────────────────────────────────
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 200; // General API limit
export const RATE_LIMIT_AUTH_MAX = 20; // Auth endpoints (login/signup)
export const RATE_LIMIT_WEBHOOK_MAX = 1000; // Webhooks (high volume from provider)

// ── API ───────────────────────────────────────────────────────────────────────
export const API_VERSION = "v1";
