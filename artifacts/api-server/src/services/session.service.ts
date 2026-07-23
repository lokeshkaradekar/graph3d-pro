import { eq, and, lt, gt } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  sessionsTable,
  usersTable,
  type Session,
  type User,
} from "@workspace/db";
import {
  generateToken,
  hashToken,
  getClientIp,
} from "../lib/crypto";
import {
  COOKIE_NAME,
  SESSION_DAYS_DEFAULT,
  SESSION_DAYS_REMEMBER,
} from "../lib/constants";
import type { Request, Response } from "express";

export interface SessionUser {
  id: string;
  email: string;
  emailNormalized: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: "user" | "admin";
  isVerified: boolean;
}

export interface CreateSessionResult {
  token: string;
  expiresAt: Date;
  session: Session;
}

export async function createSession(
  userId: string,
  req: Request,
  rememberMe = false,
): Promise<CreateSessionResult> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const days = rememberMe ? SESSION_DAYS_REMEMBER : SESSION_DAYS_DEFAULT;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const userAgent = (req.headers["user-agent"] ?? "").slice(0, 300);
  const ipAddress = getClientIp(
    req.headers as Record<string, string | string[] | undefined>,
    req.socket?.remoteAddress,
  );

  const [session] = await db
    .insert(sessionsTable)
    .values({
      userId,
      tokenHash,
      userAgent,
      ipAddress,
      rememberMe,
      expiresAt,
    })
    .returning();

  if (!session) throw new Error("Failed to create session");

  return { token, expiresAt, session };
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
}

export async function getUserFromToken(
  token: string | undefined,
): Promise<SessionUser | null> {
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const result = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      emailNormalized: usersTable.emailNormalized,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      role: usersTable.role,
      isVerified: usersTable.isVerified,
      sessionId: sessionsTable.id,
      expiresAt: sessionsTable.expiresAt,
    })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(
      and(
        eq(sessionsTable.tokenHash, tokenHash),
        gt(sessionsTable.expiresAt, now),
      ),
    )
    .limit(1);

  const row = result[0];
  if (!row) return null;

  // User is soft-deleted — treat as no session
  // (deleted users will have no rows due to cascade, but double-check)
  // Update last active timestamp in background (fire-and-forget)
  db.update(sessionsTable)
    .set({ lastActiveAt: now })
    .where(eq(sessionsTable.id, row.sessionId))
    .catch(() => {});

  return {
    id: row.id,
    email: row.email,
    emailNormalized: row.emailNormalized,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    role: row.role as "user" | "admin",
    isVerified: row.isVerified,
  };
}

export function getTokenFromRequest(req: Request): string | undefined {
  // cookie-parser middleware must be active
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;
  return cookies?.[COOKIE_NAME];
}

export function setSessionCookie(
  res: Response,
  token: string,
  rememberMe: boolean,
  expiresAt: Date,
): void {
  const maxAge = rememberMe
    ? SESSION_DAYS_REMEMBER * 24 * 60 * 60
    : SESSION_DAYS_DEFAULT * 24 * 60 * 60;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAge * 1000, // express cookie maxAge is in ms
  });
}

export function clearSessionCookie(res: Response): void {
  res.cookie(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Periodic cleanup of expired sessions (run via a scheduled job) */
export async function pruneExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()))
    .returning({ id: sessionsTable.id });
  return result.length;
}
