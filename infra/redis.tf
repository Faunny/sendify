// ElastiCache Redis for BullMQ.
// Single-node for cost; bump replicas_per_node_group when you want HA failover.

resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-redis"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "${var.project}-redis7"
  family = "redis7"
  # Keep AOF off for BullMQ — Redis is a queue, not the source of truth. If a job is
  # lost on Redis crash, the Send row stays QUEUED in Postgres and a janitor re-enqueues.
  parameter { name = "maxmemory-policy"  value = "noeviction" }
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "${var.project}-redis"
  description                = "Sendify BullMQ"
  engine                     = "redis"
  engine_version             = "7.1"
  node_type                  = var.redis_node_type
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis7.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.redis.id]

  num_cache_clusters         = 1
  automatic_failover_enabled = false
  multi_az_enabled           = false
  transit_encryption_enabled = true
  at_rest_encryption_enabled = true

  snapshot_retention_limit = 1
  snapshot_window          = "03:00-04:00"
  maintenance_window       = "mon:04:00-mon:05:00"

  tags = { Name = "${var.project}-redis" }
}
