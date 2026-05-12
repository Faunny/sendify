# Sendify infra · Terraform

Provisions the production AWS infrastructure for Sendify in the same account where SES already lives.

## What this creates

- **VPC** in `eu-west-1` (3 AZs) with public + private subnets, NAT gateway, S3 endpoint
- **RDS Postgres 16** `db.m6g.large` Multi-AZ, encrypted, 100GB gp3, automated backups 7 days
- **RDS Proxy** for connection pooling (Lambda/Fargate/Vercel friendly)
- **ElastiCache Redis** `cache.t4g.medium` in private subnet
- **ECR repositories** for `sendify-app` and `sendify-worker`
- **ECS Fargate cluster** with two services (UI optional + worker)
- **ALB** in front of the UI service (when not using Vercel)
- **Secrets Manager** entries for DATABASE_URL, REDIS_URL, DEEPL_API_KEY, GEMINI_API_KEY, AUTH_SECRET, PROMOTIONS_WEBHOOK_SECRET
- **IAM roles** with least privilege: ECS task can read its secrets + write SES + read/write S3
- **CloudWatch log groups** for both services
- **S3 bucket** for asset library (`sendify-assets-<account>`)
- **CloudFront distribution** pointing at the S3 bucket
- **Route 53 hosted zone** (optional, set `enable_dns = true`)

Does NOT create:
- The SES configuration set + verified senders — you have those already. We reference them as data sources.
- The Vercel project — managed via Vercel CLI / dashboard.

## One-time setup

```bash
# 1. Pre-reqs: AWS CLI configured + Terraform 1.7+
aws sts get-caller-identity   # verify you're on the right account
terraform --version

# 2. Pick or create a backend bucket for state (only once across all your projects)
aws s3 mb s3://divain-terraform-state --region eu-west-1
aws s3api put-bucket-versioning --bucket divain-terraform-state --versioning-configuration Status=Enabled

# 3. Configure
cd infra
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars: region, db credentials seeds, domain

# 4. Init + apply
terraform init
terraform plan -out=plan.bin
terraform apply plan.bin
```

First `apply` takes ~15 minutes (RDS provisioning dominates). Subsequent applies are ~30 seconds.

## After apply

Terraform writes to `tfstate` and prints outputs:
- `database_url` → store in your `.env.production` and as Vercel env
- `redis_url`    → same
- `worker_image_uri` → ECR URI to push the worker image to
- `app_image_uri`    → ECR URI for the UI image (only if not using Vercel)
- `cdn_url` → CloudFront distribution domain for `S3_PUBLIC_BASE_URL`

## Cost

Steady-state ~$460/mo for the infra itself (see top-level `DEPLOY.md` for the breakdown). All resources are tagged `Project=Sendify` so you can pin cost in AWS Cost Explorer.

## Destroy

```bash
terraform destroy   # nukes everything. DB snapshot is kept for 7 days unless you skip-final-snapshot.
```

⚠️ For production, set `deletion_protection = true` on the RDS instance (default in this module).
