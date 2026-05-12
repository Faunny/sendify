// ECS cluster + worker service (always-on). UI service is gated behind
// `var.deploy_ui_to_ecs` — by default we use Vercel for the UI.

resource "aws_ecs_cluster" "main" {
  name = "${var.project}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.project}/worker"
  retention_in_days = 30
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.project}/app"
  retention_in_days = 30
}

# ── Worker task definition ──────────────────────────────────────────────────

locals {
  provider_secrets_env = [
    for name, secret in aws_secretsmanager_secret.provider_keys : {
      name      = name
      valueFrom = secret.arn
    }
  ]
}

resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.project}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = "${aws_ecr_repository.worker.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 8080, hostPort = 8080, protocol = "tcp" }]
    secrets = concat([
      { name = "DATABASE_URL",        valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"        },
      { name = "DIRECT_URL",          valueFrom = "${aws_secretsmanager_secret.app.arn}:DIRECT_URL::"          },
      { name = "REDIS_URL",           valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_URL::"           },
      { name = "AWS_REGION",          valueFrom = "${aws_secretsmanager_secret.app.arn}:AWS_REGION::"          },
      { name = "NEXT_PUBLIC_APP_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:NEXT_PUBLIC_APP_URL::" },
      { name = "SES_CONFIGURATION_SET", valueFrom = "${aws_secretsmanager_secret.app.arn}:SES_CONFIGURATION_SET::" },
      { name = "S3_BUCKET",           valueFrom = "${aws_secretsmanager_secret.app.arn}:S3_BUCKET::"           },
      { name = "S3_PUBLIC_BASE_URL",  valueFrom = "${aws_secretsmanager_secret.app.arn}:S3_PUBLIC_BASE_URL::"  },
      { name = "SES_RATE_PER_SECOND", valueFrom = "${aws_secretsmanager_secret.app.arn}:SES_RATE_PER_SECOND::" },
      { name = "SENDIFY_FROM_EMAIL",  valueFrom = "${aws_secretsmanager_secret.app.arn}:SENDIFY_FROM_EMAIL::"  },
    ], local.provider_secrets_env)
    environment = [{ name = "NODE_ENV", value = "production" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "${var.project}-worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  deployment_minimum_healthy_percent = 50
  deployment_maximum_percent         = 200

  lifecycle {
    # CI/CD updates the image; Terraform should only own the structure.
    ignore_changes = [task_definition, desired_count]
  }
}

# ── UI service on ECS (only if deploy_ui_to_ecs = true) ─────────────────────

resource "aws_ecs_task_definition" "app" {
  count                    = var.deploy_ui_to_ecs ? 1 : 0
  family                   = "${var.project}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "app"
    image     = "${aws_ecr_repository.app.repository_url}:latest"
    essential = true
    portMappings = [{ containerPort = 3000, hostPort = 3000, protocol = "tcp" }]
    secrets = concat([
      { name = "DATABASE_URL",        valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::"        },
      { name = "DIRECT_URL",          valueFrom = "${aws_secretsmanager_secret.app.arn}:DIRECT_URL::"          },
      { name = "REDIS_URL",           valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_URL::"           },
      { name = "AWS_REGION",          valueFrom = "${aws_secretsmanager_secret.app.arn}:AWS_REGION::"          },
      { name = "NEXT_PUBLIC_APP_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:NEXT_PUBLIC_APP_URL::" },
      { name = "SES_CONFIGURATION_SET", valueFrom = "${aws_secretsmanager_secret.app.arn}:SES_CONFIGURATION_SET::" },
      { name = "S3_BUCKET",           valueFrom = "${aws_secretsmanager_secret.app.arn}:S3_BUCKET::"           },
      { name = "S3_PUBLIC_BASE_URL",  valueFrom = "${aws_secretsmanager_secret.app.arn}:S3_PUBLIC_BASE_URL::"  },
    ], local.provider_secrets_env)
    environment = [{ name = "NODE_ENV", value = "production" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.app.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "app"
      }
    }
  }])
}
