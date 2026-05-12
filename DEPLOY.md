# Sendify · Production deploy

End-to-end checklist to get Sendify live in your AWS account (same one as your existing SES).

**Architecture:**

```
┌──────────────────────────────┐        ┌─────────────────────────────────────────┐
│  Vercel (Next.js UI)         │ ──HTTPS──►│  AWS account (same as SES)             │
│  · /campaigns, /approvals…   │        │                                         │
│  · POST /api/...             │        │  ┌─────────────┐  ┌──────────────────┐  │
└──────────────────────────────┘        │  │ RDS Postgres │◄─┤  RDS Proxy       │  │
              ▲                         │  │ db.m6g.large │  │  (pooler)        │  │
              │                         │  └──────────────┘  └──────────────────┘  │
              │                         │                              ▲           │
              │                         │  ┌──────────────────────────┴─────────┐ │
              │                         │  │  ECS Fargate · BullMQ worker (2×)  │ │
              │                         │  │  pulls from ECR · runs npm run worker│
              │                         │  └────────────┬──────────────────────┘ │
              │                         │               ▼                          │
              │                         │  ┌──────────────────┐                    │
              │                         │  │ ElastiCache Redis │                    │
              │                         │  │ cache.t4g.medium  │                    │
              │                         │  └──────────────────┘                    │
              │                         │               │                          │
              │                         │               ▼                          │
              └─────────────HTTP webhook◄────┐  ┌──────────────────┐ ─SendEmail─►  │
                  /api/ses/events            │  │  Amazon SES      │                │
                                              │  │  (your existing) │                │
                                              │  └──────────────────┘                │
                                              │            │                         │
                                              │            ▼                         │
                                              │  ┌──────────────────┐                │
                                              │  │  SNS topic       │                │
                                              │  │  → bounces/opens │                │
                                              │  └──────────────────┘                │
                                              └─────────────────────────────────────┘

Assets: S3 sendify-assets-<account> → CloudFront (cdn.divain.space)
Secrets: AWS Secrets Manager · ECS pulls at boot · Vercel pulls via CLI sync
```

**Estimated cost at 20M emails/mo:** ~$3,000/mo total (~$460 infra + ~$2,500 providers).

---

## Phase 1 — One-time AWS setup (~30 min)

You'll need: AWS account admin access, Terraform 1.7+, AWS CLI, Docker.

### 1. Backend bucket for Terraform state

```bash
aws s3 mb s3://divain-terraform-state --region eu-west-1
aws s3api put-bucket-versioning \
  --bucket divain-terraform-state \
  --versioning-configuration Status=Enabled
```

### 2. OIDC role for GitHub Actions

The CI/CD pipeline assumes an AWS role via OIDC (no long-lived secrets in GitHub). Create it once:

```bash
# Replace YOUR_ORG/YOUR_REPO with your GitHub path
ROLE_NAME=sendify-github-deploy
ORG_REPO="divain/sendify"

aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 || true

cat > /tmp/trust.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:${ORG_REPO}:*" }
    }
  }]
}
EOF

aws iam create-role --role-name $ROLE_NAME --assume-role-policy-document file:///tmp/trust.json
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser
aws iam attach-role-policy --role-name $ROLE_NAME --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

Copy the role ARN — you'll paste it as `AWS_DEPLOY_ROLE_ARN` secret in GitHub later.

### 3. Provision infra with Terraform (~15 min, RDS is slow)

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# (edit terraform.tfvars if you want different sizing)

terraform init
terraform plan -out=plan.bin
terraform apply plan.bin
```

When it completes, save the outputs:

```bash
terraform output -json > /tmp/sendify-outputs.json
terraform output database_url   # store this securely
terraform output redis_url
terraform output cdn_url
terraform output ecr_app_repo_url
terraform output ecr_worker_repo_url
```

### 4. Populate provider keys in Secrets Manager

The Terraform created empty secrets for the API keys; fill them now via the AWS Console (Secrets Manager → `sendify/DEEPL_API_KEY` etc.) or:

