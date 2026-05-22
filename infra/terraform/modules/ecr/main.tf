variable "app_name" {
  type = string
}

resource "aws_ecr_repository" "backend" {
  name                 = "${var.app_name}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}

resource "aws_ecr_repository" "ml_service" {
  name                 = "${var.app_name}/ml-service"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "ml_service" {
  repository = aws_ecr_repository.ml_service.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = {
        type = "expire"
      }
    }]
  })
}

output "backend_url" {
  value = aws_ecr_repository.backend.repository_url
}

output "ml_service_url" {
  value = aws_ecr_repository.ml_service.repository_url
}

output "repository_arns" {
  value = [aws_ecr_repository.backend.arn, aws_ecr_repository.ml_service.arn]
}
