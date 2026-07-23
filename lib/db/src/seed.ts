/**
 * Database seed — inserts the canonical plan definitions and their features.
 *
 * Run: pnpm --filter @workspace/db run seed
 *
 * Idempotent: uses ON CONFLICT DO NOTHING so it can be re-run safely.
 * If you change a plan's features, run with --reset to wipe and re-seed.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
const db = drizzle(pool);

// ── Plan definitions ──────────────────────────────────────────────────────────

type PlanDef = {
  slug: string;
  displayName: string;
  description: string;
  priceMonthlycents: number;
  priceYearlyCents: number;
  currency: string;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  features: FeatureDef[];
};

type FeatureDef = {
  featureName: string;
  limitValue: number | null;   // null = unlimited, 0 = disabled, N = quota
  limitPeriod: string | null;  // monthly | yearly | null (all-time)
};

const plans: PlanDef[] = [
  {
    slug: "free",
    displayName: "Free",
    description: "Get started with Graph3D at no cost.",
    priceMonthlycents: 0,
    priceYearlyCents: 0,
    currency: "USD",
    isActive: true,
    isPublic: true,
    sortOrder: 0,
    features: [
      { featureName: "graph_editor", limitValue: null, limitPeriod: null },
      { featureName: "graphs_created", limitValue: 5, limitPeriod: "all-time" },
      { featureName: "storage_bytes", limitValue: 10_485_760, limitPeriod: null }, // 10 MB
    ],
  },
  {
    slug: "student",
    displayName: "Student",
    description: "Discounted plan for students and educators.",
    priceMonthlycents: 499,
    priceYearlyCents: 3999,
    currency: "USD",
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    features: [
      { featureName: "graph_editor", limitValue: null, limitPeriod: null },
      { featureName: "graphs_created", limitValue: 50, limitPeriod: "all-time" },
      { featureName: "storage_bytes", limitValue: 524_288_000, limitPeriod: null }, // 500 MB
      { featureName: "private_projects", limitValue: null, limitPeriod: null },
      { featureName: "version_history", limitValue: 10, limitPeriod: null },
      { featureName: "graph_sharing", limitValue: null, limitPeriod: null },
      { featureName: "ai_assistant", limitValue: 50, limitPeriod: "monthly" },
      { featureName: "ai_requests", limitValue: 50, limitPeriod: "monthly" },
      { featureName: "exports", limitValue: 20, limitPeriod: "monthly" },
    ],
  },
  {
    slug: "pro",
    displayName: "Pro",
    description: "Everything you need for professional Graph3D work.",
    priceMonthlycents: 1999,
    priceYearlyCents: 15999,
    currency: "USD",
    isActive: true,
    isPublic: true,
    sortOrder: 2,
    features: [
      { featureName: "graph_editor", limitValue: null, limitPeriod: null },
      { featureName: "graphs_created", limitValue: null, limitPeriod: null }, // unlimited
      { featureName: "storage_bytes", limitValue: 5_368_709_120, limitPeriod: null }, // 5 GB
      { featureName: "private_projects", limitValue: null, limitPeriod: null },
      { featureName: "version_history", limitValue: 50, limitPeriod: null },
      { featureName: "graph_sharing", limitValue: null, limitPeriod: null },
      { featureName: "ai_assistant", limitValue: 500, limitPeriod: "monthly" },
      { featureName: "ai_requests", limitValue: 500, limitPeriod: "monthly" },
      { featureName: "exports", limitValue: null, limitPeriod: null },
      { featureName: "priority_rendering", limitValue: null, limitPeriod: null },
      { featureName: "gpu_renders", limitValue: 100, limitPeriod: "monthly" },
    ],
  },
  {
    slug: "professional",
    displayName: "Professional",
    description: "Advanced features for power users and small teams.",
    priceMonthlycents: 4999,
    priceYearlyCents: 39999,
    currency: "USD",
    isActive: true,
    isPublic: true,
    sortOrder: 3,
    features: [
      { featureName: "graph_editor", limitValue: null, limitPeriod: null },
      { featureName: "graphs_created", limitValue: null, limitPeriod: null },
      { featureName: "storage_bytes", limitValue: null, limitPeriod: null },
      { featureName: "private_projects", limitValue: null, limitPeriod: null },
      { featureName: "version_history", limitValue: null, limitPeriod: null },
      { featureName: "graph_sharing", limitValue: null, limitPeriod: null },
      { featureName: "ai_assistant", limitValue: 2000, limitPeriod: "monthly" },
      { featureName: "ai_requests", limitValue: 2000, limitPeriod: "monthly" },
      { featureName: "exports", limitValue: null, limitPeriod: null },
      { featureName: "priority_rendering", limitValue: null, limitPeriod: null },
      { featureName: "gpu_renders", limitValue: 500, limitPeriod: "monthly" },
      { featureName: "api_access", limitValue: null, limitPeriod: null },
      { featureName: "team_sharing", limitValue: null, limitPeriod: null },
      { featureName: "advanced_analytics", limitValue: null, limitPeriod: null },
    ],
  },
  {
    slug: "enterprise",
    displayName: "Enterprise",
    description: "Custom limits, SSO, and dedicated support for large teams.",
    priceMonthlycents: 0, // negotiated — handled outside checkout
    priceYearlyCents: 0,
    currency: "USD",
    isActive: true,
    isPublic: false, // hidden from public pricing page
    sortOrder: 4,
    features: [
      { featureName: "graph_editor", limitValue: null, limitPeriod: null },
      { featureName: "graphs_created", limitValue: null, limitPeriod: null },
      { featureName: "storage_bytes", limitValue: null, limitPeriod: null },
      { featureName: "private_projects", limitValue: null, limitPeriod: null },
      { featureName: "version_history", limitValue: null, limitPeriod: null },
      { featureName: "graph_sharing", limitValue: null, limitPeriod: null },
      { featureName: "ai_assistant", limitValue: null, limitPeriod: null },
      { featureName: "ai_requests", limitValue: null, limitPeriod: null },
      { featureName: "exports", limitValue: null, limitPeriod: null },
      { featureName: "priority_rendering", limitValue: null, limitPeriod: null },
      { featureName: "gpu_renders", limitValue: null, limitPeriod: null },
      { featureName: "api_access", limitValue: null, limitPeriod: null },
      { featureName: "team_sharing", limitValue: null, limitPeriod: null },
      { featureName: "advanced_analytics", limitValue: null, limitPeriod: null },
      { featureName: "sso", limitValue: null, limitPeriod: null },
      { featureName: "audit_logs_export", limitValue: null, limitPeriod: null },
      { featureName: "dedicated_support", limitValue: null, limitPeriod: null },
      { featureName: "custom_branding", limitValue: null, limitPeriod: null },
    ],
  },
];

// ── Seed ──────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding plans...");

  for (const plan of plans) {
    // Upsert the plan
    const inserted = await db.execute(sql`
      INSERT INTO plans (
        slug, display_name, description,
        price_monthly_cents, price_yearly_cents, currency,
        is_active, is_public, sort_order,
        created_at, updated_at
      ) VALUES (
        ${plan.slug}, ${plan.displayName}, ${plan.description},
        ${plan.priceMonthlycents}, ${plan.priceYearlyCents}, ${plan.currency},
        ${plan.isActive}, ${plan.isPublic}, ${plan.sortOrder},
        NOW(), NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        display_name    = EXCLUDED.display_name,
        description     = EXCLUDED.description,
        price_monthly_cents = EXCLUDED.price_monthly_cents,
        price_yearly_cents  = EXCLUDED.price_yearly_cents,
        is_active       = EXCLUDED.is_active,
        is_public       = EXCLUDED.is_public,
        sort_order      = EXCLUDED.sort_order,
        updated_at      = NOW()
      RETURNING id
    `);

    const planId = (inserted as any).rows[0].id;
    console.log(`  ✓ Plan '${plan.slug}' → ${planId}`);

    // Clear existing features for idempotency, then re-insert
    await db.execute(sql`DELETE FROM plan_features WHERE plan_id = ${planId}`);

    for (const feat of plan.features) {
      await db.execute(sql`
        INSERT INTO plan_features (
          plan_id, feature_name, limit_value, limit_period, created_at, updated_at
        ) VALUES (
          ${planId}, ${feat.featureName},
          ${feat.limitValue ?? null},
          ${feat.limitPeriod ?? null},
          NOW(), NOW()
        )
      `);
    }
    console.log(`    └─ ${plan.features.length} features`);
  }

  console.log("\nSeed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
