"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var app_1 = require("./app");
var logger_1 = require("./lib/logger");
var rawPort = process.env["PORT"];
if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
}
var port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
    throw new Error("Invalid PORT value: \"".concat(rawPort, "\""));
}
app_1.default.listen(port, function (err) {
    if (err) {
        logger_1.logger.error({ err: err }, "Error listening on port");
        process.exit(1);
    }
    logger_1.logger.info({ port: port }, "Server listening");
});
