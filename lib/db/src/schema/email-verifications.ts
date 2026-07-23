import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const emailVerificationsTable = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // SHA-256 hash of the raw verification token emailed to user
    tokenHash: text("token_hash").notNull().unique(),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    // Null = unused; set when token is consumed
    usedAt: timestamp("used_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("email_verifications_user_id_idx").on(table.userId),
    index("email_verifications_token_hash_idx").on(table.tokenHash),
    index("email_verifications_expires_at_idx").on(table.expiresAt),
  ],
);

export type EmailVerification = typeof emailVerificationsTable.$inferSelect;
