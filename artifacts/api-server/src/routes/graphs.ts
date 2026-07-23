import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middlewares/authenticate";
import { requireAuth } from "../middlewares/require-auth";
import { requireFeature } from "../middlewares/require-feature";
import { validate } from "../middlewares/validate";
import {
  listUserGraphs,
  getGraph,
  getGraphByShareToken,
  createGraph,
  updateGraph,
  deleteGraph,
  enableSharing,
  getGraphVersions,
  restoreGraphVersion,
  validateGraphData,
} from "../services/graph.service";
import { incrementUsage } from "../services/usage.service";
import { hasFeature } from "../services/feature.service";
import { audit } from "../services/audit.service";
import { FEATURES, MAX_GRAPH_DATA_BYTES } from "../lib/constants";

const router = Router();

const createGraphSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  data: z.record(z.unknown()),
  visibility: z.enum(["private", "public", "shared"]).optional(),
});

const updateGraphSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(500).optional(),
  data: z.record(z.unknown()).optional(),
  visibility: z.enum(["private", "public", "shared"]).optional(),
  thumbnailUrl: z.string().url().max(500).optional().nullable(),
});

// ── GET /api/graphs/share/:token — public share link (no auth required) ───────
router.get("/share/:token", async (req, res) => {
  const graph = await getGraphByShareToken(String(req.params["token"]));
  if (!graph) {
    res.status(404).json({ error: "Graph not found." });
    return;
  }
  res.json({ graph });
});

// All remaining routes require auth
router.use(authenticate, requireAuth);

// ── GET /api/graphs — list user's graphs ──────────────────────────────────────
router.get("/", async (req, res) => {
  const graphs = await listUserGraphs(req.user!.id);
  res.json({ graphs });
});

// ── POST /api/graphs — create a graph ────────────────────────────────────────
router.post("/", validate(createGraphSchema), async (req, res) => {
  const { title, description, data, visibility } = req.body;

  // Validate graph data size
  const dataError = validateGraphData(data);
  if (dataError) {
    res.status(400).json({ error: dataError });
    return;
  }

  // Private graphs require the private_projects feature
  if (visibility === "private") {
    const check = await hasFeature(req.user!.id, FEATURES.PRIVATE_PROJECTS);
    if (!check.allowed) {
      // Fall back to public if private not available
      req.body.visibility = "public";
    }
  }

  try {
    const graph = await createGraph(req.user!.id, { title, description, data, visibility });

    // Track usage
    await incrementUsage(req.user!.id, "graphs_created");

    audit({
      actorId: req.user!.id,
      action: "graph.created",
      resourceType: "graph",
      resourceId: graph.id,
      req,
    });

    res.status(201).json({ graph });
  } catch (err) {
    req.log.error({ err }, "create graph error");
    res.status(500).json({ error: "Failed to create graph." });
  }
});

// ── GET /api/graphs/:id — load a graph ───────────────────────────────────────
router.get("/:id", async (req, res) => {
  const graph = await getGraph(String(req.params["id"]), req.user!.id);
  if (!graph) {
    res.status(404).json({ error: "Graph not found." });
    return;
  }
  res.json({ graph });
});

// ── PUT /api/graphs/:id — update a graph ─────────────────────────────────────
router.put("/:id", validate(updateGraphSchema), async (req, res) => {
  if (req.body.data !== undefined) {
    const dataError = validateGraphData(req.body.data);
    if (dataError) {
      res.status(400).json({ error: dataError });
      return;
    }
  }

  const graph = await updateGraph(String(req.params["id"]), req.user!.id, req.body);
  if (!graph) {
    res.status(404).json({ error: "Graph not found." });
    return;
  }

  audit({
    actorId: req.user!.id,
    action: "graph.updated",
    resourceType: "graph",
    resourceId: graph.id,
    req,
  });

  res.json({ graph });
});

// ── DELETE /api/graphs/:id ────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const deleted = await deleteGraph(String(req.params["id"]), req.user!.id);
  if (!deleted) {
    res.status(404).json({ error: "Graph not found." });
    return;
  }
  audit({
    actorId: req.user!.id,
    action: "graph.deleted",
    resourceType: "graph",
    resourceId: String(req.params["id"]),
    req,
  });
  res.json({ ok: true });
});

// ── POST /api/graphs/:id/share — enable sharing ────────────────────────────────
router.post(
  "/:id/share",
  requireFeature(FEATURES.GRAPH_SHARING),
  async (req, res) => {
    const shareToken = await enableSharing(String(req.params["id"]), req.user!.id);
    if (!shareToken) {
      res.status(404).json({ error: "Graph not found." });
      return;
    }
    audit({
      actorId: req.user!.id,
      action: "graph.shared",
      resourceType: "graph",
      resourceId: String(req.params["id"]),
      req,
    });
    res.json({ shareToken });
  },
);

// ── GET /api/graphs/:id/versions ──────────────────────────────────────────────
router.get(
  "/:id/versions",
  requireFeature(FEATURES.VERSION_HISTORY),
  async (req, res) => {
    const versions = await getGraphVersions(String(req.params["id"]), req.user!.id);
    res.json({ versions });
  },
);

// ── POST /api/graphs/:id/versions/:versionId/restore ──────────────────────────
router.post(
  "/:id/versions/:versionId/restore",
  requireFeature(FEATURES.VERSION_HISTORY),
  async (req, res) => {
    const graph = await restoreGraphVersion(
      String(req.params["id"]),
      req.user!.id,
      String(req.params["versionId"]),
    );
    if (!graph) {
      res.status(404).json({ error: "Version not found." });
      return;
    }
    res.json({ graph });
  },
);

export default router;
