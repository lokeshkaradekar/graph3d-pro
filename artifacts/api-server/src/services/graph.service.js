"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
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
exports.validateGraphData = validateGraphData;
exports.listUserGraphs = listUserGraphs;
exports.getGraph = getGraph;
exports.getGraphByShareToken = getGraphByShareToken;
exports.createGraph = createGraph;
exports.updateGraph = updateGraph;
exports.enableSharing = enableSharing;
exports.deleteGraph = deleteGraph;
exports.getGraphVersions = getGraphVersions;
exports.restoreGraphVersion = restoreGraphVersion;
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("@workspace/db");
var db_2 = require("@workspace/db");
var crypto_1 = require("../lib/crypto");
var constants_1 = require("../lib/constants");
// ── Validation ────────────────────────────────────────────────────────────────
function validateGraphData(data) {
    if (data === null || data === undefined)
        return "Graph data is required.";
    var serialized = JSON.stringify(data);
    if (Buffer.byteLength(serialized, "utf8") > constants_1.MAX_GRAPH_DATA_BYTES) {
        return "Graph data exceeds the ".concat(constants_1.MAX_GRAPH_DATA_BYTES / 1024, "KB limit.");
    }
    return null;
}
function sanitizeTitle(title) {
    if (typeof title === "string" && title.trim()) {
        return title.trim().slice(0, constants_1.MAX_GRAPH_TITLE_LENGTH);
    }
    return "Untitled Graph";
}
// ── Read ──────────────────────────────────────────────────────────────────────
/** List a user's graphs (excludes soft-deleted, excludes data payload) */
function listUserGraphs(userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.db
                    .select({
                    id: db_2.graphsTable.id,
                    userId: db_2.graphsTable.userId,
                    title: db_2.graphsTable.title,
                    description: db_2.graphsTable.description,
                    visibility: db_2.graphsTable.visibility,
                    shareToken: db_2.graphsTable.shareToken,
                    isFeatured: db_2.graphsTable.isFeatured,
                    thumbnailUrl: db_2.graphsTable.thumbnailUrl,
                    deletedAt: db_2.graphsTable.deletedAt,
                    createdAt: db_2.graphsTable.createdAt,
                    updatedAt: db_2.graphsTable.updatedAt,
                })
                    .from(db_2.graphsTable)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt)))
                    .orderBy((0, drizzle_orm_1.desc)(db_2.graphsTable.updatedAt))];
        });
    });
}
/**
 * Load a single graph with permission check.
 *
 * Access rules:
 *   public/shared → readable by anyone
 *   private       → owner only
 *
 * Returns null in all "not found" cases — whether the graph doesn't exist,
 * is private and belongs to someone else, or is private and caller isn't authed.
 * Never distinguish between these cases to the caller.
 */
