"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validateQuery = validateQuery;
function validate(schema) {
    return function (req, res, next) {
        var result = schema.safeParse(req.body);
        if (!result.success) {
            var errors = result.error.errors.map(function (e) { return ({
                field: e.path.join("."),
                message: e.message,
            }); });
            res.status(400).json({ error: "Validation failed.", errors: errors });
            return;
        }
        req.body = result.data;
        next();
    };
}
function validateQuery(schema) {
    return function (req, res, next) {
        var result = schema.safeParse(req.query);
        if (!result.success) {
            var errors = result.error.errors.map(function (e) { return ({
                field: e.path.join("."),
                message: e.message,
            }); });
            res.status(400).json({ error: "Invalid query parameters.", errors: errors });
            return;
        }
        req.query = result.data;
        next();
    };
}
