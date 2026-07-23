/**
 * Session resolution middleware.
 *
 * Reads the session cookie, validates it against the database, and attaches
 * the user to req.user. Does NOT reject unauthenticated requests — that is
 * the job of requireAuth. This way public endpoints can optionally read
 * the user without forcing authentication.
 */
import type { Request, Response, NextFunction } from "express";
import {
  getTokenFromRequest,
  getUserFromToken,
  type SessionUser,
} from "../services/session.service";

declare global {
  namespace Express {
    interface Request {
      user: SessionUser | null;
    }
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = getTokenFromRequest(req);
    req.user = await getUserFromToken(token);
  } catch {
    // Treat any DB error as unauthenticated — never crash the request
    req.user = null;
  }
  next();
}