```bash
aws secretsmanager put-secret-value --secret-id sendify/DEEPL_API_KEY     --secret-string "$(read -s; echo $REPLY)"
aws secretsmanager put-secret-value --secret-id sendify/GEMINI_API_KEY    --secret-string "$(read -s; echo $REPLY)"
aws secretsmanager put-secret-value --secret-id sendify/OPENAI_API_KEY    --secret-string "$(read -s; echo $REPLY)"
aws secretsmanager put-secret-value --secret-id sendify/AUTH_SECRET       --secret-string "$(openssl rand -base64 32)"
aws secretsmanager put-secret-value --secret-id sendify/PROMOTIONS_WEBHOOK_SECRET --secret-string "$(openssl rand -base64 32)"
aws secretsmanager put-secret-value --secret-id sendify/SHOPIFY_API_KEY    --secret-string "$(read -s; echo $REPLY)"
aws secretsmanager put-secret-value --secret-id sendify/SHOPIFY_API_SECRET --secret-string "$(read -s; echo $REPLY)"
```

### 5. SES — connect events to Sendify

Your SES is already verified. Wire engagement events to Sendify:

```bash
# 1. Create an SNS topic for SES events
aws sns create-topic --name sendify-ses-events
TOPIC_ARN=$(aws sns list-topics --query "Topics[?contains(TopicArn,'sendify-ses-events')].TopicArn | [0]" --output text)

# 2. Subscribe Sendify's webhook
aws sns subscribe \
  --topic-arn $TOPIC_ARN \
  --protocol https \
  --notification-endpoint "https://sendify.divain.space/api/ses/events"

# 3. Update your SES configuration set to publish to it
#    AWS Console → SES → Configuration sets → sendify-default → Event publishing → Add destination
#    Event types: send, delivery, bounce, complaint, open, click
#    Destination: SNS → sendify-ses-events
```

When the SNS subscription confirmation request hits Sendify, our `/api/ses/events` route auto-confirms it.

---

## Phase 2 — First deploy (~10 min)

### 1. Push code to GitHub

```bash
# In the project root
git remote add origin git@github.com:divain/sendify.git
git push -u origin main
```

### 2. Add GitHub Action secrets

GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | The ARN from Phase 1 step 2 |

### 3. Trigger the workflow

```bash
git commit --allow-empty -m "ci: trigger first deploy"
git push
```

GitHub Actions does:
1. Builds + pushes both Docker images to ECR
2. Pulls DIRECT_URL from Secrets Manager
3. Runs `prisma migrate deploy` against RDS
4. Forces a new ECS deployment of the worker
5. Waits for stable rollout

### 4. Seed the database (first run only)

```bash
# Get the direct URL
DIRECT_URL=$(aws secretsmanager get-secret-value --secret-id sendify/app --query SecretString --output text | jq -r .DIRECT_URL)
DATABASE_URL=$DIRECT_URL npm run db:seed
```

---

## Phase 3 — Deploy the UI to Vercel (~5 min)

### 1. Connect the repo

```bash
npm i -g vercel
vercel link
vercel env pull
```

### 2. Add Vercel env vars

Vercel dashboard → Project → Settings → Environment Variables. Paste each of these (production scope):

```
DATABASE_URL          = (terraform output database_url)
DIRECT_URL            = (terraform output direct_url)   ← only for migrations, optional in Vercel
REDIS_URL             = (terraform output redis_url)
AWS_REGION            = eu-west-1
AWS_ACCESS_KEY_ID     = (a programmatic IAM user with ses:SendEmail + s3 on the assets bucket)
AWS_SECRET_ACCESS_KEY = (its secret)
SES_CONFIGURATION_SET = sendify-default
S3_BUCKET             = (terraform output s3_bucket)
S3_PUBLIC_BASE_URL    = (terraform output cdn_url)
NEXT_PUBLIC_APP_URL   = https://sendify.divain.space
AUTH_SECRET           = (matching the value in Secrets Manager)
DEEPL_API_KEY         = (paste)
GEMINI_API_KEY        = (paste)
OPENAI_API_KEY        = (paste)
SHOPIFY_API_KEY       = (paste)
SHOPIFY_API_SECRET    = (paste)
PROMOTIONS_WEBHOOK_SECRET = (matching the value in Secrets Manager)
SENDIFY_FROM_EMAIL    = noreply@divainparfums.com
```

