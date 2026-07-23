"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
exports.destroySession = destroySession;
exports.destroyAllUserSessions = destroyAllUserSessions;
exports.getUserFromToken = getUserFromToken;
exports.getTokenFromRequest = getTokenFromRequest;
exports.setSessionCookie = setSessionCookie;
exports.clearSessionCookie = clearSessionCookie;
exports.pruneExpiredSessions = pruneExpiredSessions;
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var crypto_1 = require("../lib/crypto");
var constants_1 = require("../lib/constants");
function createSession(userId_1, req_1) {
    return __awaiter(this, arguments, void 0, function (userId, req, rememberMe) {
        var token, tokenHash, days, expiresAt, userAgent, ipAddress, session;
        var _a, _b;
        if (rememberMe === void 0) { rememberMe = false; }
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    token = (0, crypto_1.generateToken)(32);
                    tokenHash = (0, crypto_1.hashToken)(token);
                    days = rememberMe ? constants_1.SESSION_DAYS_REMEMBER : constants_1.SESSION_DAYS_DEFAULT;
                    expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
                    userAgent = ((_a = req.headers["user-agent"]) !== null && _a !== void 0 ? _a : "").slice(0, 300);
                    ipAddress = (0, crypto_1.getClientIp)(req.headers, (_b = req.socket) === null || _b === void 0 ? void 0 : _b.remoteAddress);
                    return [4 /*yield*/, db_1.db
                            .insert(db_2.sessionsTable)
                            .values({
                            userId: userId,
                            tokenHash: tokenHash,
                            userAgent: userAgent,
                            ipAddress: ipAddress,
                            rememberMe: rememberMe,
                            expiresAt: expiresAt,
                        })
                            .returning()];
                case 1:
                    session = (_c.sent())[0];
                    if (!session)
                        throw new Error("Failed to create session");
                    return [2 /*return*/, { token: token, expiresAt: expiresAt, session: session }];
            }
        });
    });
}
function destroySession(token) {
    return __awaiter(this, void 0, void 0, function () {
        var tokenHash;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/];
                    tokenHash = (0, crypto_1.hashToken)(token);
                    return [4 /*yield*/, db_1.db.delete(db_2.sessionsTable).where((0, drizzle_orm_1.eq)(db_2.sessionsTable.tokenHash, tokenHash))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function destroyAllUserSessions(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db.delete(db_2.sessionsTable).where((0, drizzle_orm_1.eq)(db_2.sessionsTable.userId, userId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getUserFromToken(token) {
    return __awaiter(this, void 0, void 0, function () {
        var tokenHash, now, result, row;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/, null];
                    tokenHash = (0, crypto_1.hashToken)(token);
                    now = new Date();
                    return [4 /*yield*/, db_1.db
                            .select({
                            id: db_2.usersTable.id,
                            email: db_2.usersTable.email,
                            emailNormalized: db_2.usersTable.emailNormalized,
                            displayName: db_2.usersTable.displayName,
                            avatarUrl: db_2.usersTable.avatarUrl,
                            role: db_2.usersTable.role,
                            isVerified: db_2.usersTable.isVerified,
                            sessionId: db_2.sessionsTable.id,
                            expiresAt: db_2.sessionsTable.expiresAt,
                        })
                            .from(db_2.sessionsTable)
                            .innerJoin(db_2.usersTable, (0, drizzle_orm_1.eq)(db_2.sessionsTable.userId, db_2.usersTable.id))
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.sessionsTable.tokenHash, tokenHash), (0, drizzle_orm_1.gt)(db_2.sessionsTable.expiresAt, now)))
                            .limit(1)];
                case 1:
                    result = _a.sent();
                    row = result[0];
                    if (!row)
                        return [2 /*return*/, null];
                    // User is soft-deleted — treat as no session
                    // (deleted users will have no rows due to cascade, but double-check)
                    // Update last active timestamp in background (fire-and-forget)
                    db_1.db.update(db_2.sessionsTable)
                        .set({ lastActiveAt: now })
                        .where((0, drizzle_orm_1.eq)(db_2.sessionsTable.id, row.sessionId))
                        .catch(function () { });
                    return [2 /*return*/, {
                            id: row.id,
                            email: row.email,
                            emailNormalized: row.emailNormalized,
                            displayName: row.displayName,
                            avatarUrl: row.avatarUrl,
                            role: row.role,
                            isVerified: row.isVerified,
                        }];
            }
        });
    });
}
function getTokenFromRequest(req) {
    // cookie-parser middleware must be active
    var cookies = req
        .cookies;
    return cookies === null || cookies === void 0 ? void 0 : cookies[constants_1.COOKIE_NAME];
}
function setSessionCookie(res, token, rememberMe, expiresAt) {
    var maxAge = rememberMe
        ? constants_1.SESSION_DAYS_REMEMBER * 24 * 60 * 60
        : constants_1.SESSION_DAYS_DEFAULT * 24 * 60 * 60;
    res.cookie(constants_1.COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        path: "/",
        maxAge: maxAge * 1000, // express cookie maxAge is in ms
    });
}
function clearSessionCookie(res) {
    res.cookie(constants_1.COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
    });
}
/** Periodic cleanup of expired sessions (run via a scheduled job) */
function pruneExpiredSessions() {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .delete(db_2.sessionsTable)
                        .where((0, drizzle_orm_1.lt)(db_2.sessionsTable.expiresAt, new Date()))
                        .returning({ id: db_2.sessionsTable.id })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.length];
            }
        });
    });
}
