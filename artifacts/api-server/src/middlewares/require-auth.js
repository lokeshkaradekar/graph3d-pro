"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
/**
 * Rejects unauthenticated requests with 401.
 * Must run AFTER authenticate middleware.
 */
function requireAuth(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: "Authentication required." });
        return;
    }
    next();
}