⚠️ **Important:** in Vercel use the **pooled** `DATABASE_URL` (RDS Proxy endpoint). The pooler is what makes Vercel's many-short-connections work without exhausting RDS.

### 3. Deploy

```bash
vercel --prod
```

### 4. Point your domain

In Vercel → Project → Settings → Domains → add `sendify.divain.space`. Vercel gives DNS records (CNAME or A). Add them in Route 53 or wherever your DNS lives.

---

## Phase 4 — Verify

### 1. Worker is alive

```bash
aws logs tail /ecs/sendify/worker --follow
# Expect: "✓ ready — waiting for send jobs"
```

### 2. App can read the DB

Browse to `https://sendify.divain.space/dashboard` → see your stores, segments, customers.

### 3. End-to-end test send

1. Create a tiny test segment (1 internal email)
2. Build a test campaign
3. Click **Approve & schedule**
4. Watch the live progress in `/campaigns/[id]`
5. Worker logs show: `✓ test@divainparfums.com  →  msgId 010f...`
6. Email arrives in your inbox 🎉

If anything goes wrong, check:
- ECS task logs: `/ecs/sendify/worker`
- RDS Performance Insights for slow queries
- SES → Sending statistics for delivery confirmations
- SNS → topic subscriptions for the events webhook

---

## Ongoing operations

| Task | How |
|---|---|
| Deploy code changes | `git push origin main` — CI takes care of build + migrate + rollout |
| Scale the worker | `aws ecs update-service --cluster sendify --service sendify-worker --desired-count 4` (or change `worker_desired_count` in tfvars + apply) |
| Bump SES rate | `aws secretsmanager update-secret --secret-id sendify/app --secret-string …` then force a new worker deployment |
| Rotate AUTH_SECRET | `aws secretsmanager put-secret-value --secret-id sendify/AUTH_SECRET --secret-string $(openssl rand -base64 32)` — Vercel + ECS pick it up on next boot |
| Add a sender domain | SES → Verified identities → Create. Then add it as a Sender in the Sendify UI |
| Restore DB from snapshot | RDS → Snapshots → Restore. Update DATABASE_URL accordingly |
| Pause all sending | `aws ecs update-service --cluster sendify --service sendify-worker --desired-count 0` (queue keeps filling; resume by setting back to 2+) |

---

## Sender warm-up protocol

**Critical:** before sending anything from a brand-new SES domain, you need to ramp gradually. Mailbox providers (Gmail, Outlook, Yahoo, Apple) build trust from steady, predictable volume + low complaint rate. Blasting 1.5M emails from a fresh domain on day 1 → automatic spam folder for the whole IP range, hard to recover.

Sendify handles this automatically via [src/lib/warmup.ts](src/lib/warmup.ts). The 14-day curve:

| Day | Limit |
|---|---|
| 1 | 50 |
| 2 | 100 |
| 3 | 500 |
| 4 | 1,000 |
| 5 | 5,000 |
| 6 | 10,000 |
| 7 | 20,000 |
| 8 | 40,000 |
| 9 | 70,000 |
| 10 | 100,000 |
| 11 | 150,000 |
| 12 | 250,000 |
| 13 | 400,000 |
| 14+ | full target (e.g. 670k/day for Europa) |

### Which senders need warm-up

| Sender | Status | Action |
|---|---|---|
| `divain@divainparfums.com` (Europa) | Legacy domain (was sending from Klaviyo) | **Skip warm-up.** `warmupStartedAt = null` |
| `hello@divainparfums.co.uk` (UK) | Legacy | **Skip warm-up.** `warmupStartedAt = null` |
| `help@divainparfums.co` (USA) | NEW domain | **Ramp 14 days** from first send |
| `hola@divainparfums.mx` (MX) | NEW domain | **Ramp 14 days** from first send |

