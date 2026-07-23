"use strict";
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
exports.StripeProvider = void 0;
/**
 * Stripe billing provider implementation.
 *
 * Environment variables required:
 *   STRIPE_SECRET_KEY      — sk_live_xxx or sk_test_xxx
 *   STRIPE_WEBHOOK_SECRET  — whsec_xxx (from Stripe webhook settings)
 */
var stripe_1 = require("stripe");
var stripeClient = null;
function getStripe() {
    if (!stripeClient) {
        var key = process.env["STRIPE_SECRET_KEY"];
        if (!key)
            throw new Error("STRIPE_SECRET_KEY is not set");
        stripeClient = new stripe_1.default(key, {
            apiVersion: "2026-06-24.dahlia",
            typescript: true,
        });
    }
    return stripeClient;
}
var StripeProvider = /** @class */ (function () {
    function StripeProvider() {
        this.name = "stripe";
    }
    StripeProvider.prototype.createCheckoutSession = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            var stripe, sessionParams, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        stripe = getStripe();
                        sessionParams = {
                            mode: "subscription",
                            payment_method_types: ["card"],
                            customer_email: params.userEmail,
                            line_items: [
                                {
                                    price: params.planPriceId,
                                    quantity: 1,
                                },
                            ],
                            success_url: params.successUrl,
                            cancel_url: params.cancelUrl,
                            metadata: __assign({ userId: params.userId, planSlug: params.planSlug }, params.metadata),
                            subscription_data: __assign({ metadata: {
                                    userId: params.userId,
                                    planSlug: params.planSlug,
                                } }, (params.trialDays
                                ? { trial_period_days: params.trialDays }
                                : {})),
                        };
                        return [4 /*yield*/, stripe.checkout.sessions.create(sessionParams)];
                    case 1:
                        session = _a.sent();
                        return [2 /*return*/, {
                                sessionId: session.id,
                                url: session.url,
                            }];
                }
            });
        });
    };
    /**
     * Verify Stripe webhook signature.
     * This MUST be called before processing ANY webhook payload.
     * Never process a webhook without verified signature.
     */
    StripeProvider.prototype.verifyWebhook = function (rawBody, signature, secret) {
        return __awaiter(this, void 0, void 0, function () {
            var stripe, event;
            return __generator(this, function (_a) {
                stripe = getStripe();
                try {
                    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
                }
                catch (_b) {
                    return [2 /*return*/, {
                            valid: false,
                            eventId: "",
                            eventType: "",
                            payload: {},
                        }];
                }
                return [2 /*return*/, {
                        valid: true,
                        eventId: event.id,
                        eventType: event.type,
                        payload: event,
                    }];
            });
        });
    };
    StripeProvider.prototype.cancelSubscription = function (providerSubscriptionId) {
        return __awaiter(this, void 0, void 0, function () {
            var stripe;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        stripe = getStripe();
                        return [4 /*yield*/, stripe.subscriptions.cancel(providerSubscriptionId)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    StripeProvider.prototype.createRefund = function (providerPaymentId, amountCents) {
        return __awaiter(this, void 0, void 0, function () {
            var stripe, params, refund;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        stripe = getStripe();
                        params = __assign({ payment_intent: providerPaymentId }, (amountCents ? { amount: amountCents } : {}));
                        return [4 /*yield*/, stripe.refunds.create(params)];
                    case 1:
                        refund = _a.sent();
                        return [2 /*return*/, { refundId: refund.id }];
                }
            });
        });
    };
    return StripeProvider;
}());
exports.StripeProvider = StripeProvider;
