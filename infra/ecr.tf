// ECR repos for the two Docker images. Tagged with `latest` + git SHA from CI.

resource "aws_ecr_repository" "app" {
  name                 = "${var.project}-app"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${var.project}-worker"
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration { scan_on_push = true }
  encryption_configuration { encryption_type = "AES256" }
}

# Keep only the last 10 images to control storage cost.
locals {
  ecr_lifecycle = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

resource "aws_ecr_lifecycle_policy" "app"    { repository = aws_ecr_repository.app.name    policy = local.ecr_lifecycle }
resource "aws_ecr_lifecycle_policy" "worker" { repository = aws_ecr_repository.worker.name policy = local.ecr_lifecycle }
