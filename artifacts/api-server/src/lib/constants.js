"use strict";
/**
 * Application-wide constants.
 * Keep all magic numbers and feature names here — never hardcode them inline.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_VERSION = exports.RATE_LIMIT_WEBHOOK_MAX = exports.RATE_LIMIT_AUTH_MAX = exports.RATE_LIMIT_MAX_REQUESTS = exports.RATE_LIMIT_WINDOW_MS = exports.FEATURES = exports.MAX_VERSIONS_KEPT = exports.MAX_GRAPH_DESCRIPTION_LENGTH = exports.MAX_GRAPH_TITLE_LENGTH = exports.MAX_GRAPH_DATA_BYTES = exports.FREE_PLAN_SLUG = exports.GRACE_PERIOD_DAYS = exports.PASSWORD_RESET_HOURS = exports.EMAIL_VERIFICATION_HOURS = exports.LOCKOUT_MINUTES = exports.MAX_FAILED_LOGIN_ATTEMPTS = exports.BCRYPT_ROUNDS = exports.SESSION_DAYS_REMEMBER = exports.SESSION_DAYS_DEFAULT = exports.COOKIE_NAME = void 0;
// ── Session / Auth ────────────────────────────────────────────────────────────
exports.COOKIE_NAME = "g3d_session";
exports.SESSION_DAYS_DEFAULT = 1; // Regular session: 24h
exports.SESSION_DAYS_REMEMBER = 30; // "Remember me": 30 days
exports.BCRYPT_ROUNDS = 12;
exports.MAX_FAILED_LOGIN_ATTEMPTS = 5;
exports.LOCKOUT_MINUTES = 15;
// ── Token TTLs ────────────────────────────────────────────────────────────────
exports.EMAIL_VERIFICATION_HOURS = 24;
exports.PASSWORD_RESET_HOURS = 1;
// ── Subscription / Billing ────────────────────────────────────────────────────
/** Days after payment failure before subscription is revoked */
exports.GRACE_PERIOD_DAYS = 3;
/** Default free plan slug — used when a user has no subscription */
exports.FREE_PLAN_SLUG = "free";
// ── Graphs ────────────────────────────────────────────────────────────────────
exports.MAX_GRAPH_DATA_BYTES = 200 * 1024; // 200 KB
exports.MAX_GRAPH_TITLE_LENGTH = 120;
exports.MAX_GRAPH_DESCRIPTION_LENGTH = 500;
exports.MAX_VERSIONS_KEPT = 50; // Oldest versions pruned beyond this
// ── Feature names ─────────────────────────────────────────────────────────────
// These are the canonical feature identifiers.
// NEVER check plan names (user.plan === 'pro'). ALWAYS check feature names.
exports.FEATURES = {
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
};
// ── Rate Limits ───────────────────────────────────────────────────────────────
exports.RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
exports.RATE_LIMIT_MAX_REQUESTS = 200; // General API limit
exports.RATE_LIMIT_AUTH_MAX = 20; // Auth endpoints (login/signup)
exports.RATE_LIMIT_WEBHOOK_MAX = 1000; // Webhooks (high volume from provider)
// ── API ───────────────────────────────────────────────────────────────────────
exports.API_VERSION = "v1";
