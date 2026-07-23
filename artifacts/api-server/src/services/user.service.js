"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.normalizeEmail = normalizeEmail;
exports.isValidEmail = isValidEmail;
exports.validatePassword = validatePassword;
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.createUser = createUser;
exports.createEmailVerificationToken = createEmailVerificationToken;
exports.verifyEmail = verifyEmail;
exports.initiatePasswordReset = initiatePasswordReset;
exports.resetPassword = resetPassword;
exports.registerFailedLogin = registerFailedLogin;
exports.clearFailedLogins = clearFailedLogins;
exports.isAccountLocked = isAccountLocked;
exports.updateProfile = updateProfile;
exports.softDeleteUser = softDeleteUser;
var bcryptjs_1 = require("bcryptjs");
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var crypto_1 = require("../lib/crypto");
var constants_1 = require("../lib/constants");
var email_1 = require("../lib/email");
// ── Email / Password normalization ────────────────────────────────────────────
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function isValidEmail(email) {
    if (typeof email !== "string")
        return false;
    if (email.length === 0 || email.length > 254)
        return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function validatePassword(password) {
    if (typeof password !== "string" || password.length === 0) {
        return "Password is required.";
    }
    if (password.length < 8)
        return "Password must be at least 8 characters.";
    if (password.length > 200)
        return "Password is too long.";
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
        return "Password must include at least one letter and one number.";
    }
    return null;
}
// ── Password hashing ──────────────────────────────────────────────────────────
function hashPassword(password) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, bcryptjs_1.default.hash(password, constants_1.BCRYPT_ROUNDS)];
        });
    });
}
function verifyPassword(password, hash) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, bcryptjs_1.default.compare(password, hash)];
        });
    });
}
// ── User lookup ───────────────────────────────────────────────────────────────
function findUserByEmail(email) {
    return __awaiter(this, void 0, void 0, function () {
        var normalized, rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    normalized = normalizeEmail(email);
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.usersTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.usersTable.emailNormalized, normalized), (0, drizzle_orm_1.isNull)(db_2.usersTable.deletedAt)))
                            .limit(1)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, (_a = rows[0]) !== null && _a !== void 0 ? _a : null];
            }
        });
    });
}
function findUserById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var rows;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.usersTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.usersTable.id, id), (0, drizzle_orm_1.isNull)(db_2.usersTable.deletedAt)))
                        .limit(1)];
                case 1:
                    rows = _b.sent();
                    return [2 /*return*/, (_a = rows[0]) !== null && _a !== void 0 ? _a : null];
            }
        });
    });
}
function createUser(input) {
    return __awaiter(this, void 0, void 0, function () {
        var emailNormalized, passwordHash, displayName, user, verificationToken;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    emailNormalized = normalizeEmail(input.email);
                    return [4 /*yield*/, hashPassword(input.password)];
                case 1:
                    passwordHash = _c.sent();
                    displayName = (_b = (_a = input.displayName) === null || _a === void 0 ? void 0 : _a.trim().slice(0, 80)) !== null && _b !== void 0 ? _b : null;
                    return [4 /*yield*/, db_1.db
                            .insert(db_2.usersTable)
                            .values({
                            email: input.email.trim(),
                            emailNormalized: emailNormalized,
                            passwordHash: passwordHash,
                            displayName: displayName,
                        })
                            .returning()];
                case 2:
                    user = (_c.sent())[0];
                    if (!user)
                        throw new Error("Failed to create user");
                    return [4 /*yield*/, createEmailVerificationToken(user.id)];
                case 3:
                    verificationToken = _c.sent();
                    return [4 /*yield*/, (0, email_1.sendVerificationEmail)(user.email, verificationToken)];
                case 4:
                    _c.sent();
                    return [2 /*return*/, { user: user, verificationToken: verificationToken }];
            }
        });
    });
}
// ── Email verification ────────────────────────────────────────────────────────
function createEmailVerificationToken(userId) {
    return __awaiter(this, void 0, void 0, function () {
        var token, tokenHash, expiresAt;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = (0, crypto_1.generateToken)(32);
                    tokenHash = (0, crypto_1.hashToken)(token);
                    expiresAt = new Date(Date.now() + constants_1.EMAIL_VERIFICATION_HOURS * 60 * 60 * 1000);
                    // Invalidate any existing unused tokens for this user
                    return [4 /*yield*/, db_1.db
                            .delete(db_2.emailVerificationsTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.emailVerificationsTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.emailVerificationsTable.usedAt)))];
                case 1:
                    // Invalidate any existing unused tokens for this user
                    _a.sent();
                    return [4 /*yield*/, db_1.db.insert(db_2.emailVerificationsTable).values({
                            userId: userId,
                            tokenHash: tokenHash,
                            expiresAt: expiresAt,
                        })];
                case 2:
                    _a.sent();
                    return [2 /*return*/, token];
            }
        });
    });
}
function verifyEmail(token) {
    return __awaiter(this, void 0, void 0, function () {
        var tokenHash, now, row;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tokenHash = (0, crypto_1.hashToken)(token);
                    now = new Date();
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.emailVerificationsTable)
                            .where((0, drizzle_orm_1.eq)(db_2.emailVerificationsTable.tokenHash, tokenHash))
                            .limit(1)];
                case 1:
                    row = (_a.sent())[0];
                    if (!row)
                        return [2 /*return*/, { ok: false, error: "Invalid or expired verification link." }];
                    if (row.usedAt)
                        return [2 /*return*/, { ok: false, error: "This link has already been used." }];
                    if (row.expiresAt < now)
                        return [2 /*return*/, { ok: false, error: "This verification link has expired. Request a new one." }];
                    // Mark token used and verify user in a transaction
                    return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .update(db_2.emailVerificationsTable)
                                            .set({ usedAt: now })
                                            .where((0, drizzle_orm_1.eq)(db_2.emailVerificationsTable.id, row.id))];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, tx
                                                .update(db_2.usersTable)
                                                .set({ isVerified: true, updatedAt: now })
                                                .where((0, drizzle_orm_1.eq)(db_2.usersTable.id, row.userId))];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 2:
                    // Mark token used and verify user in a transaction
                    _a.sent();
                    return [2 /*return*/, { ok: true }];
            }
        });
    });
}
// ── Password reset ────────────────────────────────────────────────────────────
function initiatePasswordReset(email, req) {
    return __awaiter(this, void 0, void 0, function () {
        var user, token, tokenHash, expiresAt, ipAddress;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, findUserByEmail(email)];
                case 1:
                    user = _b.sent();
                    // Always return success to prevent email enumeration — don't reveal
                    // whether the address has an account
                    if (!user)
                        return [2 /*return*/];
                    token = (0, crypto_1.generateToken)(32);
                    tokenHash = (0, crypto_1.hashToken)(token);
                    expiresAt = new Date(Date.now() + constants_1.PASSWORD_RESET_HOURS * 60 * 60 * 1000);
                    ipAddress = (0, crypto_1.getClientIp)(req.headers, (_a = req.socket) === null || _a === void 0 ? void 0 : _a.remoteAddress);
                    // Invalidate old tokens
                    return [4 /*yield*/, db_1.db
                            .delete(db_2.passwordResetTokensTable)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.passwordResetTokensTable.userId, user.id), (0, drizzle_orm_1.isNull)(db_2.passwordResetTokensTable.usedAt)))];
                case 2:
                    // Invalidate old tokens
                    _b.sent();
                    return [4 /*yield*/, db_1.db.insert(db_2.passwordResetTokensTable).values({
                            userId: user.id,
                            tokenHash: tokenHash,
                            expiresAt: expiresAt,
                            ipAddress: ipAddress,
                        })];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, (0, email_1.sendPasswordResetEmail)(user.email, token)];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function resetPassword(token, newPassword) {
    return __awaiter(this, void 0, void 0, function () {
        var tokenHash, now, row, passwordHash;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    tokenHash = (0, crypto_1.hashToken)(token);
                    now = new Date();
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(db_2.passwordResetTokensTable)
                            .where((0, drizzle_orm_1.eq)(db_2.passwordResetTokensTable.tokenHash, tokenHash))
                            .limit(1)];
                case 1:
                    row = (_a.sent())[0];
                    if (!row)
                        return [2 /*return*/, { ok: false, error: "Invalid or expired reset link." }];
                    if (row.usedAt)
                        return [2 /*return*/, { ok: false, error: "This link has already been used." }];
                    if (row.expiresAt < now)
                        return [2 /*return*/, { ok: false, error: "This reset link has expired. Request a new one." }];
                    return [4 /*yield*/, hashPassword(newPassword)];
                case 2:
                    passwordHash = _a.sent();
                    return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .update(db_2.passwordResetTokensTable)
                                            .set({ usedAt: now })
                                            .where((0, drizzle_orm_1.eq)(db_2.passwordResetTokensTable.id, row.id))];
                                    case 1:
                                        _a.sent();
                                        return [4 /*yield*/, tx
                                                .update(db_2.usersTable)
                                                .set({ passwordHash: passwordHash, updatedAt: now, failedLoginAttempts: 0, lockedUntil: null })
                                                .where((0, drizzle_orm_1.eq)(db_2.usersTable.id, row.userId))];
                                    case 2:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 3:
                    _a.sent();
                    return [2 /*return*/, { ok: true, userId: row.userId }];
            }
        });
    });
}
// ── Brute-force protection ────────────────────────────────────────────────────
function registerFailedLogin(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    UPDATE users\n    SET\n      failed_login_attempts = failed_login_attempts + 1,\n      locked_until = CASE\n        WHEN failed_login_attempts + 1 >= ", "\n        THEN now() + (", " * INTERVAL '1 minute')\n        ELSE locked_until\n      END,\n      updated_at = now()\n    WHERE id = ", "\n  "], ["\n    UPDATE users\n    SET\n      failed_login_attempts = failed_login_attempts + 1,\n      locked_until = CASE\n        WHEN failed_login_attempts + 1 >= ", "\n        THEN now() + (", " * INTERVAL '1 minute')\n        ELSE locked_until\n      END,\n      updated_at = now()\n    WHERE id = ", "\n  "])), constants_1.MAX_FAILED_LOGIN_ATTEMPTS, constants_1.LOCKOUT_MINUTES, userId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function clearFailedLogins(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.usersTable)
                        .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_2.usersTable.id, userId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function isAccountLocked(user) {
    return !!user.lockedUntil && user.lockedUntil > new Date();
}
// ── Profile management ────────────────────────────────────────────────────────
function updateProfile(userId, updates) {
    return __awaiter(this, void 0, void 0, function () {
        var updated;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.usersTable)
                        .set(__assign(__assign(__assign({}, (updates.displayName !== undefined
                        ? { displayName: updates.displayName.trim().slice(0, 80) || null }
                        : {})), (updates.avatarUrl !== undefined
                        ? { avatarUrl: updates.avatarUrl || null }
                        : {})), { updatedAt: new Date() }))
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.usersTable.id, userId), (0, drizzle_orm_1.isNull)(db_2.usersTable.deletedAt)))
                        .returning()];
                case 1:
                    updated = (_a.sent())[0];
                    return [2 /*return*/, updated !== null && updated !== void 0 ? updated : null];
            }
        });
    });
}
function softDeleteUser(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.usersTable)
                        .set({ deletedAt: new Date(), updatedAt: new Date() })
                        .where((0, drizzle_orm_1.eq)(db_2.usersTable.id, userId))];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var templateObject_1;
