/**
 * Vercel serverless entry point.
 *
 * Filename note: `[...path].ts` is Vercel's catch-all route convention —
 * every request under /api/* (e.g. /api/auth/login, /api/chat) is routed
 * to this single function automatically, no vercel.json rewrite needed.
 * Static files (index.html, core/*.js, etc.) are handled separately by
 * Vercel's own static hosting of the public/ folder — this function only
 * ever sees /api/* requests.
 *
 * This is intentionally the *only* difference between the Render and
 * Vercel deployments of this backend — the actual routing logic (all the
 * /api/* routes, auth, etc.) lives in src/app.ts and is shared unchanged
 * between both platforms.
 *
 * Do NOT import from "../src/index" here — that file calls app.listen(),
 * which starts a persistent server. Vercel invokes this module per
 * request instead; an Express app is already a valid
 * `(req, res) => void` handler, so exporting it directly is all that's
 * needed.
 */
import app from "../src/app.js";

export default app;
