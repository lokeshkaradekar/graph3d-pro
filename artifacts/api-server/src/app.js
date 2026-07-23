"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var helmet_1 = require("helmet");
var cookie_parser_1 = require("cookie-parser");
var pino_http_1 = require("pino-http");
var path_1 = require("path");
var url_1 = require("url");
var routes_1 = require("./routes");
var logger_1 = require("./lib/logger");
var rate_limit_1 = require("./middlewares/rate-limit");
var __dirname = path_1.default.dirname((0, url_1.fileURLToPath)(import.meta.url));
var app = (0, express_1.default)();
// ── Security headers ──────────────────────────────────────────────────────────
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
// ── Request logging ───────────────────────────────────────────────────────────
app.use((0, pino_http_1.default)({
    logger: logger_1.logger,
    serializers: {
        req: function (req) {
            var _a;
            return { id: req.id, method: req.method, url: (_a = req.url) === null || _a === void 0 ? void 0 : _a.split("?")[0] };
        },
        res: function (res) {
            return { statusCode: res.statusCode };
        },
    },
}));
// ── CORS ──────────────────────────────────────────────────────────────────────
var allowedOrigins = ((_a = process.env["CORS_ORIGINS"]) !== null && _a !== void 0 ? _a : "")
    .split(",")
    .map(function (o) { return o.trim(); })
    .filter(Boolean);
if (process.env["NODE_ENV"] !== "production") {
    allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
}
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        callback(new Error("CORS: origin '".concat(origin, "' not allowed")));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
}));
// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express_1.default.json({ limit: "1mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "1mb" }));
// ── Cookie parsing ────────────────────────────────────────────────────────────
app.use((0, cookie_parser_1.default)());
// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(rate_limit_1.generalLimiter);
// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", routes_1.default);
// ── Static frontend files ─────────────────────────────────────────────────────
// Serve the static frontend. In production, the public/ dir is bundled with
// the server. In development, files are served directly from the source tree.
var publicDir = path_1.default.join(__dirname, "..", "public");
app.use(express_1.default.static(publicDir, { maxAge: "1h" }));
// ── SPA fallback — serve index.html for non-API routes ────────────────────────
app.get(/^(?!\/api).*/, function (req, res) {
    // Specific named routes
    var url = req.path;
    if (url === "/login" || url === "/login.html") {
        res.sendFile(path_1.default.join(publicDir, "login.html"));
        return;
    }
    if (url === "/landing" || url === "/landing.html") {
        res.sendFile(path_1.default.join(publicDir, "landing.html"));
        return;
    }
    res.sendFile(path_1.default.join(publicDir, "index.html"));
});
// ── 404 handler (API only) ────────────────────────────────────────────────────
app.use("/api", function (_req, res) {
    res.status(404).json({ error: "Not found." });
});
// ── Error handler ─────────────────────────────────────────────────────────────
app.use(function (err, _req, res, _next) {
    logger_1.logger.error({ err: err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error." });
});
exports.default = app;
