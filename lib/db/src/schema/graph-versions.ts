import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { graphsTable } from "./graphs";
import { usersTable } from "./users";

/**
 * Point-in-time snapshots of graph state.
 * Created on manual save, before destructive operations, or on auto-save.
 * Allows users to restore previous versions.
 */
export const graphVersionsTable = pgTable(
  "graph_versions",
  {
    id: uuid("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    graphId: uuid("graph_id")
      .notNull()
      .references(() => graphsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id),

    // Monotonically increasing per graph
    versionNumber: integer("version_number").notNull(),

    // 'auto_save' | 'manual' | 'pre_import' | 'pre_share'
    label: text("label").notNull().default("manual"),

    // Snapshot of the graph data at this version
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("graph_versions_graph_version_unique").on(
      table.graphId,
      table.versionNumber,
    ),
    index("graph_versions_graph_id_idx").on(table.graphId),
    index("graph_versions_created_at_idx").on(table.createdAt),
  ],
);

export type GraphVersion = typeof graphVersionsTable.$inferSelect;
