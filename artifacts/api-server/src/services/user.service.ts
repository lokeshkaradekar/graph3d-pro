import bcryptjs from "bcryptjs";
import { eq, and, isNull, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  usersTable,
  emailVerificationsTable,
  passwordResetTokensTable,
  type User,
} from "@workspace/db";
import {
  generateToken,
  hashToken,
  getClientIp,
} from "../lib/crypto";
import {
  BCRYPT_ROUNDS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
  EMAIL_VERIFICATION_HOURS,
  PASSWORD_RESET_HOURS,
} from "../lib/constants";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/email";
import type { Request } from "express";

// ── Email / Password normalization ────────────────────────────────────────────

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  if (email.length === 0 || email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}

// ── Password hashing ──────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

// ── User lookup ───────────────────────────────────────────────────────────────

export async function findUserByEmail(email: string): Promise<User | null> {
  const normalized = normalizeEmail(email);
  const rows = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.emailNormalized, normalized),
        isNull(usersTable.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.id, id), isNull(usersTable.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

// ── Account creation ──────────────────────────────────────────────────────────

export interface SignupInput {
  email: string;
  password: string;
  displayName?: string;
}

export interface SignupResult {
  user: User;
  verificationToken: string;
}

export async function createUser(input: SignupInput): Promise<SignupResult> {
  const emailNormalized = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const displayName = input.displayName?.trim().slice(0, 80) ?? null;

  const [user] = await db
    .insert(usersTable)
    .values({
      email: input.email.trim(),
      emailNormalized,
      passwordHash,
      displayName,
    })
    .returning();

  if (!user) throw new Error("Failed to create user");

  const verificationToken = await createEmailVerificationToken(user.id);
  await sendVerificationEmail(user.email, verificationToken);

  return { user, verificationToken };
}

// ── Email verification ────────────────────────────────────────────────────────

export async function createEmailVerificationToken(
  userId: string,
): Promise<string> {
  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_HOURS * 60 * 60 * 1000,
  );

  // Invalidate any existing unused tokens for this user
  await db
    .delete(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.userId, userId),
        isNull(emailVerificationsTable.usedAt),
      ),
    );

  await db.insert(emailVerificationsTable).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function verifyEmail(
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select()
    .from(emailVerificationsTable)
    .where(eq(emailVerificationsTable.tokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, error: "Invalid or expired verification link." };
  if (row.usedAt) return { ok: false, error: "This link has already been used." };
  if (row.expiresAt < now) return { ok: false, error: "This verification link has expired. Request a new one." };

  // Mark token used and verify user in a transaction
  await db.transaction(async (tx) => {
    await tx
      .update(emailVerificationsTable)
      .set({ usedAt: now })
      .where(eq(emailVerificationsTable.id, row.id));

    await tx
      .update(usersTable)
      .set({ isVerified: true, updatedAt: now })
      .where(eq(usersTable.id, row.userId));
  });

  return { ok: true };
}

// ── Password reset ────────────────────────────────────────────────────────────

export async function initiatePasswordReset(
  email: string,
  req: Request,
): Promise<void> {
  const user = await findUserByEmail(email);
  // Always return success to prevent email enumeration — don't reveal
  // whether the address has an account
  if (!user) return;

  const token = generateToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_HOURS * 60 * 60 * 1000);
  const ipAddress = getClientIp(
    req.headers as Record<string, string | string[] | undefined>,
    req.socket?.remoteAddress,
  );

  // Invalidate old tokens
  await db
    .delete(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt),
      ),
    );

  await db.insert(passwordResetTokensTable).values({
    userId: user.id,
    tokenHash,
    expiresAt,
    ipAddress,
  });

  await sendPasswordResetEmail(user.email, token);
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string; userId?: string }> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.tokenHash, tokenHash))
    .limit(1);

  if (!row) return { ok: false, error: "Invalid or expired reset link." };
  if (row.usedAt) return { ok: false, error: "This link has already been used." };
  if (row.expiresAt < now) return { ok: false, error: "This reset link has expired. Request a new one." };

  const passwordHash = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: now })
      .where(eq(passwordResetTokensTable.id, row.id));

    await tx
      .update(usersTable)
      .set({ passwordHash, updatedAt: now, failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(usersTable.id, row.userId));
  });

  return { ok: true, userId: row.userId };
}

// ── Brute-force protection ────────────────────────────────────────────────────

export async function registerFailedLogin(userId: string): Promise<void> {
  await db.execute(sql`
    UPDATE users
    SET
      failed_login_attempts = failed_login_attempts + 1,
      locked_until = CASE
        WHEN failed_login_attempts + 1 >= ${MAX_FAILED_LOGIN_ATTEMPTS}
        THEN now() + (${LOCKOUT_MINUTES} * INTERVAL '1 minute')
        ELSE locked_until
      END,
      updated_at = now()
    WHERE id = ${userId}
  `);
}

export async function clearFailedLogins(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}

export function isAccountLocked(user: User): boolean {
  return !!user.lockedUntil && user.lockedUntil > new Date();
}

// ── Profile management ────────────────────────────────────────────────────────

export async function updateProfile(
  userId: string,
  updates: { displayName?: string; avatarUrl?: string },
): Promise<User | null> {
  const [updated] = await db
    .update(usersTable)
    .set({
      ...(updates.displayName !== undefined
        ? { displayName: updates.displayName.trim().slice(0, 80) || null }
        : {}),
      ...(updates.avatarUrl !== undefined
        ? { avatarUrl: updates.avatarUrl || null }
        : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, userId), isNull(usersTable.deletedAt)))
    .returning();

  return updated ?? null;
}

export async function softDeleteUser(userId: string): Promise<void> {
  await db
    .update(usersTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}
