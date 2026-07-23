"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
/**
 * Rejects non-admin users with 403.
 * Must run AFTER authenticate + requireAuth.
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: "Authentication required." });
        return;
    }
    if (req.user.role !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return;
    }
    next();
}
