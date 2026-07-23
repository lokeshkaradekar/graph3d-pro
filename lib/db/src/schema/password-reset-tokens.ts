import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // SHA-256 hash of the raw token emailed to user
    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // Null = unused; set on successful password reset (single-use)
    usedAt: timestamp("used_at", { withTimezone: true }),

    // IP address that requested the reset (for audit)
    ipAddress: text("ip_address"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("password_reset_user_id_idx").on(table.userId),
    index("password_reset_token_hash_idx").on(table.tokenHash),
    index("password_reset_expires_at_idx").on(table.expiresAt),
  ],
);

export type PasswordResetToken = typeof passwordResetTokensTable.$inferSelect;
