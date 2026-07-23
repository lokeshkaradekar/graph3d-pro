import { eq, and, isNull, desc, sql, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  graphsTable,
  graphVersionsTable,
  type Graph,
  type GraphVersion,
} from "@workspace/db";
import { generateShareToken } from "../lib/crypto";
import {
  MAX_GRAPH_DATA_BYTES,
  MAX_GRAPH_TITLE_LENGTH,
  MAX_GRAPH_DESCRIPTION_LENGTH,
  MAX_VERSIONS_KEPT,
} from "../lib/constants";

// ── Validation ────────────────────────────────────────────────────────────────

export function validateGraphData(data: unknown): string | null {
  if (data === null || data === undefined) return "Graph data is required.";
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, "utf8") > MAX_GRAPH_DATA_BYTES) {
    return `Graph data exceeds the ${MAX_GRAPH_DATA_BYTES / 1024}KB limit.`;
  }
  return null;
}

function sanitizeTitle(title: unknown): string {
  if (typeof title === "string" && title.trim()) {
    return title.trim().slice(0, MAX_GRAPH_TITLE_LENGTH);
  }
  return "Untitled Graph";
}

// ── Read ──────────────────────────────────────────────────────────────────────

/** List a user's graphs (excludes soft-deleted, excludes data payload) */
export async function listUserGraphs(
  userId: string,
): Promise<Omit<Graph, "data">[]> {
  return db
    .select({
      id: graphsTable.id,
      userId: graphsTable.userId,
      title: graphsTable.title,
      description: graphsTable.description,
      visibility: graphsTable.visibility,
      shareToken: graphsTable.shareToken,
      isFeatured: graphsTable.isFeatured,
      thumbnailUrl: graphsTable.thumbnailUrl,
      deletedAt: graphsTable.deletedAt,
      createdAt: graphsTable.createdAt,
      updatedAt: graphsTable.updatedAt,
    })
    .from(graphsTable)
    .where(and(eq(graphsTable.userId, userId), isNull(graphsTable.deletedAt)))
    .orderBy(desc(graphsTable.updatedAt));
}

/**
 * Load a single graph with permission check.
 *
 * Access rules:
 *   public/shared → readable by anyone
 *   private       → owner only
 *
 * Returns null in all "not found" cases — whether the graph doesn't exist,
 * is private and belongs to someone else, or is private and caller isn't authed.
 * Never distinguish between these cases to the caller.
 */
export async function getGraph(
  graphId: string,
  viewerId: string | null,
): Promise<Graph | null> {
  const [graph] = await db
    .select()
    .from(graphsTable)
    .where(and(eq(graphsTable.id, graphId), isNull(graphsTable.deletedAt)))
    .limit(1);

  if (!graph) return null;

  if (
    graph.visibility === "public" ||
    graph.visibility === "shared"
  ) {
    return graph;
  }

  // Private: only owner can read
  if (viewerId && graph.userId === viewerId) return graph;

  return null;
}

