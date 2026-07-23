/**
 * AI Chat route — proxies requests to OpenRouter, keeping the API key server-side.
 * Optionally requires authentication and tracks usage.
 */
import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { validate } from "../middlewares/validate";
import { authLimiter } from "../middlewares/rate-limit";
import { incrementUsage } from "../services/usage.service";

const router = Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env["AI_MODEL"] ?? "anthropic/claude-sonnet-4-5";
const APP_URL = process.env["APP_URL"] ?? "https://graph3d.app";

const MAX_TOKENS_CAP = 1024;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;
const MAX_TOTAL_CHARS = 16000;
const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(MAX_MESSAGE_CHARS),
});

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1).max(MAX_MESSAGES),
  max_tokens: z.number().int().positive().optional(),
});

function validateTotalChars(messages: { content: string }[]): string | null {
  const total = messages.reduce((sum, m) => sum + m.content.length, 0);
  if (total > MAX_TOTAL_CHARS) {
    return `Conversation is too long (max ${MAX_TOTAL_CHARS} characters combined).`;
  }
  return null;
}

router.post(
  "/",
  authLimiter,
  authenticate, // sets req.user if logged in (optional auth)
  validate(chatSchema),
  async (req, res) => {
    const apiKey = process.env["OPENROUTER_API_KEY"];
    if (!apiKey) {
      res.status(500).json({
        error: { message: "Server misconfigured: OPENROUTER_API_KEY is not set." },
      });
      return;
    }

    const { messages, max_tokens } = req.body as z.infer<typeof chatSchema>;

    const charError = validateTotalChars(messages);
    if (charError) {
      res.status(400).json({ error: { message: charError } });
      return;
    }

    const safeMaxTokens = Math.min(
      Number.isFinite(max_tokens) && (max_tokens ?? 0) > 0
        ? Math.floor(max_tokens!)
        : MAX_TOKENS_CAP,
      MAX_TOKENS_CAP,
    );

    try {
      const upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": APP_URL,
          "X-Title": "Graph3D Pro",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: safeMaxTokens,
          messages,
        }),
      });

      const data = await upstream.json();

      // Track AI usage if user is authenticated
      if (req.user) {
        incrementUsage(req.user.id, "ai_requests").catch(() => {});
      }

      res.status(upstream.status).json(data);
    } catch {
      res.status(502).json({
        error: { message: "Could not reach AI service. Try again in a moment." },
      });
    }
  },
);

export default router;
