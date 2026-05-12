# Sendify

> Custom email marketing platform for the Divain brand group.
> A Klaviyo replacement built on Amazon SES — multi-store, 22 languages,
> design-approval gated, integrated with Shopify Plus and Google Ads.

```
~20M emails/month  ·  22 languages  ·  4 Shopify Plus stores
SES + DeepL + Gemini + Postgres + BullMQ on AWS
```

## Why

At 20M emails/month Klaviyo would cost $15–25k/mo. SES at the same volume is ~$2k/mo.
Sendify keeps the parts of Klaviyo that matter (flows, segmentation, deliverability tooling)
and replaces the parts that don't (closed editor, weak translation, opaque costs) with:

- **MJML rendering** so emails actually look the same across Outlook, Gmail and Apple Mail
- **DeepL Pro with a brand glossary** and an aggressive translation cache — fan-out to 22 languages
  costs cents instead of dollars per campaign
- **Per-country promotional calendar** that auto-drafts campaigns N days before each market's
  Mother's Day, Father's Day, BFCM, etc.
- **Hard approval gate** — nothing leaves the platform until you click approve
- **Push suppression** — if a customer has the app and got a push in the last 24h, skip the email
  (source: Shopify customer metafield, mirrored to Postgres)
- **Live cost estimation** while you build a campaign, broken down by SES, DeepL and Gemini
- **Nano Banana banner generation** with brand palette injected and no-text-in-image enforced
  (text in banners destroys multilingual fan-out)

## Stack

| Layer | Choice |
|---|---|
| Frontend + backend | Next.js 15 (App Router) + TypeScript + Server Actions |
| UI | Tailwind v4 + shadcn/ui · dark-first, luxury-minimal |
| Database | Postgres + Prisma |
| Queue | BullMQ + Redis (ElastiCache in prod) |
| Email rendering | MJML server-side · Unlayer embedded editor |
| Translation | DeepL Pro + brand glossary + cache · GPT-4 review for promotional copy |
| Image generation | Gemini 2.5 Flash Image (Nano Banana) |
| Auth | Auth.js v5 · magic link |
| Sending | Amazon SES v2 + SNS bounces/complaints → suppression list |
| Hosting | AWS (ECS Fargate + RDS + ElastiCache + S3 + CloudFront), same account as SES |
| Asset CDN | S3 + CloudFront |
| Shopify | GraphQL Admin API + webhooks (4 stores) |
| Google Ads | Customer Match · audience read/write |

## Local setup

Requirements: macOS or Linux, Docker (for Postgres + Redis). Node is installed by the script if missing.

```bash
./setup.sh
npm run dev
# → http://localhost:3000
```

What `setup.sh` does:
1. Installs Node 22 via nvm if it isn't on your PATH
2. Runs `npm install`
3. `docker compose up -d` to start Postgres on :5432 and Redis on :6379
4. Copies `.env.example` to `.env`
5. Generates the Prisma client and pushes the schema
6. Seeds the DB with 4 stores, 4 senders, 22 languages, 9 promotions, 8 segments, 8 sample campaigns
7. Tells you to run `npm run dev`

## Project layout

```
src/
  app/
    (app)/            ← authenticated app shell
      dashboard/      ← KPIs, charts, upcoming sends, cost tracker
      campaigns/      ← list · new (4-step wizard) · [id] preview per language
      flows/          ← Welcome / Abandoned cart / Win-back / etc.
      calendar/       ← Per-country promotional calendar
      approvals/      ← Pending approval inbox (the gate)
      customers/      ← Synced from Shopify, app state + language visible
      segments/       ← Visual builder (placeholder)
      templates/      ← MJML templates
      assets/         ← Library + Nano Banana generator
      translations/   ← Glossary + cache coverage
      reports/        ← Performance + revenue attribution
      settings/       ← Senders · Stores · Languages · Integrations · Team · API · Compliance
    login/            ← Magic-link sign-in
  components/
    ui/               ← Buttons, cards, dialogs, etc. (shadcn-style)
    app/              ← Sidebar, topbar, logo, status badge, page header
    charts/           ← Recharts area/donut/bar
  lib/
    db.ts             ← Prisma client
    auth.ts           ← Auth.js config
    ses.ts            ← Amazon SES adapter
    deepl.ts          ← DeepL Pro adapter with cache
    shopify.ts        ← Shopify Plus client + AppState helpers
    mjml.ts           ← MJML compile + per-recipient personalization
    gemini.ts         ← Nano Banana banner generation
    cost.ts           ← Cost estimator (SES + DeepL + Gemini)
    languages.ts      ← The 22 supported languages with DeepL codes
    mock.ts           ← Deterministic mock data for the UI
prisma/
  schema.prisma       ← Full domain model
  seed.ts             ← Local DB seed
```

