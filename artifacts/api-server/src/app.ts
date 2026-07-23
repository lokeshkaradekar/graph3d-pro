import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalLimiter } from "./middlewares/rate-limit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
  }),
);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env["CORS_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (process.env["NODE_ENV"] !== "production") {
  allowedOrigins.push("http://localhost:3000", "http://localhost:5173");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 86400,
  }),
);

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Cookie parsing ────────────────────────────────────────────────────────────
app.use(cookieParser());

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use(generalLimiter);

// ── API Routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

// ── Static frontend files ─────────────────────────────────────────────────────
// Serve the static frontend. In production, the public/ dir is bundled with
// the server. In development, files are served directly from the source tree.
const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir, { maxAge: "1h" }));

// ── SPA fallback — serve index.html for non-API routes ────────────────────────
app.get(/^(?!\/api).*/, (req, res) => {
  // Specific named routes
  const url = req.path;
  if (url === "/login" || url === "/login.html") {
    res.sendFile(path.join(publicDir, "login.html"));
    return;
  }
  if (url === "/landing" || url === "/landing.html") {
    res.sendFile(path.join(publicDir, "landing.html"));
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

// ── 404 handler (API only) ────────────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found." });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ error: "Internal server error." });
  },
);

export default app;
