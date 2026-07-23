"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var api_zod_1 = require("@workspace/api-zod");
var router = (0, express_1.Router)();
router.get("/healthz", function (_req, res) {
    var data = api_zod_1.HealthCheckResponse.parse({ status: "ok" });
    res.json(data);
});
exports.default = router;
