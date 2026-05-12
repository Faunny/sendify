// IAM roles for ECS task execution + the task itself.
// - Execution role: pulls images from ECR, writes logs, fetches secrets at boot
// - Task role: what the running container is allowed to do (SES send, S3 read/write, etc.)

# ── Execution role (used by ECS to boot the task) ────────────────────────────

resource "aws_iam_role" "task_execution" {
  name = "${var.project}-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow reading the secrets that the task definition references.
resource "aws_iam_role_policy" "task_execution_secrets" {
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = concat(
        [aws_secretsmanager_secret.app.arn, aws_secretsmanager_secret.db.arn],
        [for s in aws_secretsmanager_secret.provider_keys : s.arn]
      )
    }]
  })
}

# ── Task role (used by the running container) ────────────────────────────────

resource "aws_iam_role" "task" {
  name = "${var.project}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "task_runtime" {
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # SES — send + read config sets
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail", "ses:DescribeConfigurationSet"]
        Resource = "*"
      },
      # S3 — assets bucket only
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
        Resource = [aws_s3_bucket.assets.arn, "${aws_s3_bucket.assets.arn}/*"]
      },
      # CloudWatch logs (already covered by execution role for the agent, but task code
      # can write structured app logs too)
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "*"
      },
    ]
  })
}