## What's wired vs what's stubbed

| Feature | Status |
|---|---|
| UI for everything below | ✅ Built |
| Domain schema (Prisma) | ✅ Complete |
| Cost estimator | ✅ Working (pure function) |
| MJML rendering | ✅ Working |
| SES send | 🔌 Adapter ready · needs AWS creds + verified senders |
| DeepL translate + cache | 🔌 Adapter ready · needs DEEPL_API_KEY |
| Shopify sync | 🔌 Adapter ready · needs per-store access tokens |
| Gemini banner generation | 🔌 Adapter ready · needs GEMINI_API_KEY |
| Approval workflow | 🟡 UI only · server actions to wire next |
| Promotional auto-drafting | 🟡 UI only · cron + draft generator to wire next |
| BullMQ send queue | 🟡 Redis ready · worker to wire next |
| SES bounce/complaint webhooks | 🟡 Schema ready · `/api/ses/events` to wire next |
| Auth (Auth.js magic link) | 🟡 Config ready · login UI built · email-sending to wire next |
| Google Ads Customer Match | 🟡 Schema ready · client to wire next |

## Promotion sync — connecting your external calendar tool

You already maintain a promotional calendar in another project. Sendify mirrors it via a **push webhook** (recommended) so the upstream tool stays the source of truth and Sendify reacts within seconds.

### Why push (not pull)

- Real-time: a promo edit propagates instantly. No 5-minute polling lag.
- Cheap: no scheduled job hammering your endpoint.
- Simpler on Sendify's side: stateless idempotent upsert.
- The upstream only needs to know one URL + one secret.

### Contract

```http
POST https://sendify.app/api/promotions/webhook
Content-Type: application/json
X-Sendify-Signature: sha256=<hex(hmac_sha256(secret, raw_body))>

{
  "externalId":     "promo_2026_madres_es",      // required, unique in your system
  "externalSource": "marketing-calendar",         // free-form
  "action":         "upsert" | "delete",          // default: upsert
  "name":           "Día de la Madre",
  "kind":           "REGIONAL" | "GLOBAL" | "STORE",
  "storeId":        "st_1",                        // optional; omit = applies to all stores
  "dateByCountry":  { "ES": "2026-05-03", "PT": "2026-05-03" },
  "autoDraft":      true,
  "leadDays":       14,
  "defaultSegmentIds": ["sg_1"],
  "bannerPrompt":   "Mother's Day · luxury minimal · warm gold and ivory · no text",
  "briefForLlm":    "Focus on top 3 women's florals. Tone warm, refined.",
  "copyByLang":     { "es-ES": { "subject": "…", "hero": "…" } }   // optional manual overrides
}
```

Sendify's response:

```json
{ "ok": true, "syncedAt": "2026-05-12T10:42:00Z", "externalId": "promo_2026_madres_es", "action": "upsert" }
```

### What happens when a promotion arrives

1. Sendify upserts the row keyed on `externalId`.
2. For every market in `dateByCountry`, Sendify checks: is `dateByCountry[market] - leadDays` in the past? If yes and no campaign exists for this (promotion, store, market) yet, the auto-drafter runs immediately.
3. Otherwise it's queued — the hourly cron picks it up at the right time.
4. Each auto-draft lands in `/approvals` with `draftSource: AUTO_PROMOTION` and a `draftReason` line.

### The signing secret

Set `PROMOTIONS_WEBHOOK_SECRET` in Sendify's environment. In your project, sign every request body the same way:

```ts
import { createHmac } from "node:crypto";
const sig = "sha256=" + createHmac("sha256", process.env.SENDIFY_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest("hex");
fetch("https://sendify.app/api/promotions/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Sendify-Signature": sig },
  body: rawBody,
});
```

