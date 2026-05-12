// RDS Postgres + RDS Proxy for connection pooling.
// Multi-AZ for HA, encrypted at rest, automated backups 7 days, deletion-protected.

resource "random_password" "db" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnet" }
}

resource "aws_db_parameter_group" "pg16" {
  name   = "${var.project}-pg16"
  family = "postgres16"

  # Higher work_mem for the heavy queries Sendify runs (segment evaluation, etc.)
  parameter { name = "work_mem"            value = "16384" }
  parameter { name = "maintenance_work_mem" value = "262144" }
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }
}

resource "aws_db_instance" "postgres" {
  identifier             = "${var.project}-postgres"
  engine                 = "postgres"
  engine_version         = "16.4"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage_gb
  max_allocated_storage  = var.db_max_storage_gb
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  multi_az                    = true
  publicly_accessible         = false
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  monitoring_interval         = 60
  monitoring_role_arn         = aws_iam_role.rds_monitoring.arn

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "${var.project}-postgres-final-${formatdate("YYYYMMDD-hhmm", timestamp())}"

  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }

  tags = { Name = "${var.project}-postgres" }
}

# ── RDS Proxy (connection pooling) ──
# Critical for serverless callers (Vercel functions, Lambda) that open many short
# connections. The worker, running long-lived on ECS, can bypass and connect direct.

resource "aws_iam_role" "rds_proxy" {
  name = "${var.project}-rds-proxy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "rds.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "rds_proxy_secrets" {
  role = aws_iam_role.rds_proxy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.db.arn
    }]
  })
}

resource "aws_db_proxy" "postgres" {
  name                   = "${var.project}-postgres"
  engine_family          = "POSTGRESQL"
  role_arn               = aws_iam_role.rds_proxy.arn
  vpc_subnet_ids         = aws_subnet.private[*].id
  vpc_security_group_ids = [aws_security_group.rds.id]
  require_tls            = true
  idle_client_timeout    = 1800

  auth {
    auth_scheme = "SECRETS"
    iam_auth    = "DISABLED"
    secret_arn  = aws_secretsmanager_secret.db.arn
  }

  tags = { Name = "${var.project}-postgres-proxy" }
}

resource "aws_db_proxy_default_target_group" "postgres" {
  db_proxy_name = aws_db_proxy.postgres.name

  connection_pool_config {
    max_connections_percent      = 100
    max_idle_connections_percent = 50
    connection_borrow_timeout    = 120
  }
}

resource "aws_db_proxy_target" "postgres" {
  db_proxy_name          = aws_db_proxy.postgres.name
  target_group_name      = aws_db_proxy_default_target_group.postgres.name
  db_instance_identifier = aws_db_instance.postgres.identifier
}

# ── Enhanced monitoring role ──
resource "aws_iam_role" "rds_monitoring" {
  name = "${var.project}-rds-monitoring"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  role       = aws_iam_role.rds_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}
