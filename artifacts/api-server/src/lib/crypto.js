"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.hashToken = hashToken;
exports.generateShortId = generateShortId;
exports.generateShareToken = generateShareToken;
exports.safeCompare = safeCompare;
exports.getClientIp = getClientIp;
exports.currentMonthPeriod = currentMonthPeriod;
exports.currentYearPeriod = currentYearPeriod;
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
var crypto_1 = require("crypto");
/** Generate a cryptographically secure random hex token */
function generateToken(byteLength) {
    if (byteLength === void 0) { byteLength = 32; }
    return (0, crypto_1.randomBytes)(byteLength).toString("hex");
}
/** SHA-256 hash a token for safe database storage */
function hashToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
/** Generate a short random ID (URL-safe, alphanumeric) */
function generateShortId(byteLength) {
    if (byteLength === void 0) { byteLength = 8; }
    return (0, crypto_1.randomBytes)(byteLength).toString("base64url");
}
/** Generate a share token for public graph links */
function generateShareToken() {
    return (0, crypto_1.randomBytes)(12).toString("base64url"); // 16 URL-safe chars
}
/**
 * Constant-time string comparison to prevent timing attacks.
 * Use this when comparing secrets/tokens.
 */
function safeCompare(a, b) {
    if (a.length !== b.length)
        return false;
    var result = 0;
    for (var i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}
/** Get client IP from request (handles proxies) */
function getClientIp(headers, remoteAddress) {
    var forwarded = headers["x-forwarded-for"];
    if (forwarded) {
        var raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
        return raw.split(",")[0].trim();
    }
    return remoteAddress !== null && remoteAddress !== void 0 ? remoteAddress : null;
}
/** Current period identifier for usage tracking (YYYY-MM) */
function currentMonthPeriod() {
    var now = new Date();
    var y = now.getUTCFullYear();
    var m = String(now.getUTCMonth() + 1).padStart(2, "0");
    return "".concat(y, "-").concat(m);
}
/** Current year period identifier for usage tracking (YYYY) */
function currentYearPeriod() {
    return String(new Date().getUTCFullYear());
}