Sendify rejects unsigned or wrongly-signed requests with `401`. In local dev (no secret set) the check is skipped so you can hit it with `curl`.

### Pull as a fallback

If you'd rather keep your tool fully closed and not call out, set `PROMOTION_PULL_URL` in Sendify. The hourly cron fetches that URL, expects the same JSON shape in an array, and diffs against the local copy. This adds 5-60 min of latency but keeps the integration unidirectional. Not the default.

## Auto-drafter — how a campaign builds itself

Inputs:
- a `Promotion` (from the calendar)
- the target `Store` (with its brand kit + legal entity)
- the current product catalog (filtered to in-stock items for that store)

The drafter ([src/lib/autodraft.ts](src/lib/autodraft.ts)) produces a complete `CampaignDraft`:

1. **Schedule**: `promotion.dateByCountry[store.countryCode]` at 08:00 store-local.
2. **Copy**: if `OPENAI_API_KEY` is set, runs a brand-voice prompt against GPT-4 with the store's tone profile. Otherwise uses a vetted fallback table keyed on `(promotion.name, language)`.
3. **Hero**: queues a Gemini Nano Banana banner with the store's palette injected and `no text in image` enforced.
4. **Products**: picks the top 3 in-stock items for the store. Production swaps this for a real recommender (top sellers last 7d, restocked, on-trend).
5. **Audience**: applies `promotion.defaultSegmentIds`; falls back to "All subscribed for this store".
6. **Languages**: every BCP-47 language mapped to any country in `store.markets`.
7. **Footer**: locked to the store's legal entity (razón social, CIF, dirección, etc.).
8. Persists as `Campaign(status: PENDING_APPROVAL, draftSource: AUTO_PROMOTION)` and notifies the approver.

You can also trigger a draft manually from `/calendar` — click "Auto-draft" on any promotion card. That hits `POST /api/promotions/:id/draft` with a `storeId` body.

## Sending pipeline (implemented)

The pipeline lives in [src/lib/pipeline/](src/lib/pipeline/) + [src/lib/queue.ts](src/lib/queue.ts) + [src/lib/audience.ts](src/lib/audience.ts). Worker entry point: [scripts/worker.ts](scripts/worker.ts) (run with `npm run worker`).

```
Reviewer clicks "Approve & schedule"
       ▼
POST /api/campaigns/[id]/approve
       │
       ├─ approveCampaign() — orchestrator (atomic):
       │    1. PENDING_APPROVAL → APPROVED (DB tx + Approval row)
       │    2. translateVariant() ×N languages   ─── DeepL cache → DeepL API → glossary
       │    3. renderVariant()    ×N languages   ─── MJML → cross-client HTML + hash
       │    4. resolveAudience()                 ─── segments ∪ − suppressions − app-recent − consent
       │    5. createSendLedger()                ─── bulk insert Send rows (status QUEUED)
       │    6. sendQueue.addBulk()               ─── BullMQ jobs into Redis (1000 at a time)
       │    7. APPROVED → SENDING
       ▼
BullMQ queue (Redis)                    npm run worker  ──┐
       │                                                  ▼
       │                              startSendWorker()
       │                                  │
       │                                  ├─ pop SendJob
       │                                  ├─ re-check suppression (catches bounces between approve and send)
       │                                  ├─ personalize HTML (tokens: first_name, discount_code, unsubscribe URL)
       │                                  ├─ SES SendEmail   ─── rate-limited via BullMQ limiter
       │                                  │                       (SES_RATE_PER_SECOND env, default 14)
       │                                  ├─ Send.status → SENT + messageId
       │                                  └─ on failure: exponential backoff, max 5 attempts, then FAILED

SES → SNS → POST /api/ses/events
       │
       ├─ Delivery   → Send.status DELIVERED
       ├─ Open       → Send.status OPENED · openedAt
       ├─ Click      → Send.status CLICKED · clickedAt
       ├─ Bounce     → Send.status BOUNCED · if hard → Suppression
       └─ Complaint  → Send.status COMPLAINED + Suppression
```

### Running locally

Three processes (in three terminals):

```bash
docker compose up -d            # Postgres on 5432, Redis on 6379
npm run dev                     # Next.js UI on :3000
npm run worker                  # send worker · drains the BullMQ queue
```