/** Get graph by share token (for shared links) */
export async function getGraphByShareToken(
  shareToken: string,
): Promise<Graph | null> {
  const [graph] = await db
    .select()
    .from(graphsTable)
    .where(
      and(
        eq(graphsTable.shareToken, shareToken),
        isNull(graphsTable.deletedAt),
        ne(graphsTable.visibility, "private"),
      ),
    )
    .limit(1);
  return graph ?? null;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface CreateGraphInput {
  title?: string;
  description?: string;
  data: Record<string, unknown>;
  visibility?: "private" | "public" | "shared";
}

export async function createGraph(
  userId: string,
  input: CreateGraphInput,
): Promise<Graph> {
  const [graph] = await db
    .insert(graphsTable)
    .values({
      userId,
      title: sanitizeTitle(input.title),
      description: input.description?.slice(0, MAX_GRAPH_DESCRIPTION_LENGTH) ?? null,
      data: input.data,
      visibility: input.visibility ?? "private",
    })
    .returning();

  if (!graph) throw new Error("Failed to create graph");
  return graph;
}

export interface UpdateGraphInput {
  title?: string;
  description?: string;
  data?: Record<string, unknown>;
  visibility?: "private" | "public" | "shared";
  thumbnailUrl?: string;
}

export async function updateGraph(
  graphId: string,
  userId: string,
  input: UpdateGraphInput,
  saveVersion = true,
): Promise<Graph | null> {
  // Verify ownership
  const [existing] = await db
    .select()
    .from(graphsTable)
    .where(
      and(
        eq(graphsTable.id, graphId),
        eq(graphsTable.userId, userId),
        isNull(graphsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!existing) return null;

  // Snapshot current version before overwriting
  if (saveVersion && input.data) {
    await saveGraphVersion(existing, "manual");
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) patch["title"] = sanitizeTitle(input.title);
  if (input.description !== undefined) {
    patch["description"] = input.description.slice(0, MAX_GRAPH_DESCRIPTION_LENGTH) || null;
  }
  if (input.data !== undefined) patch["data"] = input.data;
  if (input.visibility !== undefined) patch["visibility"] = input.visibility;
  if (input.thumbnailUrl !== undefined) patch["thumbnailUrl"] = input.thumbnailUrl || null;

  const [updated] = await db
    .update(graphsTable)
    .set(patch as typeof graphsTable.$inferInsert)
    .where(eq(graphsTable.id, graphId))
    .returning();

  return updated ?? null;
}

/** Generate or return existing share token */
export async function enableSharing(
  graphId: string,
  userId: string,
): Promise<string | null> {
  const [graph] = await db
    .select()
    .from(graphsTable)
    .where(
      and(
        eq(graphsTable.id, graphId),
        eq(graphsTable.userId, userId),
        isNull(graphsTable.deletedAt),
      ),
    )
    .limit(1);

  if (!graph) return null;

  if (graph.shareToken) {
    // Update visibility to shared if needed
    if (graph.visibility === "private") {
      await db
        .update(graphsTable)
        .set({ visibility: "shared", updatedAt: new Date() })
        .where(eq(graphsTable.id, graphId));
    }
    return graph.shareToken;
  }

  const shareToken = generateShareToken();
  await db
    .update(graphsTable)
    .set({ shareToken, visibility: "shared", updatedAt: new Date() })
    .where(eq(graphsTable.id, graphId));

  return shareToken;
}

/** Soft delete a graph */
export async function deleteGraph(
  graphId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .update(graphsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(graphsTable.id, graphId),
        eq(graphsTable.userId, userId),
        isNull(graphsTable.deletedAt),
      ),
    )
    .returning({ id: graphsTable.id });
  return result.length > 0;
}

// ── Versions ──────────────────────────────────────────────────────────────────

async function saveGraphVersion(
  graph: Graph,
  label: string,
): Promise<void> {
  // Get next version number
  const [maxRow] = await db
    .select({ max: sql<number>`COALESCE(MAX(version_number), 0)` })
    .from(graphVersionsTable)
    .where(eq(graphVersionsTable.graphId, graph.id));

  const nextVersion = (maxRow?.max ?? 0) + 1;

  await db.insert(graphVersionsTable).values({
    graphId: graph.id,
    userId: graph.userId,
    versionNumber: nextVersion,
    label,
    data: graph.data as Record<string, unknown>,
  });

  // Prune old versions beyond MAX_VERSIONS_KEPT
  await db.execute(sql`
    DELETE FROM graph_versions
    WHERE graph_id = ${graph.id}
      AND id NOT IN (
        SELECT id FROM graph_versions
        WHERE graph_id = ${graph.id}
        ORDER BY version_number DESC
        LIMIT ${MAX_VERSIONS_KEPT}
      )
  `);
}

export async function getGraphVersions(
  graphId: string,
  userId: string,
): Promise<Omit<GraphVersion, "data">[]> {
  return db
    .select({
      id: graphVersionsTable.id,
      graphId: graphVersionsTable.graphId,
      userId: graphVersionsTable.userId,
      versionNumber: graphVersionsTable.versionNumber,
      label: graphVersionsTable.label,
      createdAt: graphVersionsTable.createdAt,
    })
    .from(graphVersionsTable)
    .innerJoin(graphsTable, eq(graphVersionsTable.graphId, graphsTable.id))
    .where(
      and(
        eq(graphVersionsTable.graphId, graphId),
        eq(graphsTable.userId, userId),
      ),
    )
    .orderBy(desc(graphVersionsTable.versionNumber));
}

export async function restoreGraphVersion(
  graphId: string,
  userId: string,
  versionId: string,
): Promise<Graph | null> {
  const [version] = await db
    .select()
    .from(graphVersionsTable)
    .innerJoin(graphsTable, eq(graphVersionsTable.graphId, graphsTable.id))
    .where(
      and(
        eq(graphVersionsTable.id, versionId),
        eq(graphVersionsTable.graphId, graphId),
        eq(graphsTable.userId, userId),
      ),
    )
    .limit(1);

  if (!version) return null;

  return updateGraph(graphId, userId, { data: version.graph_versions.data as Record<string, unknown> }, true);
}