For the legacy domains, even though SES is new, the *domain reputation* was built in Klaviyo. Mailbox providers track the domain, not the ESP. Sending the same volume you used to from Klaviyo is fine on day 1.

For the NEW domains (`.co`, `.mx`), the domain itself has zero reputation and we MUST ramp.

### How it works

1. When you create a new Sender in `/settings`, set `warmupStartedAt = now()`.
2. The audience resolver (`pipeline/approve.ts` step 4.5) calls `dailySendCap(sender)` before queuing.
3. If today's audience exceeds today's cap, the extras are *deferred* — they stay in `PENDING_APPROVAL` and roll over to tomorrow's bigger cap automatically.
4. After day 14, `dailySendCap` returns the hard `dailyCap` ceiling (anti-saturation) and the ramp is done.

### Quality signals to watch during ramp

Set CloudWatch alarms on the SES configuration set:
- **Complaint rate > 0.1%** → pause sending, investigate
- **Bounce rate > 5%**       → pause sending, audit your suppression list
- **Reputation < 70**        → AWS will eventually suspend; act before they do

Sendify's dashboard shows reputation per sender in real time. During warm-up, expect reputation to climb from 0 → 90+ over 2-3 weeks. If it stalls, slow the ramp.

## Migrating off Klaviyo

### Step 1 — Export from Klaviyo

For **each Shopify store** (Europa / UK / USA+CA / México) run a separate export:

1. Klaviyo dashboard → **Profiles**
2. Filter the list to that store's customers (use list memberships or the `$source` property)
3. Recommended consent filter: `Email Consent = subscribed OR unsubscribed` (skip never-subscribed to keep the migration clean)
4. Click **Export** → CSV → **All columns**
5. Download the CSV. Klaviyo emails you a link when it's ready (~few minutes for 1.5M rows)

### Step 2 — Import each CSV into Sendify

```bash
# Run from your laptop, DATABASE_URL pointing at the production RDS (use the DIRECT_URL
# from Terraform output — bypassing RDS Proxy gives better throughput on bulk insert)

export DATABASE_URL="postgresql://sendify:...@sendify-postgres.xxxx.eu-west-1.rds.amazonaws.com:5432/sendify?sslmode=require"

# First, dry-run a small slice to validate column mapping + language inference:
head -1001 klaviyo-europa.csv > /tmp/sample.csv
npm run import:klaviyo -- --csv /tmp/sample.csv --store st_1 --dry-run

# Then for real, the full file (one store at a time):
npm run import:klaviyo -- --csv klaviyo-europa.csv --store st_1
npm run import:klaviyo -- --csv klaviyo-uk.csv     --store st_2
npm run import:klaviyo -- --csv klaviyo-na.csv     --store st_3
npm run import:klaviyo -- --csv klaviyo-mx.csv     --store st_4
```

Expected throughput: ~3-5k customers/sec on `db.m6g.large` with batch size 5000. 1.5M rows imports in **5-8 minutes**.

The CLI is idempotent (`skipDuplicates` on `(storeId, shopifyId)` + `(storeId, email)`), so a partial run is safe to resume — just re-run with the full CSV.

### Step 3 — Validate the import

```bash
# Quick row counts per store + consent breakdown
psql "$DATABASE_URL" -c "
  SELECT s.name, c.\"consentStatus\", COUNT(*) FROM \"Customer\" c
  JOIN \"Store\" s ON s.id = c.\"storeId\"
  GROUP BY 1, 2 ORDER BY 1, 2;
"
```

Expected: ~1.2-1.4M SUBSCRIBED, ~50-150k UNSUBSCRIBED, low-thousands BOUNCED/COMPLAINED. If the SUBSCRIBED count is way off, check the Klaviyo filter you applied.

### Step 4 — Parallel run

Keep both Klaviyo and Sendify running for **~30 days**:
- Send the same campaign through Sendify to a 10% holdout audience
- Compare deliverability (Postmaster Tools), open rate, attributed revenue
- When confident, flip 100% of campaigns to Sendify and pause Klaviyo billing
