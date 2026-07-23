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
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
exports.sendPasswordResetEmail = sendPasswordResetEmail;
exports.sendPaymentFailedEmail = sendPaymentFailedEmail;
exports.sendSubscriptionCanceledEmail = sendSubscriptionCanceledEmail;
/**
 * Email service — production-ready stub with nodemailer
 *
 * In development (NODE_ENV !== 'production'):
 *   Logs emails to console instead of sending
 *
 * In production:
 *   Reads SMTP_* env vars and sends via nodemailer
 *   Swap this out for SendGrid/Resend/SES by changing the transport
 */
var logger_1 = require("./logger");
var isDev = process.env["NODE_ENV"] !== "production";
var APP_NAME = "Graph3D";
var APP_URL = (_a = process.env["APP_URL"]) !== null && _a !== void 0 ? _a : "https://graph3d.app";
var FROM_EMAIL = (_b = process.env["SMTP_FROM"]) !== null && _b !== void 0 ? _b : "noreply@graph3d.app";
function sendEmail(options) {
    return __awaiter(this, void 0, void 0, function () {
        var nodemailer, transporter;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (isDev) {
                        logger_1.logger.info({
                            to: options.to,
                            subject: options.subject,
                            preview: (_a = options.text) === null || _a === void 0 ? void 0 : _a.slice(0, 200),
                        }, "[DEV] Email suppressed — would send");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("nodemailer"); })];
                case 1:
                    nodemailer = _c.sent();
                    transporter = nodemailer.createTransport({
                        host: process.env["SMTP_HOST"],
                        port: Number((_b = process.env["SMTP_PORT"]) !== null && _b !== void 0 ? _b : 587),
                        secure: process.env["SMTP_SECURE"] === "true",
                        auth: {
                            user: process.env["SMTP_USER"],
                            pass: process.env["SMTP_PASS"],
                        },
                    });
                    return [4 /*yield*/, transporter.sendMail({
                            from: "\"".concat(APP_NAME, "\" <").concat(FROM_EMAIL, ">"),
                            to: options.to,
                            subject: options.subject,
                            html: options.html,
                            text: options.text,
                        })];
                case 2:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendVerificationEmail(email, token) {
    return __awaiter(this, void 0, void 0, function () {
        var url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(APP_URL, "/verify-email?token=").concat(token);
                    return [4 /*yield*/, sendEmail({
                            to: email,
                            subject: "Verify your ".concat(APP_NAME, " email"),
                            text: "Verify your email: ".concat(url, "\n\nThis link expires in 24 hours."),
                            html: "\n      <div style=\"font-family:sans-serif;max-width:480px;margin:0 auto\">\n        <h2>Verify your email</h2>\n        <p>Click the button below to verify your ".concat(APP_NAME, " account.</p>\n        <a href=\"").concat(url, "\" style=\"display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Verify Email</a>\n        <p style=\"color:#6b7280;font-size:14px;margin-top:24px\">Or copy this link: ").concat(url, "</p>\n        <p style=\"color:#6b7280;font-size:14px\">This link expires in 24 hours.</p>\n      </div>"),
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendPasswordResetEmail(email, token) {
    return __awaiter(this, void 0, void 0, function () {
        var url;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    url = "".concat(APP_URL, "/reset-password?token=").concat(token);
                    return [4 /*yield*/, sendEmail({
                            to: email,
                            subject: "Reset your ".concat(APP_NAME, " password"),
                            text: "Reset your password: ".concat(url, "\n\nThis link expires in 1 hour. If you didn't request this, ignore this email."),
                            html: "\n      <div style=\"font-family:sans-serif;max-width:480px;margin:0 auto\">\n        <h2>Reset your password</h2>\n        <p>We received a request to reset your ".concat(APP_NAME, " password.</p>\n        <a href=\"").concat(url, "\" style=\"display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Reset Password</a>\n        <p style=\"color:#6b7280;font-size:14px;margin-top:24px\">Or copy this link: ").concat(url, "</p>\n        <p style=\"color:#6b7280;font-size:14px\">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>\n      </div>"),
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendPaymentFailedEmail(email, planName, gracePeriodEndsAt) {
    return __awaiter(this, void 0, void 0, function () {
        var graceDate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    graceDate = gracePeriodEndsAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    });
                    return [4 /*yield*/, sendEmail({
                            to: email,
                            subject: "Action required: ".concat(APP_NAME, " payment failed"),
                            text: "Your ".concat(APP_NAME, " ").concat(planName, " payment failed. Update your payment method by ").concat(graceDate, " to keep your subscription."),
                            html: "\n      <div style=\"font-family:sans-serif;max-width:480px;margin:0 auto\">\n        <h2>Payment failed</h2>\n        <p>Your ".concat(APP_NAME, " <strong>").concat(planName, "</strong> payment failed.</p>\n        <p>Your subscription will remain active until <strong>").concat(graceDate, "</strong>. Please update your payment method to avoid losing access.</p>\n        <a href=\"").concat(APP_URL, "/billing\" style=\"display:inline-block;padding:12px 24px;background:#ef4444;color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Update Payment Method</a>\n      </div>"),
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function sendSubscriptionCanceledEmail(email, planName, accessEndsAt) {
    return __awaiter(this, void 0, void 0, function () {
        var endDate;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    endDate = accessEndsAt.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                    });
                    return [4 /*yield*/, sendEmail({
                            to: email,
                            subject: "Your ".concat(APP_NAME, " subscription has been canceled"),
                            text: "Your ".concat(APP_NAME, " ").concat(planName, " subscription has been canceled. You'll have access until ").concat(endDate, "."),
                            html: "\n      <div style=\"font-family:sans-serif;max-width:480px;margin:0 auto\">\n        <h2>Subscription canceled</h2>\n        <p>Your ".concat(APP_NAME, " <strong>").concat(planName, "</strong> subscription has been canceled.</p>\n        <p>You'll continue to have access to all ").concat(planName, " features until <strong>").concat(endDate, "</strong>.</p>\n        <a href=\"").concat(APP_URL, "/billing\" style=\"display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-weight:600\">Reactivate Subscription</a>\n      </div>"),
                        })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
