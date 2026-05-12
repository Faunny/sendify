// Outputs printed after `terraform apply`. Use them to wire Vercel envs and CI.

output "database_url" {
  description = "Pooled URL — use this in Vercel + app runtime."
  value       = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_proxy.postgres.endpoint}:5432/${var.db_name}?sslmode=require"
  sensitive   = true
}

output "direct_url" {
  description = "Direct URL — use this for `prisma migrate deploy` only."
  value       = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.postgres.address}:5432/${var.db_name}?sslmode=require"
  sensitive   = true
}

output "redis_url" {
  value     = "rediss://${aws_elasticache_replication_group.main.primary_endpoint_address}:6379"
  sensitive = true
}

output "s3_bucket"            { value = aws_s3_bucket.assets.id }
output "cdn_url"              { value = "https://${aws_cloudfront_distribution.cdn.domain_name}" }
output "ecr_app_repo_url"     { value = aws_ecr_repository.app.repository_url }
output "ecr_worker_repo_url"  { value = aws_ecr_repository.worker.repository_url }
output "ecs_cluster"          { value = aws_ecs_cluster.main.name }
output "worker_service_name"  { value = aws_ecs_service.worker.name }
output "vpc_id"               { value = aws_vpc.main.id }
output "private_subnets"      { value = aws_subnet.private[*].id }
output "task_security_group"  { value = aws_security_group.ecs_tasks.id }