The dev server boots even without Redis — only the worker and the approve action need it. If Redis is down when you click Approve, the campaign still flips to APPROVED + variants get rendered, and the API returns a 202 so you can QA the email without sending.

### Live progress

`/campaigns/[id]` mounts a `<SendingMonitor>` when the campaign is in `SENDING`. It polls `/api/campaigns/[id]/progress` every 2 seconds and shows:

- Sent / total + percent + progress bar
- Counts: Queued · Delivered · Opened · Clicked · Failed
- BullMQ depth (active + waiting)
- Skipped-at-send-time stats (consent + app-recent)
- Pause polling button + Cancel send button (drains the queue)

### Cancellation

POST `/api/campaigns/[id]/cancel`:
- Campaign → CANCELLED
- Pending Send rows → FAILED with reason "campaign cancelled"
- Drains BullMQ queue of jobs for that campaignId (scans + removes)
- Already-sent emails stay SENT — you can't unsend mail that left SES

### Production deploy

Worker runs as a **separate ECS Fargate service** from the Next.js UI. This way a UI deploy never restarts an in-flight send. One worker handles ~200 emails/sec easily; for 1000+ emails/sec run 2-3 workers — BullMQ's Redis-backed limiter coordinates the global rate across them.

Required env:
- `REDIS_URL` — ElastiCache Redis
- `DATABASE_URL` — RDS Postgres
- `AWS_REGION` + IAM role with `ses:SendEmail` permission (or `AWS_ACCESS_KEY_ID` for dev)
- `SES_CONFIGURATION_SET` — your SES configuration set with engagement tracking → SNS
- `SES_RATE_PER_SECOND` — your approved SES quota (start 14, raise to 200+ after warming)
- `NEXT_PUBLIC_APP_URL` — used to build unsubscribe URLs in outgoing emails



```
Campaign approved
  ├─► Resolve audience (segments ∪) - suppressions - app-recent
  ├─► For each recipient language:
  │     ├─ Translate subject/preheader (DeepL cache → DeepL API)
  │     ├─ Render MJML → HTML (snapshot per language)
  │     └─ Enqueue per-recipient send job (BullMQ)
  └─► Worker pulls jobs → SES SendEmail → record in `Send` ledger

SES → SNS → /api/ses/events
  ├─ DELIVERED  → update Send
  ├─ BOUNCE     → update Send + add to Suppression if hard bounce
  ├─ COMPLAINT  → update Send + add to Suppression
  ├─ OPEN       → update Send.openedAt
  └─ CLICK      → update Send.clickedAt + attribution
```

## Production checklist (before the first real send)

- [ ] SES out-of-sandbox + production rate increase requested (target 100+ emails/sec)
- [ ] All 4 sender domains verified · DKIM + SPF + DMARC records published
- [ ] SES configuration set with engagement tracking + SNS topic for events
- [ ] One-click unsubscribe URL signed and routed
- [ ] Shopify Plus webhooks installed on all 4 stores
- [ ] Customer metafields `app.installed` and `app.last_push_at` populated by the mobile backend
- [ ] DeepL Pro account + glossary uploaded
- [ ] Brand glossary reviewed by a native speaker per language (start with es/fr/de/it/pt)
- [ ] Google Ads Customer Match access granted to the developer token
- [ ] Sentry project created + DSN configured
- [ ] CloudWatch alarms on SES bounce rate and complaint rate

## Commands

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run db:push      # Apply Prisma schema to DB
npm run db:migrate   # Create a migration
npm run db:seed      # Seed DB with Divain dev data
npm run db:studio    # Browse the DB in Prisma Studio
```

## Pricing model (at scale)

At ~20M emails/month, expected monthly cost (USD):

| Provider | Cost |
|---|---|
| Amazon SES | ~$2,000 |
| SES data transfer (CDN-served images) | ~$50–150 |
| DeepL Pro (60–70% cache hit) | ~$200–500 |
| AWS infra (RDS + ECS + ElastiCache + S3 + CloudFront) | ~$300–600 |
| Gemini Nano Banana (banner gen) | ~$100–300 |
| **Total** | **~$2,700–3,500** |

vs Klaviyo at the same volume: $15k–25k/mo.
