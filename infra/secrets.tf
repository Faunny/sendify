// Secrets Manager entries. App + worker read these at boot via the ECS task IAM role.
// For Vercel: copy the resolved plaintext values from `terraform output -json` into Vercel env.

locals {
  app_secrets_plaintext = jsonencode({
    DATABASE_URL                = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_proxy.postgres.endpoint}:5432/${var.db_name}?sslmode=require"
    DIRECT_URL                  = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}?sslmode=require"
    REDIS_URL                   = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
    AWS_REGION                  = var.aws_region
    NEXT_PUBLIC_APP_URL         = var.enable_dns ? "https://${var.root_domain}" : ""
    SES_CONFIGURATION_SET       = "sendify-default"
    S3_BUCKET                   = aws_s3_bucket.assets.id
    S3_PUBLIC_BASE_URL          = "https://${aws_cloudfront_distribution.cdn.domain_name}"
    SES_RATE_PER_SECOND         = "14"
    SENDIFY_FROM_EMAIL          = "noreply@${var.root_domain}"
  })
}

# A single secret with the JSON blob. ECS task secrets array fans it out into env vars.
resource "aws_secretsmanager_secret" "app" {
  name        = "${var.project}/app"
  description = "App + worker non-rotating env. Rotated provider keys live in separate secrets."
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = local.app_secrets_plaintext
}

# DB credentials secret consumed by RDS Proxy (separate format).
resource "aws_secretsmanager_secret" "db" {
  name        = "${var.project}/rds-credentials"
  description = "Postgres root credentials for RDS Proxy"
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
  })
}

# Provider keys — populate manually after first apply via the AWS console.
# Keeping them blank-by-default avoids putting paid API keys in Terraform state plaintext.
resource "aws_secretsmanager_secret" "provider_keys" {
  for_each = toset([
    "DEEPL_API_KEY",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_ADS_CLIENT_ID",
    "GOOGLE_ADS_CLIENT_SECRET",
    "GOOGLE_ADS_REFRESH_TOKEN",
    "AUTH_SECRET",
    "PROMOTIONS_WEBHOOK_SECRET",
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
  ])
  name = "${var.project}/${each.value}"
}
