import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { graphVisibilityEnum } from "./enums";

export const graphsTable = pgTable(
  "graphs",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled Graph"),
    description: text("description"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    visibility: graphVisibilityEnum("visibility").notNull().default("private"),
    shareToken: text("share_token"),
    isFeatured: boolean("is_featured").notNull().default(false),
    thumbnailUrl: text("thumbnail_url"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("graphs_user_id_idx").on(table.userId),
    index("graphs_visibility_idx").on(table.visibility),
    index("graphs_deleted_at_idx").on(table.deletedAt),
    index("graphs_is_featured_idx").on(table.isFeatured),
    uniqueIndex("graphs_share_token_unique").on(table.shareToken),
  ],
);

export type Graph = typeof graphsTable.$inferSelect;
export type InsertGraph = typeof graphsTable.$inferInsert;
