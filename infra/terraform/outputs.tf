output "ec2_public_ip" {
  description = "The public IP of the EC2 instance"
  value       = module.ec2.public_ip
}

output "ecr_backend_url" {
  description = "The URL of the backend ECR repository"
  value       = module.ecr.backend_url
}

output "ecr_ml_service_url" {
  description = "The URL of the ML service ECR repository"
  value       = module.ecr.ml_service_url
}

output "cloudfront_domain" {
  description = "The domain name of the CloudFront distribution"
  value       = module.cloudfront.domain_name
}

output "cf_distribution_id" {
  description = "The CloudFront distribution ID"
  value       = module.cloudfront.distribution_id
}

output "sqs_queue_url" {
  description = "The SQS queue URL for ML training jobs"
  value       = module.sqs.queue_url
}

output "github_actions_role" {
  description = "The ARN of the GitHub Actions OIDC IAM role"
  value       = module.iam.github_actions_role_arn
}

output "s3_uploads_bucket" {
  description = "The name of the S3 bucket for uploads"
  value       = module.s3.uploads_bucket_id
}

output "s3_frontend_bucket" {
  description = "The name of the S3 bucket for frontend hosting"
  value       = module.s3.frontend_bucket_id
}
