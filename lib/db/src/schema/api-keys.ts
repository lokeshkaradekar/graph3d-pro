import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * API keys for programmatic access (future feature).
 * The raw key is shown once on creation and never stored.
 * Only the SHA-256 hash is stored for lookup.
 */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // SHA-256(raw_key) — used for lookup
    keyHash: text("key_hash").notNull().unique(),

    // First 8 chars of the raw key — shown in UI so user can identify keys
    keyPrefix: text("key_prefix").notNull(),

    name: text("name").notNull(),

    // Array of allowed scopes: ['graphs:read', 'graphs:write', 'ai:use', etc.]
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),

    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),

    // null = no expiry
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // Set when user revokes the key
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_key_hash_idx").on(table.keyHash),
  ],
);

export type ApiKey = typeof apiKeysTable.$inferSelect;