function getGraph(graphId, viewerId) {
    return __awaiter(this, void 0, void 0, function () {
        var graph;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.graphsTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt)))
                        .limit(1)];
                case 1:
                    graph = (_a.sent())[0];
                    if (!graph)
                        return [2 /*return*/, null];
                    if (graph.visibility === "public" ||
                        graph.visibility === "shared") {
                        return [2 /*return*/, graph];
                    }
                    // Private: only owner can read
                    if (viewerId && graph.userId === viewerId)
                        return [2 /*return*/, graph];
                    return [2 /*return*/, null];
            }
        });
    });
}
/** Get graph by share token (for shared links) */
function getGraphByShareToken(shareToken) {
    return __awaiter(this, void 0, void 0, function () {
        var graph;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.graphsTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.shareToken, shareToken), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt), (0, drizzle_orm_1.ne)(db_2.graphsTable.visibility, "private")))
                        .limit(1)];
                case 1:
                    graph = (_a.sent())[0];
                    return [2 /*return*/, graph !== null && graph !== void 0 ? graph : null];
            }
        });
    });
}
function createGraph(userId, input) {
    return __awaiter(this, void 0, void 0, function () {
        var graph;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .insert(db_2.graphsTable)
                        .values({
                        userId: userId,
                        title: sanitizeTitle(input.title),
                        description: (_b = (_a = input.description) === null || _a === void 0 ? void 0 : _a.slice(0, constants_1.MAX_GRAPH_DESCRIPTION_LENGTH)) !== null && _b !== void 0 ? _b : null,
                        data: input.data,
                        visibility: (_c = input.visibility) !== null && _c !== void 0 ? _c : "private",
                    })
                        .returning()];
                case 1:
                    graph = (_d.sent())[0];
                    if (!graph)
                        throw new Error("Failed to create graph");
                    return [2 /*return*/, graph];
            }
        });
    });
}
function updateGraph(graphId_1, userId_1, input_1) {
    return __awaiter(this, arguments, void 0, function (graphId, userId, input, saveVersion) {
        var existing, patch, updated;
        if (saveVersion === void 0) { saveVersion = true; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.graphsTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId), (0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt)))
                        .limit(1)];
                case 1:
                    existing = (_a.sent())[0];
                    if (!existing)
                        return [2 /*return*/, null];
                    if (!(saveVersion && input.data)) return [3 /*break*/, 3];
                    return [4 /*yield*/, saveGraphVersion(existing, "manual")];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    patch = { updatedAt: new Date() };
                    if (input.title !== undefined)
                        patch["title"] = sanitizeTitle(input.title);
                    if (input.description !== undefined) {
                        patch["description"] = input.description.slice(0, constants_1.MAX_GRAPH_DESCRIPTION_LENGTH) || null;
                    }
                    if (input.data !== undefined)
                        patch["data"] = input.data;
                    if (input.visibility !== undefined)
                        patch["visibility"] = input.visibility;
                    if (input.thumbnailUrl !== undefined)
                        patch["thumbnailUrl"] = input.thumbnailUrl || null;
                    return [4 /*yield*/, db_1.db
                            .update(db_2.graphsTable)
                            .set(patch)
                            .where((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId))
                            .returning()];
                case 4:
                    updated = (_a.sent())[0];
                    return [2 /*return*/, updated !== null && updated !== void 0 ? updated : null];
            }
        });
    });
}
/** Generate or return existing share token */
function enableSharing(graphId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var graph, shareToken;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.graphsTable)
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId), (0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt)))
                        .limit(1)];
                case 1:
                    graph = (_a.sent())[0];
                    if (!graph)
                        return [2 /*return*/, null];
                    if (!graph.shareToken) return [3 /*break*/, 4];
                    if (!(graph.visibility === "private")) return [3 /*break*/, 3];
                    return [4 /*yield*/, db_1.db
                            .update(db_2.graphsTable)
                            .set({ visibility: "shared", updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId))];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, graph.shareToken];
                case 4:
                    shareToken = (0, crypto_1.generateShareToken)();
                    return [4 /*yield*/, db_1.db
                            .update(db_2.graphsTable)
                            .set({ shareToken: shareToken, visibility: "shared", updatedAt: new Date() })
                            .where((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId))];
                case 5:
                    _a.sent();
                    return [2 /*return*/, shareToken];
            }
        });
    });
}
/** Soft delete a graph */
function deleteGraph(graphId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        var result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .update(db_2.graphsTable)
                        .set({ deletedAt: new Date(), updatedAt: new Date() })
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphsTable.id, graphId), (0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId), (0, drizzle_orm_1.isNull)(db_2.graphsTable.deletedAt)))
                        .returning({ id: db_2.graphsTable.id })];
                case 1:
                    result = _a.sent();
                    return [2 /*return*/, result.length > 0];
            }
        });
    });
}
// ── Versions ──────────────────────────────────────────────────────────────────
function saveGraphVersion(graph, label) {
    return __awaiter(this, void 0, void 0, function () {
        var maxRow, nextVersion;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select({ max: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["COALESCE(MAX(version_number), 0)"], ["COALESCE(MAX(version_number), 0)"]))) })
                        .from(db_2.graphVersionsTable)
                        .where((0, drizzle_orm_1.eq)(db_2.graphVersionsTable.graphId, graph.id))];
                case 1:
                    maxRow = (_b.sent())[0];
                    nextVersion = ((_a = maxRow === null || maxRow === void 0 ? void 0 : maxRow.max) !== null && _a !== void 0 ? _a : 0) + 1;
                    return [4 /*yield*/, db_1.db.insert(db_2.graphVersionsTable).values({
                            graphId: graph.id,
                            userId: graph.userId,
                            versionNumber: nextVersion,
                            label: label,
                            data: graph.data,
                        })];
                case 2:
                    _b.sent();
                    // Prune old versions beyond MAX_VERSIONS_KEPT
                    return [4 /*yield*/, db_1.db.execute((0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    DELETE FROM graph_versions\n    WHERE graph_id = ", "\n      AND id NOT IN (\n        SELECT id FROM graph_versions\n        WHERE graph_id = ", "\n        ORDER BY version_number DESC\n        LIMIT ", "\n      )\n  "], ["\n    DELETE FROM graph_versions\n    WHERE graph_id = ", "\n      AND id NOT IN (\n        SELECT id FROM graph_versions\n        WHERE graph_id = ", "\n        ORDER BY version_number DESC\n        LIMIT ", "\n      )\n  "])), graph.id, graph.id, constants_1.MAX_VERSIONS_KEPT))];
                case 3:
                    // Prune old versions beyond MAX_VERSIONS_KEPT
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getGraphVersions(graphId, userId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db_1.db
                    .select({
                    id: db_2.graphVersionsTable.id,
                    graphId: db_2.graphVersionsTable.graphId,
                    userId: db_2.graphVersionsTable.userId,
                    versionNumber: db_2.graphVersionsTable.versionNumber,
                    label: db_2.graphVersionsTable.label,
                    createdAt: db_2.graphVersionsTable.createdAt,
                })
                    .from(db_2.graphVersionsTable)
                    .innerJoin(db_2.graphsTable, (0, drizzle_orm_1.eq)(db_2.graphVersionsTable.graphId, db_2.graphsTable.id))
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphVersionsTable.graphId, graphId), (0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId)))
                    .orderBy((0, drizzle_orm_1.desc)(db_2.graphVersionsTable.versionNumber))];
        });
    });
}
function restoreGraphVersion(graphId, userId, versionId) {
    return __awaiter(this, void 0, void 0, function () {
        var version;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, db_1.db
                        .select()
                        .from(db_2.graphVersionsTable)
                        .innerJoin(db_2.graphsTable, (0, drizzle_orm_1.eq)(db_2.graphVersionsTable.graphId, db_2.graphsTable.id))
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(db_2.graphVersionsTable.id, versionId), (0, drizzle_orm_1.eq)(db_2.graphVersionsTable.graphId, graphId), (0, drizzle_orm_1.eq)(db_2.graphsTable.userId, userId)))
                        .limit(1)];
                case 1:
                    version = (_a.sent())[0];
                    if (!version)
                        return [2 /*return*/, null];
                    return [2 /*return*/, updateGraph(graphId, userId, { data: version.graph_versions.data }, true)];
            }
        });
    });
}
var templateObject_1, templateObject_2;
