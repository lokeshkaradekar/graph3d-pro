# Graph3D Pro — deployable package

This is the integrated app: one Express service (`artifacts/api-server`) that
serves the API under `/api/*` **and** the redesigned frontend as static files
from `artifacts/api-server/public/`. Same-origin by design — no CORS/cookie
config needed for the frontend↔backend connection itself.

## What's in here (trimmed for deploy — no `node_modules`/`.git`/Replit caches)

```
artifacts/api-server/   the service: src/ (TS), public/ (frontend), build.mjs
lib/db/                 Drizzle schema + migrations (drizzle-kit push/seed)
lib/api-zod/            shared Zod request/response schemas
lib/api-spec/           OpenAPI spec
scripts/                minor workspace tooling (post-merge hook)
package.json, pnpm-workspace.yaml, pnpm-lock.yaml, tsconfig*.json
```

## Install & run

```
pnpm install
pnpm --filter @workspace/db push      # applies the DB schema — see note below
pnpm --filter @workspace/db seed      # seeds the 5 plans + feature flags
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start
```

`pnpm --filter @workspace/db push` is **required** before first run this time,
not just a formality — this package includes a schema change (see "What I
changed" below) that adds a new unique index, which won't exist in an
already-provisioned database until you push it.

## Required environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `PORT` | server port |
| `NODE_ENV` | `development` or `production` |
| `APP_URL` | used to build links in emails |
| `CORS_ORIGINS` | comma-separated allowed origins (defense-in-depth; same-origin deploys don't strictly need this, but the server reads it either way) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe |
| `STRIPE_PRICE_<PLAN>_<CYCLE>` | one per paid plan/cycle, e.g. `STRIPE_PRICE_PRO_MONTHLY` — matches whatever plan slugs the seed script creates |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `SMTP_FROM` | email verification / password reset |
| `OPENROUTER_API_KEY`, `AI_MODEL` | the AI chat feature (`/api/chat`) |
| `LOG_LEVEL` | pino log level |

No `SESSION_SECRET` is used by this app's own auth system — sessions are
random tokens, hashed before storage, not HMAC-signed. (If you saw a
"Session Secret" control in Replit's UI, that's Replit's own separate
prebuilt "Users & Auth" feature, unrelated to this custom auth system.)

## What I changed in this pass

**Backend — correctness fixes on the payment→feature-access path**
(`lib/db/src/schema/subscriptions.ts`, `services/feature.service.ts`,
`services/subscription.service.ts`):
- `getEffectivePlanId()` sorted subscriptions ascending (no `.desc()`), so if
  a user ever had more than one qualifying row it would resolve their
  **oldest** plan instead of their current one.
- `activatePaidSubscription()` canceled the old subscription and inserted the
  new one as two separate statements — a real race window where two
  near-simultaneous webhook deliveries for the same user could each insert
  an "active" row. Wrapped in a transaction, **and** added a partial unique
  index (`subscriptions_one_active_per_user`) as the actual airtight fix,
  since a transaction alone doesn't fully close this under Postgres's
  default isolation level — the DB now rejects the second concurrent insert
  outright instead of silently creating a duplicate.

**Frontend — two confirmed UI bugs** (`public/modules/mod-cloud.js`):
- The Save Graph dialog is a plain `<div>` shown via a CSS `.open` class, but
  the code called `.showModal()`/`removeAttribute('hidden')` — neither of
  which that CSS responds to. **The dialog never opened**, from any of its 3
  trigger points (toolbar button, cloud panel, keyboard shortcut).
- The visibility dropdown was hardcoded to reset to "private" every time the
  dialog opened, regardless of the graph's actual current visibility — so
  resaving an already-shared graph would silently revert it to private,
  breaking any distributed link with no indication anything changed. Now
  tracks and restores the graph's real current visibility.

I also diffed this whole package against my last known-good copy of the math
engine / graph builder / marching cubes / polar curve work from earlier in
this project — all of that survived intact; this agent build extended it
(new GLSL-style math helpers) rather than reverting anything.

## What I have not verified end-to-end

I don't have a live Postgres instance, Stripe test account, or browser here,
so none of this has actually been *run* — it's verified by careful reading
and cross-referencing against the real schema/route/service code, the same
way as everything else this session. Worth a real smoke test (signup →
checkout → webhook → confirm `hasFeature()` reflects it immediately) before
calling the billing path production-ready.

## Known, deliberate gap (not a bug)

The old lightweight backend (`graph3d-pro`'s original Vercel `api/`
functions) had a "collections" concept (grouping graphs). That didn't get
ported to this backend/frontend — there's no collections UI or schema here.
If you want it, it'd need a new `collections` table + routes + a
`mod-collections.js`-equivalent, none of which exist yet.
