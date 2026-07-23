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
var express_1 = require("express");
var zod_1 = require("zod");
var authenticate_1 = require("../middlewares/authenticate");
var require_auth_1 = require("../middlewares/require-auth");
var require_feature_1 = require("../middlewares/require-feature");
var validate_1 = require("../middlewares/validate");
var graph_service_1 = require("../services/graph.service");
var usage_service_1 = require("../services/usage.service");
var feature_service_1 = require("../services/feature.service");
var audit_service_1 = require("../services/audit.service");
var constants_1 = require("../lib/constants");
var router = (0, express_1.Router)();
var createGraphSchema = zod_1.z.object({
    title: zod_1.z.string().max(120).optional(),
    description: zod_1.z.string().max(500).optional(),
    data: zod_1.z.record(zod_1.z.unknown()),
    visibility: zod_1.z.enum(["private", "public", "shared"]).optional(),
});
var updateGraphSchema = zod_1.z.object({
    title: zod_1.z.string().max(120).optional(),
    description: zod_1.z.string().max(500).optional(),
    data: zod_1.z.record(zod_1.z.unknown()).optional(),
    visibility: zod_1.z.enum(["private", "public", "shared"]).optional(),
    thumbnailUrl: zod_1.z.string().url().max(500).optional().nullable(),
});
// ── GET /api/graphs/share/:token — public share link (no auth required) ───────
router.get("/share/:token", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var graph;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.getGraphByShareToken)(String(req.params["token"]))];
            case 1:
                graph = _a.sent();
                if (!graph) {
                    res.status(404).json({ error: "Graph not found." });
                    return [2 /*return*/];
                }
                res.json({ graph: graph });
                return [2 /*return*/];
        }
    });
}); });
// All remaining routes require auth
router.use(authenticate_1.authenticate, require_auth_1.requireAuth);
// ── GET /api/graphs — list user's graphs ──────────────────────────────────────
router.get("/", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var graphs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.listUserGraphs)(req.user.id)];
            case 1:
                graphs = _a.sent();
                res.json({ graphs: graphs });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/graphs — create a graph ────────────────────────────────────────
router.post("/", (0, validate_1.validate)(createGraphSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, title, description, data, visibility, dataError, check, graph, err_1;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, title = _a.title, description = _a.description, data = _a.data, visibility = _a.visibility;
                dataError = (0, graph_service_1.validateGraphData)(data);
                if (dataError) {
                    res.status(400).json({ error: dataError });
                    return [2 /*return*/];
                }
                if (!(visibility === "private")) return [3 /*break*/, 2];
                return [4 /*yield*/, (0, feature_service_1.hasFeature)(req.user.id, constants_1.FEATURES.PRIVATE_PROJECTS)];
            case 1:
                check = _b.sent();
                if (!check.allowed) {
                    // Fall back to public if private not available
                    req.body.visibility = "public";
                }
                _b.label = 2;
            case 2:
                _b.trys.push([2, 5, , 6]);
                return [4 /*yield*/, (0, graph_service_1.createGraph)(req.user.id, { title: title, description: description, data: data, visibility: visibility })];
            case 3:
                graph = _b.sent();
                // Track usage
                return [4 /*yield*/, (0, usage_service_1.incrementUsage)(req.user.id, "graphs_created")];
            case 4:
                // Track usage
                _b.sent();
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    action: "graph.created",
                    resourceType: "graph",
                    resourceId: graph.id,
                    req: req,
                });
                res.status(201).json({ graph: graph });
                return [3 /*break*/, 6];
            case 5:
                err_1 = _b.sent();
                req.log.error({ err: err_1 }, "create graph error");
                res.status(500).json({ error: "Failed to create graph." });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); });
// ── GET /api/graphs/:id — load a graph ───────────────────────────────────────
router.get("/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var graph;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.getGraph)(String(req.params["id"]), req.user.id)];
            case 1:
                graph = _a.sent();
                if (!graph) {
                    res.status(404).json({ error: "Graph not found." });
                    return [2 /*return*/];
                }
                res.json({ graph: graph });
                return [2 /*return*/];
        }
    });
}); });
// ── PUT /api/graphs/:id — update a graph ─────────────────────────────────────
router.put("/:id", (0, validate_1.validate)(updateGraphSchema), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var dataError, graph;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (req.body.data !== undefined) {
                    dataError = (0, graph_service_1.validateGraphData)(req.body.data);
                    if (dataError) {
                        res.status(400).json({ error: dataError });
                        return [2 /*return*/];
                    }
                }
                return [4 /*yield*/, (0, graph_service_1.updateGraph)(String(req.params["id"]), req.user.id, req.body)];
            case 1:
                graph = _a.sent();
                if (!graph) {
                    res.status(404).json({ error: "Graph not found." });
                    return [2 /*return*/];
                }
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    action: "graph.updated",
                    resourceType: "graph",
                    resourceId: graph.id,
                    req: req,
                });
                res.json({ graph: graph });
                return [2 /*return*/];
        }
    });
}); });
// ── DELETE /api/graphs/:id ────────────────────────────────────────────────────
router.delete("/:id", function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var deleted;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.deleteGraph)(String(req.params["id"]), req.user.id)];
            case 1:
                deleted = _a.sent();
                if (!deleted) {
                    res.status(404).json({ error: "Graph not found." });
                    return [2 /*return*/];
                }
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    action: "graph.deleted",
                    resourceType: "graph",
                    resourceId: String(req.params["id"]),
                    req: req,
                });
                res.json({ ok: true });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/graphs/:id/share — enable sharing ────────────────────────────────
router.post("/:id/share", (0, require_feature_1.requireFeature)(constants_1.FEATURES.GRAPH_SHARING), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var shareToken;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.enableSharing)(String(req.params["id"]), req.user.id)];
            case 1:
                shareToken = _a.sent();
                if (!shareToken) {
                    res.status(404).json({ error: "Graph not found." });
                    return [2 /*return*/];
                }
                (0, audit_service_1.audit)({
                    actorId: req.user.id,
                    action: "graph.shared",
                    resourceType: "graph",
                    resourceId: String(req.params["id"]),
                    req: req,
                });
                res.json({ shareToken: shareToken });
                return [2 /*return*/];
        }
    });
}); });
// ── GET /api/graphs/:id/versions ──────────────────────────────────────────────
router.get("/:id/versions", (0, require_feature_1.requireFeature)(constants_1.FEATURES.VERSION_HISTORY), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var versions;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.getGraphVersions)(String(req.params["id"]), req.user.id)];
            case 1:
                versions = _a.sent();
                res.json({ versions: versions });
                return [2 /*return*/];
        }
    });
}); });
// ── POST /api/graphs/:id/versions/:versionId/restore ──────────────────────────
router.post("/:id/versions/:versionId/restore", (0, require_feature_1.requireFeature)(constants_1.FEATURES.VERSION_HISTORY), function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var graph;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, graph_service_1.restoreGraphVersion)(String(req.params["id"]), req.user.id, String(req.params["versionId"]))];
            case 1:
                graph = _a.sent();
                if (!graph) {
                    res.status(404).json({ error: "Version not found." });
                    return [2 /*return*/];
                }
                res.json({ graph: graph });
                return [2 /*return*/];
        }
    });
}); });
exports.default = router;
